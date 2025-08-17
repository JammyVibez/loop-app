import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/utils/supabase/server" // Assuming this path is correct for server-side Supabase client

// Initialize Supabase client for server-side operations
// const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Helper function to get user from token
async function getUserFromToken(token: string) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// Helper function to upload file to Cloudinary
async function uploadToCloudinary(file: File, resourceType: "image" | "video" | "raw" = "raw"): Promise<any> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET!)
  formData.append("resource_type", resourceType)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData as any,
    },
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error("Cloudinary upload error details:", errorData)
    throw new Error("Failed to upload file")
  }

  return await response.json()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const userId = searchParams.get("user_id")
    const category = searchParams.get("category")

    const supabase = createServerClient()

    let query = supabase
      .from('loops')
      .select(`
        *,
        author:profiles!author_id(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        ),
        loop_stats(
          likes_count,
          comments_count,
          branches_count,
          shares_count,
          views_count
        )
      `)

    if (userId) {
      query = query.eq('author_id', userId)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: loops, error } = await query
      .is('parent_loop_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Supabase GET error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      loops: loops || [],
      pagination: {
        limit,
        offset,
        total: loops?.length || 0
      }
    })

  } catch (error: any) {
    console.error("Get loops error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const content_text = formData.get("content_text") as string
    const file = formData.get("media") as File | null
    const content_type = formData.get("content_type") as string
    const category = formData.get("category") as string
    const hashtags = formData.get("hashtags") ? JSON.parse(formData.get("hashtags") as string) : []
    const parent_loop_id = formData.get("parent_loop_id") as string | null
    const is_public = formData.get("is_public") ? formData.get("is_public") === "true" : true
    const scheduled_for = formData.get("scheduled_for") as string | null
    const poll_options = formData.get("poll_options") ? JSON.parse(formData.get("poll_options") as string) : null
    const media_metadata = formData.get("media_metadata") ? JSON.parse(formData.get("media_metadata") as string) : null

    if (!content_text?.trim() && !file) {
      return NextResponse.json(
        { error: "Either text content or media is required" },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    let mediaUrl = null
    let mediaType = content_type || 'text' // Default to text if not provided

    if (file) {
      let resourceType: "image" | "video" | "raw" = "raw"

      if (file.type.startsWith("image/")) {
        resourceType = "image"
        mediaType = "image"
      } else if (file.type.startsWith("video/")) {
        resourceType = "video"
        mediaType = "video"
      } else if (file.type.startsWith("audio/")) {
        resourceType = "video" // Cloudinary can handle audio as video
        mediaType = "audio"
      } else {
        mediaType = "file"
      }

      try {
        const uploadResult = await uploadToCloudinary(file, resourceType)
        mediaUrl = uploadResult.secure_url
      } catch (uploadError) {
        console.error("File upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload media" }, { status: 500 })
      }
    }

    // Create the loop
    const { data: loop, error } = await supabase
      .from('loops')
      .insert({
        author_id: user.id,
        content_text: content_text?.trim(),
        content_media_url: mediaUrl,
        content_type: mediaType,
        category: category || 'general',
        hashtags: hashtags || [],
        parent_loop_id,
        is_public,
        scheduled_for,
        poll_options,
        media_metadata
      })
      .select(`
        *,
        author:profiles!author_id(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .single()

    if (error) {
      console.error("Supabase POST error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create initial stats record
    await supabase
      .from('loop_stats')
      .insert({
        loop_id: loop.id,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        views_count: 0,
        branches_count: 0
      })

    // If it's a branch, increment parent's branch count
    if (parent_loop_id) {
      // Ensure increment_loop_branches is a defined RPC function in Supabase
      const { error: rpcError } = await supabase.rpc('increment_loop_branches', { loop_id: parent_loop_id })
      if (rpcError) {
        console.error("Error calling increment_loop_branches:", rpcError.message)
      }

      // Notify parent loop author
      const { data: parentLoop, error: parentLoopError } = await supabase
        .from('loops')
        .select('author_id')
        .eq('id', parent_loop_id)
        .single()

      if (parentLoopError) {
        console.error("Error fetching parent loop:", parentLoopError.message)
      } else if (parentLoop && parentLoop.author_id !== user.id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: parentLoop.author_id,
            type: 'branch',
            title: `${user.user_metadata?.display_name || user.email} branched your loop`,
            message: content_text?.substring(0, 100) + (content_text && content_text.length > 100 ? '...' : ''),
            data: {
              loop_id: loop.id,
              parent_loop_id,
              user_id: user.id
            }
          })
      }
    }

    // Process hashtags
    if (hashtags && hashtags.length > 0) {
      for (const tag of hashtags) {
        const cleanedTag = tag.toString().toLowerCase().trim()
        if (cleanedTag) {
          await supabase
            .from('hashtags')
            .upsert({
              tag: cleanedTag,
              usage_count: 1 // This should ideally be incremented if tag exists
            }, {
              onConflict: 'tag',
              ignoreDuplicates: false
            })
        }
      }
    }

    // Broadcast real-time update
    // Ensure 'loops' channel is correctly subscribed to by clients
    await supabase.channel('loops')
      .send({
        type: 'broadcast',
        event: 'new_loop',
        payload: {
          loop,
          // user_id: user.id // Include user ID if needed by the client
        }
      })

    return NextResponse.json({
      success: true,
      loop
    })

  } catch (error: any) {
    console.error("Create loop error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}