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
  return new RTCPeerConnection({ iceServers: LIVE_ICE_SERVERS })
}

async function attachLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
  for (const track of stream.getTracks()) {
    const existing = pc.getSenders().find((s) => s.track?.kind === track.kind)
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
    await this.renegotiateAll()
    await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "camera" })
    return stream
  }

  async startScreenShare() {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30 },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: true,
    })

    // Keep mic from camera stream when screen has no audio
    const mic = this.cameraStream?.getAudioTracks()[0]
    if (mic && display.getAudioTracks().length === 0) {
      display.addTrack(mic)
    }

    display.getVideoTracks()[0]?.addEventListener("ended", () => {
      void this.stopScreenShare()
    })

    this.screenStream = display
    this.localStream = display
    this.mediaMode = "screen"
    await this.renegotiateAll()
    await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "screen" })
    return display
  }

  async stopScreenShare() {
    this.screenStream?.getTracks().forEach((t) => {
      if (t.kind === "video" || !this.cameraStream?.getAudioTracks().includes(t)) {
        t.stop()
      }
    })
    this.screenStream = null
    if (this.cameraStream) {
      this.localStream = this.cameraStream
      this.mediaMode = "camera"
      await this.renegotiateAll()
      await this.send("webrtc-signal", { type: "media-mode", from: this.peerId, mode: "camera" })
    }
  }

  async flipCamera() {
    if (this.mediaMode !== "camera") return this.localStream
    const current = this.cameraStream?.getVideoTracks()[0]
    const facing = current?.getSettings().facingMode === "environment" ? "user" : "environment"
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    const newTrack = next.getVideoTracks()[0]
    const oldTrack = this.cameraStream?.getVideoTracks()[0]
    if (this.cameraStream && newTrack) {
      this.cameraStream.removeTrack(oldTrack!)
      oldTrack?.stop()
      this.cameraStream.addTrack(newTrack)
      this.localStream = this.cameraStream
      await this.replaceVideoTrack(newTrack)
    }
    next.getAudioTracks().forEach((t) => t.stop())
    return this.localStream
  }

  setMicEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  setCameraEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  private async replaceVideoTrack(track: MediaStreamTrack) {
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video")
      if (sender) await sender.replaceTrack(track)
    }
  }

  private async renegotiateAll() {
    if (!this.localStream) return
    const ids = [...this.peers.keys()]
    await Promise.all(ids.map((id) => this.createOfferFor(id)))
  }

  async handleHello(viewerId: string) {
    if (this.disposed || !this.localStream) return
    if (this.peers.has(viewerId)) {
      await this.createOfferFor(viewerId)
      return
    }
    if (this.peers.size >= MAX_VIEWER_PEERS) return
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
        try {
          pc.close()
        } catch {}
        this.peers.delete(viewerId)
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
      const stream = ev.streams[0] || this.remoteStream
      stream.getTracks().forEach((track) => {
        const exists = this.remoteStream.getTracks().some((t) => t.id === track.id)
        if (!exists) this.remoteStream.addTrack(track)
      })
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
    await pc.setRemoteDescription(sdp)
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
