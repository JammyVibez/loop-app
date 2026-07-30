import { v2 as cloudinary } from "cloudinary"
import { isCloudinaryConfigured } from "@/lib/env-check"

let configured = false

function ensureCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error("Media uploads are not configured (Cloudinary env vars missing)")
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    configured = true
  }
}

export async function uploadFileToCloudinary(
  file: File,
  folder = "loops",
): Promise<{ secure_url: string; resource_type: string; public_id: string }> {
  ensureCloudinary()

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const mime = file.type || "application/octet-stream"

  let resourceType: "image" | "video" | "raw" = "raw"
  if (mime.startsWith("image/")) resourceType = "image"
  else if (mime.startsWith("video/") || mime.startsWith("audio/")) resourceType = "video"

  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    overwrite: false,
  })

  return {
    secure_url: result.secure_url,
    resource_type: result.resource_type,
    public_id: result.public_id,
  }
}
