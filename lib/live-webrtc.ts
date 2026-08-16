/**
 * Browser WebRTC helpers for Loop Live.
 * Host fans out media to viewers; Supabase Realtime carries signaling.
 */

export const LIVE_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

export type MediaMode = "camera" | "screen"

export type SignalPayload =
  | { type: "hello"; from: string; displayName?: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit | null }
  | { type: "bye"; from: string }
  | { type: "media-mode"; from: string; mode: MediaMode }

export type SignalSend = (event: string, payload: SignalPayload) => void | Promise<void>

const MAX_VIEWER_PEERS = 28

function makePeer(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: LIVE_ICE_SERVERS,
    // Helps some NATs with media mid-session changes (camera <-> screen)
    bundlePolicy: "max-bundle",
  })
}

async function attachLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
  const existingSenders = pc.getSenders()
  for (const track of stream.getTracks()) {
    const existing = existingSenders.find((s) => s.track?.kind === track.kind)
    if (existing) {
      await existing.replaceTrack(track)
    } else {
      pc.addTrack(track, stream)
    }
  }
}

/** Host-side broadcaster: one outbound stream, many peer connections. */
export class LiveBroadcaster {
  localStream: MediaStream | null = null
  cameraStream: MediaStream | null = null
  screenStream: MediaStream | null = null
  mediaMode: MediaMode = "camera"
  peers = new Map<string, RTCPeerConnection>()
  private peerId: string
  private send: SignalSend
  private disposed = false
  onLocalStream?: (stream: MediaStream, mode: MediaMode) => void

  constructor(peerId: string, send: SignalSend) {
    this.peerId = peerId
    this.send = send
  }

  async startCamera(facingMode: "user" | "environment" = "user") {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    })
    this.cameraStream = stream
    this.localStream = stream
    this.mediaMode = "camera"
    await this.pushTracksToPeers()
    await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "camera" })
    this.onLocalStream?.(stream, "camera")
    return stream
  }

  /**
   * Share screen in realtime by replacing the outbound video track
   * (no full peer teardown — viewers update live).
   */
  async startScreenShare() {
    const mediaDevices = navigator.mediaDevices
    const getDisplayMedia =
      (mediaDevices && typeof mediaDevices.getDisplayMedia === "function"
        ? mediaDevices.getDisplayMedia.bind(mediaDevices)
        : undefined) ||
      // Older Safari / embedded webviews expose the legacy global API
      (typeof (navigator as any).getDisplayMedia === "function"
        ? (navigator as any).getDisplayMedia.bind(navigator)
        : undefined)

    if (!getDisplayMedia) {
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        throw new Error("Screen sharing requires a secure (HTTPS) connection. Open the app in its own tab over HTTPS.")
      }
      throw new Error(
        "This browser doesn't support screen sharing. Use Chrome or Edge on desktop — and if you're viewing an embedded preview, open the live room in its own tab.",
      )
    }

    let display: MediaStream
    try {
      display = await getDisplayMedia({
        video: {
          frameRate: { ideal: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        // audio:true fails on many browsers; capture video first
        audio: false,
      })
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        throw new Error("Screen share permission denied. Allow sharing and try again.")
      }
      if (err?.name === "NotFoundError" || err?.name === "NotSupportedError") {
        throw new Error("No screen source available. This device or browser can't share a screen right now.")
      }
      throw new Error(err?.message || "Could not start screen share")
    }

    const screenTrack = display.getVideoTracks()[0]
    if (!screenTrack) {
      display.getTracks().forEach((t) => t.stop())
      throw new Error("No screen video track available")
    }

    screenTrack.addEventListener("ended", () => {
      void this.stopScreenShare()
    })

    // Compose preview stream: screen video + camera mic
    const composed = new MediaStream([screenTrack])
    const mic = this.cameraStream?.getAudioTracks()[0]
    if (mic && mic.readyState === "live") {
      composed.addTrack(mic)
    }

    this.screenStream = display
    this.localStream = composed
    this.mediaMode = "screen"

    // Hot-swap video on existing peers (realtime)
    await this.replaceVideoTrack(screenTrack)
    // Ensure audio sender still has mic
    if (mic) await this.replaceAudioTrack(mic)

    await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "screen" })
    this.onLocalStream?.(composed, "screen")
    return composed
  }

  async stopScreenShare() {
    const screenTracks = this.screenStream?.getTracks() || []
    screenTracks.forEach((t) => {
      try {
        t.stop()
      } catch {}
    })
    this.screenStream = null

    if (!this.cameraStream) {
      this.localStream = null
      this.mediaMode = "camera"
      return
    }

    this.localStream = this.cameraStream
    this.mediaMode = "camera"
    const camVideo = this.cameraStream.getVideoTracks()[0]
    const camAudio = this.cameraStream.getAudioTracks()[0]
    if (camVideo) await this.replaceVideoTrack(camVideo)
    if (camAudio) await this.replaceAudioTrack(camAudio)

    await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "camera" })
    this.onLocalStream?.(this.cameraStream, "camera")
  }

  /**
   * Switch between the front and back camera. Only attempts the flip when the
   * device actually reports more than one video input — otherwise desktops
   * (one camera) throw a NotFoundError and the button appears broken.
   */
  async flipCamera() {
    if (this.mediaMode !== "camera") return this.localStream

    const current = this.cameraStream?.getVideoTracks()[0]
    if (!current) return this.localStream

    const reportedFacing = current.getSettings().facingMode
    if (reportedFacing) {
      // Device reports its orientation — flip it directly.
      const facing = reportedFacing === "environment" ? "user" : "environment"
      return this.swapCameraTrack(facing)
    }

    // Desktop / devices that don't report facingMode: only flip when a second
    // camera actually exists, otherwise surface a friendly error instead of a
    // silent browser-level failure.
    let deviceCount = 1
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      deviceCount = devices.filter((d) => d.kind === "videoinput").length
    } catch {
      deviceCount = 1
    }
    if (deviceCount < 2) {
      throw new Error("Only one camera detected on this device.")
    }

    // Try environment first (front camera is already live); fall back to user
    // if that request fails.
    try {
      return await this.swapCameraTrack("environment")
    } catch (firstErr: any) {
      if (firstErr?.name === "NotFoundError" || firstErr?.name === "OverconstrainedError") {
        return this.swapCameraTrack("user")
      }
      throw firstErr
    }
  }

  private async swapCameraTrack(facing: "user" | "environment") {
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    const newTrack = next.getVideoTracks()[0]
    const oldTrack = this.cameraStream?.getVideoTracks()[0]
    if (this.cameraStream && newTrack) {
      if (oldTrack) {
        this.cameraStream.removeTrack(oldTrack)
        oldTrack.stop()
      }
      this.cameraStream.addTrack(newTrack)
      this.localStream = this.cameraStream
      await this.replaceVideoTrack(newTrack)
      this.onLocalStream?.(this.cameraStream, "camera")
    }
    next.getAudioTracks().forEach((t) => t.stop())
    return this.localStream
  }

  setMicEnabled(enabled: boolean) {
    this.cameraStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  setCameraEnabled(enabled: boolean) {
    // Only toggle camera video when not screen sharing
    if (this.mediaMode === "screen") return
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  private async replaceVideoTrack(track: MediaStreamTrack) {
    const tasks: Promise<void>[] = []
    for (const pc of this.peers.values()) {
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video")
      if (videoSender) {
        tasks.push(
          videoSender.replaceTrack(track).catch(() => {
            if (this.localStream) pc.addTrack(track, this.localStream)
          }),
        )
      } else if (this.localStream) {
        pc.addTrack(track, this.localStream)
      }
    }
    await Promise.all(tasks)
  }

  private async replaceAudioTrack(track: MediaStreamTrack) {
    const tasks: Promise<void>[] = []
    for (const pc of this.peers.values()) {
      const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio")
      if (audioSender) {
        tasks.push(audioSender.replaceTrack(track).catch(() => undefined))
      } else if (this.localStream) {
        pc.addTrack(track, this.localStream)
      }
    }
    await Promise.all(tasks)
  }

  private async pushTracksToPeers() {
    if (!this.localStream) return
    if (this.peers.size === 0) return
    const video = this.localStream.getVideoTracks()[0]
    const audio = this.localStream.getAudioTracks()[0]
    if (video) await this.replaceVideoTrack(video)
    if (audio) await this.replaceAudioTrack(audio)
  }

  async handleHello(viewerId: string) {
    if (this.disposed || !this.localStream) return
    if (this.peers.size >= MAX_VIEWER_PEERS && !this.peers.has(viewerId)) return
    await this.createOfferFor(viewerId)
  }

  private async createOfferFor(viewerId: string) {
    if (!this.localStream) return

    let pc = this.peers.get(viewerId)
    if (pc) {
      try {
        pc.close()
      } catch {}
      this.peers.delete(viewerId)
    }

    pc = makePeer()
    this.peers.set(viewerId, pc)

    pc.onicecandidate = (ev) => {
      void this.send("webrtc-signal", {
        type: "ice",
        from: this.peerId,
        to: viewerId,
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      })
    }

    pc.onconnectionstatechange = () => {
      if (pc && ["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        // Soft-fail: keep map entry briefly; hello can recreate
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          try {
            pc.close()
          } catch {}
          this.peers.delete(viewerId)
        }
      }
    }

    await attachLocalTracks(pc, this.localStream)
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false })
    await pc.setLocalDescription(offer)
    await this.send("webrtc-signal", {
      type: "offer",
      from: this.peerId,
      to: viewerId,
      sdp: offer,
    })
  }

  async handleAnswer(from: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.peers.get(from)
    if (!pc) return
    if (pc.signalingState !== "have-local-offer") return
    await pc.setRemoteDescription(sdp)
  }

  async handleIce(from: string, candidate: RTCIceCandidateInit | null) {
    const pc = this.peers.get(from)
    if (!pc || !candidate) return
    try {
      await pc.addIceCandidate(candidate)
    } catch {
      // ignore late/duplicate ICE
    }
  }

  removeViewer(viewerId: string) {
    const pc = this.peers.get(viewerId)
    if (pc) {
      try {
        pc.close()
      } catch {}
      this.peers.delete(viewerId)
    }
  }

  async dispose() {
    this.disposed = true
    for (const [id, pc] of this.peers) {
      try {
        pc.close()
      } catch {}
      this.peers.delete(id)
    }
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.cameraStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
    this.cameraStream = null
    this.localStream = null
    await this.send("webrtc-signal", { type: "bye", from: this.peerId })
  }
}

/** Viewer-side consumer: receives host media. */
export class LiveViewer {
  remoteStream = new MediaStream()
  private pc: RTCPeerConnection | null = null
  private peerId: string
  private hostId: string | null = null
  private send: SignalSend
  private disposed = false
  onTrack?: (stream: MediaStream) => void

  constructor(peerId: string, send: SignalSend) {
    this.peerId = peerId
    this.send = send
  }

  async announce() {
    await this.send("webrtc-signal", { type: "hello", from: this.peerId })
  }

  private ensurePc(hostId: string) {
    if (this.pc && this.hostId === hostId) return this.pc
    if (this.pc) {
      try {
        this.pc.close()
      } catch {}
    }
    this.hostId = hostId
    this.remoteStream = new MediaStream()
    const pc = makePeer()
    this.pc = pc

    pc.onicecandidate = (ev) => {
      if (!this.hostId) return
      void this.send("webrtc-signal", {
        type: "ice",
        from: this.peerId,
        to: this.hostId,
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      })
    }

    pc.ontrack = (ev) => {
      const incoming = ev.track
      // Replace same-kind tracks so screen/camera swaps update the <video> live
      this.remoteStream.getTracks()
        .filter((t) => t.kind === incoming.kind)
        .forEach((t) => {
          this.remoteStream.removeTrack(t)
          try {
            t.stop()
          } catch {}
        })
      this.remoteStream.addTrack(incoming)
      this.onTrack?.(this.remoteStream)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        void this.announce()
      }
    }

    return pc
  }

  async handleOffer(from: string, sdp: RTCSessionDescriptionInit) {
    if (this.disposed) return
    const pc = this.ensurePc(from)
    if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
      try {
        await pc.setRemoteDescription(sdp)
      } catch {
        // recreate on glare
        try {
          pc.close()
        } catch {}
        this.pc = null
        const fresh = this.ensurePc(from)
        await fresh.setRemoteDescription(sdp)
        const answer = await fresh.createAnswer()
        await fresh.setLocalDescription(answer)
        await this.send("webrtc-signal", {
          type: "answer",
          from: this.peerId,
          to: from,
          sdp: answer,
        })
        return
      }
    } else {
      await pc.setRemoteDescription(sdp)
    }
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await this.send("webrtc-signal", {
      type: "answer",
      from: this.peerId,
      to: from,
      sdp: answer,
    })
  }

  async handleIce(from: string, candidate: RTCIceCandidateInit | null) {
    if (!this.pc || !candidate) return
    if (this.hostId && from !== this.hostId) return
    try {
      await this.pc.addIceCandidate(candidate)
    } catch {
      // ignore
    }
  }

  async dispose() {
    this.disposed = true
    await this.send("webrtc-signal", { type: "bye", from: this.peerId })
    try {
      this.pc?.close()
    } catch {}
    this.pc = null
    this.remoteStream.getTracks().forEach((t) => t.stop())
  }
}
