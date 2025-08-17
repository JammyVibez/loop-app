
import { NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from 'cloudinary'
import { createClient } from "@supabase/supabase-js"

// Configure Cloudinary
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary configuration:', {
    cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
    api_key: !!process.env.CLOUDINARY_API_KEY,
    api_secret: !!process.env.CLOUDINARY_API_SECRET,
  })
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

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

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error('Auth verification error:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    
    const authHeader = request.headers.get("authorization")
    console.log('Auth header:', authHeader ? 'Present' : 'Missing')
    
    if (!authHeader) {
      console.log('No authorization header provided')
      return NextResponse.json({ error: "Unauthorized - No auth header" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    console.log('Extracted token length:', token.length)
    
    const user = await getUserFromToken(token)
    console.log('User from token:', user ? 'Found' : 'Not found')

    if (!user) {
      console.log('Invalid or expired token')
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'image', 'video', 'audio'
    const folder = formData.get('folder') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    let uploadResult

    try {
      // Upload to Cloudinary based on type
      if (type === 'image') {
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/images`,
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        })
      } else if (type === 'video') {
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/videos`,
          resource_type: 'video',
          transformation: [
            { width: 1920, height: 1080, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        })
      } else if (type === 'audio') {
        // Cloudinary supports audio files
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/audio`,
          resource_type: 'video', // Cloudinary treats audio as video resource
          transformation: [
            { quality: 'auto' }
          ]
        })
      } else {
        // Default handling for other file types
        uploadResult = await cloudinary.uploader.upload(base64, {
          folder: `loop-app/${folder}/files`,
          resource_type: 'auto'
        })
      }

      // Save to database
      const supabase = createServerClient()
      const { data: mediaRecord, error: dbError } = await supabase
        .from('media_uploads')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          cloudinary_public_id: uploadResult.public_id,
          cloudinary_url: uploadResult.secure_url,
          media_type: type,
          folder: folder,
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration,
          format: uploadResult.format
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
        { error: "Failed to upload file", details: cloudinaryError },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get('public_id')

    if (!publicId) {
      return NextResponse.json({ error: "Public ID required" }, { status: 400 })
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId)

    // Delete from database
    const supabase = createServerClient()
    await supabase
      .from('media_uploads')
      .delete()
      .eq('cloudinary_public_id', publicId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Delete error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
