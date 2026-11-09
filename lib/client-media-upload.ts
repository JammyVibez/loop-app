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

type CloudinarySignedUpload = {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  resourceType: string
}

async function uploadSignedToCloudinary(file: File, sign: CloudinarySignedUpload): Promise<UploadMediaResult> {
  const endpoint = `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`
  const appendSignature = (form: FormData) => {
    form.append("api_key", sign.apiKey)
    form.append("timestamp", String(sign.timestamp))
    form.append("signature", sign.signature)
    form.append("folder", sign.folder)
  }

  if (file.size <= 100 * 1024 * 1024) {
    const form = new FormData()
    form.append("file", file)
    appendSignature(form)
    const response = await fetch(endpoint, { method: "POST", body: form })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.secure_url) {
      throw new Error(payload.error?.message || `Cloudinary upload failed (${response.status})`)
    }
    return {
      url: payload.secure_url,
      public_id: payload.public_id,
      width: payload.width,
      height: payload.height,
      duration: payload.duration,
      format: payload.format,
    }
  }

  const chunkSize = 20_000_000
  const uploadId = crypto.randomUUID()
  let result: any = null
  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size)
    const form = new FormData()
    form.append("file", file.slice(start, end, file.type), file.name)
    appendSignature(form)
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        "X-Unique-Upload-Id": uploadId,
      },
      body: form,
    })
    result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error?.message || `Cloudinary chunk upload failed (${response.status})`)
    }
  }

  if (!result?.secure_url) throw new Error("Cloudinary did not finish processing the uploaded video")
  return {
    url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
    duration: result.duration,
    format: result.format,
  }
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
    if (!signRes.ok || !sign?.signature || !sign?.cloudName) {
      throw new Error(sign.error || "Could not authorize the media upload")
    }
    return await uploadSignedToCloudinary(file, sign as CloudinarySignedUpload)
  } catch (error) {
    // Large assets cannot use the serverless proxy fallback, and attempting it
    // turns a useful Cloudinary error into a generic 413/HTML response.
    if (file.size > PROXY_SAFE_BYTES) {
      throw error instanceof Error ? error : new Error("Direct upload failed")
    }
    console.warn("Direct Cloudinary upload failed, attempting proxy fallback...", error)
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
