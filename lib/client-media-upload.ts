import { parseJsonResponse } from "@/lib/parse-json-response"

const MAX_UPLOAD_BYTES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 25 * 1024 * 1024,
}

/** Vercel serverless request body limit is ~4.5MB; stay under that for proxy uploads. */
const PROXY_SAFE_BYTES = 3.5 * 1024 * 1024

export type UploadMediaOptions = {
  type: "image" | "video" | "audio" | "file"
  folder?: string
  authHeaders: Record<string, string>
  /** Optional override for the per-type size cap (used for large ZIP uploads). */
  maxSizeBytes?: number
  /** Skip the serverless proxy and upload straight to Cloudinary (signed). */
  forceDirect?: boolean
}

export type UploadMediaResult = {
  url: string
  public_id?: string
  width?: number
  height?: number
  duration?: number
  format?: string
}

function mediaTypeFromFile(file: File, explicit?: UploadMediaOptions["type"]): UploadMediaOptions["type"] {
  if (explicit) return explicit
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  if (file.type.startsWith("image/")) return "image"

  // Some browsers (Android file pickers, desktop drag-and-drop from certain
  // apps) report an empty MIME type — fall back to the file extension so those
  // uploads don't silently fail as unknown "file" types.
  const name = (file.name || "").toLowerCase()
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp)$/i.test(name)) return "video"
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i.test(name)) return "audio"
  if (/\.(jpe?g|png|gif|webp|svg|heic|heif|avif|bmp)$/i.test(name)) return "image"
  return "file"
}

/**
 * Upload media for authenticated users.
 * Large files and all video/audio go directly to Cloudinary (signed) so they
 * are not rejected by the host with a non-JSON "Request Entity Too Large".
 */
export async function uploadMediaFile(
  file: File,
  options: UploadMediaOptions,
): Promise<UploadMediaResult> {
  const type = mediaTypeFromFile(file, options.type)
  const folder = options.folder || "general"
  const maxSize = options.maxSizeBytes ?? (MAX_UPLOAD_BYTES[type] || MAX_UPLOAD_BYTES.file)

  if (file.size > maxSize) {
    throw new Error(`File is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`)
  }

  const mustDirect = options.forceDirect || type === "video" || type === "audio" || file.size > PROXY_SAFE_BYTES

  if (!mustDirect) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", type)
    formData.append("folder", folder)

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: options.authHeaders,
      body: formData,
    })
    const { data } = await parseJsonResponse<any>(uploadRes)
    const url = data.url || data.data?.url
    if (!uploadRes.ok || !url) {
      throw new Error(data.error || "Upload failed")
    }
    return {
      url,
      public_id: data.public_id,
      width: data.width,
      height: data.height,
      duration: data.duration,
      format: data.format,
    }
  }

  try {
    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.authHeaders,
      },
      body: JSON.stringify({ type, folder }),
    })
    const { data: sign } = await parseJsonResponse<any>(signRes)
    if (signRes.ok && sign?.signature && sign?.cloudName) {
      const form = new FormData()
      form.append("file", file)
      form.append("api_key", sign.apiKey)
      form.append("timestamp", String(sign.timestamp))
      form.append("signature", sign.signature)
      form.append("folder", sign.folder)

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`,
        { method: "POST", body: form },
      )
      const cloudRaw = await cloudRes.text()
      let cloudData: any = {}
      try {
        cloudData = cloudRaw ? JSON.parse(cloudRaw) : {}
      } catch {
        // ignore parse error
      }
      if (cloudRes.ok && cloudData.secure_url) {
        return {
          url: cloudData.secure_url as string,
          public_id: cloudData.public_id,
          width: cloudData.width,
          height: cloudData.height,
          duration: cloudData.duration,
          format: cloudData.format,
        }
      }
    }
  } catch (err) {
    console.warn("Direct Cloudinary upload failed, attempting proxy fallback...", err)
  }

  // Fallback to /api/upload proxy
  const formData = new FormData()
  formData.append("file", file)
  formData.append("type", type)
  formData.append("folder", folder)

  const uploadRes = await fetch("/api/upload", {
    method: "POST",
    headers: options.authHeaders,
    body: formData,
  })
  const { data } = await parseJsonResponse<any>(uploadRes)
  const url = data.url || data.data?.url
  if (!uploadRes.ok || !url) {
    throw new Error(data.error || "Upload failed. Please check video file format and size.")
  }
  return {
    url,
    public_id: data.public_id,
    width: data.width,
    height: data.height,
    duration: data.duration,
    format: data.format,
  }
}
