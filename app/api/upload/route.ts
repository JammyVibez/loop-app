
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from "@/lib/supabase";
import { isCloudinaryConfigured } from "@/lib/env-check"
import { getUserFromRequest } from "@/lib/server-auth";

const MAX_UPLOAD_BYTES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 25 * 1024 * 1024,
}

function ensureCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    return false
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  return true
}

// Create server-side Supabase client
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration:', {
      url: !!supabaseUrl,
      key: !!supabaseKey,
    })
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}


export async function POST(request: NextRequest) {
  try {
    if (!ensureCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Media uploads are not configured (Cloudinary env vars missing)" },
        { status: 503 },
      )
    }

    

    
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'image', 'video', 'audio'
    const folder = formData.get('folder') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const maxSize = MAX_UPLOAD_BYTES[type] || MAX_UPLOAD_BYTES.file
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
      }, { status: 413 })
    }

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif', 'image/avif', 'image/bmp']
    const allowedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-m4v',
    ]
    const allowedAudioTypes = [
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
    ]

    const isAllowedAudio =
      allowedAudioTypes.includes(file.type) ||
      (file.type || "").startsWith("audio/") ||
      /\.(webm|mp3|wav|ogg|m4a|aac)$/i.test(file.name || "")

    // Determine actual resource type from MIME if not explicitly provided
    const mimePrefix = (file.type || "").split("/")[0]
    const effectiveType = type || (mimePrefix === "video" ? "video" : mimePrefix === "audio" ? "audio" : mimePrefix === "image" ? "image" : "file")

    // Only validate strict formats when the caller explicitly typed it as image/video/audio
    if (type === 'image' && !allowedImageTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid image format. Supported: JPEG, PNG, GIF, WebP, SVG, HEIC, AVIF, BMP" 
      }, { status: 400 })
    }

    if (type === 'video' && !allowedVideoTypes.includes(file.type) && !(file.type || "").startsWith("video/") && !/\.(mp4|webm|mov|m4v|avi|ogg)$/i.test(file.name || "")) {
      return NextResponse.json({ 
        error: "Invalid video format. Supported: MP4, WebM, OGG, AVI, MOV" 
      }, { status: 400 })
    }

    if (type === 'audio' && !isAllowedAudio) {
      return NextResponse.json({ 
        error: "Invalid audio format. Supported: MP3, WAV, OGG, M4A, WebM" 
      }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    let uploadResult

    try {
      // Upload to Cloudinary based on type (use effectiveType to auto-detect)
      if (effectiveType === 'image') {
        // Special handling for GIFs to preserve animation
        const isGif = file.type === 'image/gif'
        
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/images`,
          resource_type: 'image',
          // Keep GIFs as GIF so avatar/cover animations play
          ...(isGif
            ? {
                format: 'gif',
                transformation: [
                  { width: folder === 'banners' ? 1500 : 800, height: folder === 'banners' ? 500 : 800, crop: 'limit' },
                  { quality: 'auto:good' },
                  { flags: 'animated' },
                ],
              }
            : {
                transformation: [
                  { width: folder === 'banners' ? 1500 : 1200, height: folder === 'banners' ? 500 : 1200, crop: 'limit' },
                  { quality: 'auto' },
                  { format: 'auto' },
                ],
              }),
        })
      } else if (effectiveType === 'video') {
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/videos`,
          resource_type: 'video',
          transformation: [
            { width: 1920, height: 1080, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        })
      } else if (effectiveType === 'audio') {
        // Cloudinary supports audio files
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/audio`,
          resource_type: 'video', // Cloudinary treats audio as video resource
          transformation: [
            { quality: 'auto' }
          ]
        })
      } else {
        // Auto-detect resource type from MIME prefix for unknown types
        const mimeCategory = (file.type || '').split('/')[0]
        const resourceType = mimeCategory === 'image' ? 'image' : mimeCategory === 'video' ? 'video' : mimeCategory === 'audio' ? 'video' : 'auto'
        const folderSuffix = resourceType === 'image' ? 'images' : resourceType === 'video' ? 'videos' : 'files'
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/${folderSuffix}`,
          resource_type: resourceType,
          ...(resourceType === 'image' ? {
            transformation: [
              { width: 1200, height: 1200, crop: 'limit' },
              { quality: 'auto' },
              { format: 'auto' },
            ],
          } : {})
        })
      }

      // Save to database (schema-aligned with the live media_uploads table:
      // file_name / file_type / file_size / cloudinary_public_id /
      // cloudinary_url / media_type / folder / width / height / duration / format).
      const supabase = createServerClient()
      const { data: mediaRecord, error: dbError } = await supabase
        .from('media_uploads')
        .insert({
          user_id: user.id,
          file_name: file.name || 'upload',
          file_type: file.type || type,
          file_size: file.size,
          cloudinary_public_id: uploadResult.public_id,
          cloudinary_url: uploadResult.secure_url,
          media_type: effectiveType,
          folder,
          width: uploadResult.width || null,
          height: uploadResult.height || null,
          duration: uploadResult.duration || null,
          format: uploadResult.format || null,
        })
        .select()
        .single()

      if (dbError) {
        console.error('Database error:', dbError)
        // Don't fail the upload, just log the error
      }

      return NextResponse.json({
        success: true,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        media_type: type,
        width: uploadResult.width,
        height: uploadResult.height,
        duration: uploadResult.duration,
        format: uploadResult.format,
        media_record: mediaRecord
      })

    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError)
      return NextResponse.json(
        {
          error: "Failed to upload file",
          details: process.env.NODE_ENV === "development" ? String(cloudinaryError) : undefined,
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!ensureCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Media uploads are not configured (Cloudinary env vars missing)" },
        { status: 503 },
      )
    }


    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get('public_id')

    if (!publicId) {
      return NextResponse.json({ error: "Public ID required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('media_uploads')
      .select('id, cloudinary_public_id, media_type')
      .eq('cloudinary_public_id', publicId)
      .eq('user_id', user.id)
      .single()

    if (mediaError || !mediaRecord) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: mediaRecord.media_type === 'video' || mediaRecord.media_type === 'audio' ? 'video' : 'image',
    })

    await supabase
      .from('media_uploads')
      .delete()
      .eq('id', mediaRecord.id)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Delete error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
