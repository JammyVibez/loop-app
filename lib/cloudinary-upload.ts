import "server-only"
import { createServerClient } from "@/lib/supabase"
import { getMediaPolicy } from "@/lib/media/policy"
import { resolveUploadActor, saveUpload } from "@/lib/media/upload-service"

/**
 * Server-side upload helper for routes that receive a `File` directly
 * (multipart post forms, branch replies).
 *
 * The name is kept for compatibility with existing imports, but nothing here
 * contacts Cloudinary any more: the file is validated, processed and written to
 * the VPS media store exactly like a browser upload, and existing Cloudinary
 * URLs are left untouched.
 */
export type ServerUploadResult = {
  secure_url: string
  public_id: string
  resource_type: string
  width?: number
  height?: number
  duration?: number
  status: "ready" | "processing"
  id: string
}

export async function uploadFileToStorage(
  file: File,
  folder = "loops",
  actorId?: string,
): Promise<ServerUploadResult> {
  if (!actorId) throw new Error("An authenticated user is required to upload media")
  if (!file.size) throw new Error("The uploaded file is empty")

  const supabase = createServerClient()
  const actor = await resolveUploadActor(actorId, supabase)
  const policy = await getMediaPolicy(supabase)

  const result = await saveUpload({
    actor,
    policy,
    body: file.stream() as unknown as ReadableStream<Uint8Array>,
    contentLength: file.size,
    declaredFamily: file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : file.type.startsWith("image/")
          ? "image"
          : "file",
    folder,
    purpose: folder,
    originalFilename: file.name,
    mimeHint: file.type,
    supabase,
  })

  return {
    secure_url: result.url,
    public_id: result.storage_path,
    resource_type: result.media_type === "video" ? "video" : result.media_type === "audio" ? "video" : "image",
    width: result.width ?? undefined,
    height: result.height ?? undefined,
    duration: result.duration ?? undefined,
    status: result.status,
    id: result.id,
  }
}

/** @deprecated Use `uploadFileToStorage` — kept so older call sites compile. */
export async function uploadFileToCloudinary(
  file: File,
  folder = "loops",
  actorId?: string,
): Promise<ServerUploadResult> {
  return uploadFileToStorage(file, folder, actorId)
}
