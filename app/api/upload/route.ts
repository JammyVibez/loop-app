import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { v2 as cloudinary } from 'cloudinary'
import { v4 as uuidv4 } from 'uuid'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const uploadType = formData.get("type") as string || "general"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Define file type restrictions based on upload type
    const typeRestrictions = {
      avatar: {
        types: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        maxSize: 5 * 1024 * 1024, // 5MB
        folder: "avatars"
      },
      banner: {
        types: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        maxSize: 10 * 1024 * 1024, // 10MB
        folder: "banners"
      },
      reel_video: {
        types: ["video/mp4", "video/webm", "video/quicktime"],
        maxSize: 100 * 1024 * 1024, // 100MB
        folder: "reels/videos"
      },
      reel_image: {
        types: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        maxSize: 10 * 1024 * 1024, // 10MB
        folder: "reels/images"
      },
      reel_audio: {
        types: ["audio/mpeg", "audio/wav", "audio/ogg"],
        maxSize: 20 * 1024 * 1024, // 20MB
        folder: "reels/audio"
      },
      loop_media: {
        types: ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"],
        maxSize: 50 * 1024 * 1024, // 50MB
        folder: "loops"
      },
      stream_thumbnail: {
        types: ["image/jpeg", "image/png", "image/webp"],
        maxSize: 5 * 1024 * 1024, // 5MB
        folder: "streams/thumbnails"
      },
      general: {
        types: ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"],
        maxSize: 25 * 1024 * 1024, // 25MB
        folder: "general"
      }
    }

    const restrictions = typeRestrictions[uploadType as keyof typeof typeRestrictions] || typeRestrictions.general

    // Validate file type
    if (!restrictions.types.includes(file.type)) {
      return NextResponse.json({ 
        error: `Invalid file type. Allowed types: ${restrictions.types.join(', ')}` 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > restrictions.maxSize) {
      const maxSizeMB = restrictions.maxSize / (1024 * 1024)
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${maxSizeMB}MB` 
      }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const uniqueFilename = `${uuidv4()}.${fileExtension}`
    const publicId = `${restrictions.folder}/${user.id}/${uniqueFilename}`

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadOptions: any = {
        public_id: publicId,
        folder: restrictions.folder,
        resource_type: file.type.startsWith('video/') ? 'video' : 
                      file.type.startsWith('audio/') ? 'video' : 'image',
        transformation: []
      }

      // Add transformations based on upload type
      if (uploadType === 'avatar') {
        uploadOptions.transformation = [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      } else if (uploadType === 'banner') {
        uploadOptions.transformation = [
          { width: 1200, height: 400, crop: 'fill' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      } else if (uploadType === 'reel_video') {
        uploadOptions.transformation = [
          { width: 720, height: 1280, crop: 'fill' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      } else if (uploadType === 'stream_thumbnail') {
        uploadOptions.transformation = [
          { width: 640, height: 360, crop: 'fill' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      }

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    const result = uploadResult as any

    // Generate different sized versions for images
    const urls: any = {
      original: result.secure_url,
      public_id: result.public_id
    }

    if (file.type.startsWith('image/')) {
      urls.thumbnail = cloudinary.url(result.public_id, {
        width: 150,
        height: 150,
        crop: 'fill',
        quality: 'auto',
        fetch_format: 'auto'
      })
      
      urls.medium = cloudinary.url(result.public_id, {
        width: 500,
        height: 500,
        crop: 'limit',
        quality: 'auto',
        fetch_format: 'auto'
      })
    }

    // Log upload for analytics
    console.log(`File uploaded: ${file.name} (${file.size} bytes) by user ${user.id}`)

    return NextResponse.json({
      success: true,
      data: {
        url: result.secure_url,
        urls: urls,
        public_id: result.public_id,
        filename: file.name,
        size: file.size,
        type: file.type,
        upload_type: uploadType,
        width: result.width,
        height: result.height,
        duration: result.duration || null
      }
    })

  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ 
      error: "Upload failed",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}

// Delete uploaded file
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get('public_id')

    if (!publicId) {
      return NextResponse.json({ error: "Public ID required" }, { status: 400 })
    }

    // Verify user owns this file (public_id should contain user ID)
    if (!publicId.includes(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId)

    return NextResponse.json({
      success: true,
      data: { result }
    })

  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
