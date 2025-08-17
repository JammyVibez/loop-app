import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Helper function to get user from token
async function getUserFromToken(token: string) {
  try {
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
    throw new Error("Failed to upload file")
  }

  return await response.json()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const type = searchParams.get("type") // 'following', 'trending', 'recent'
    const userId = searchParams.get("user_id")

    let query = supabase
      .from("loops")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, branches_count, comments_count, shares_count, views_count),
        branches:loops!parent_loop_id(
          id,
          author:profiles(id, username, display_name, avatar_url),
          content,
          media_url,
          media_type,
          created_at,
          loop_stats(likes_count, branches_count, comments_count)
        )
      `)
      .is("parent_loop_id", null) // Only root loops
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId && type === "following") {
      // Get loops from users that the current user follows
      const { data: following } = await supabase.from("follows").select("following_id").eq("follower_id", userId)

      if (following && following.length > 0) {
        const followingIds = following.map((f) => f.following_id)
        query = query.in("author_id", followingIds)
      } else {
        // If not following anyone, return empty array
        return NextResponse.json({ success: true, loops: [], hasMore: false })
      }
    }

    const { data: loops, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch loops" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      loops: loops || [],
      hasMore: loops?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching loops:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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

   let content: string | null = null
    let title: string | null = null
    let type: string | null = null
    let file: File | null = null

    // 🔥 Detect if request is JSON or multipart
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      // Handle JSON body
      const body = await request.json()
      content = body.content ?? null
      title = body.title ?? null
      type = body.type ?? null
    } else if (contentType.includes("multipart/form-data")) {
      // Handle form-data body
      const formData = await request.formData()
      content = formData.get("content") as string
      title = formData.get("title") as string
      type = formData.get("type") as string
      file = formData.get("file") as File | null
    } else {
      return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 400 })
    }

    if (!content && !file) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }


    let fileUrl = null
    let fileType = null
    let fileName = null

    // Upload file if provided
    if (file) {
      try {
        let resourceType: "image" | "video" | "raw" = "raw"

        if (file.type.startsWith("image/")) {
          resourceType = "image"
          fileType = "image"
        } else if (file.type.startsWith("video/")) {
          resourceType = "video"
          fileType = "video"
        } else if (file.type.startsWith("audio/")) {
          resourceType = "video" // Cloudinary handles audio as video
          fileType = "audio"
        } else {
          fileType = "file"
        }

        const uploadResult = await uploadToCloudinary(file, resourceType)
        fileUrl = uploadResult.secure_url
        fileName = file.name
      } catch (uploadError) {
        console.error("File upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
      }
    }

    // Create loop content object
    const loopContent: any = {
      type: fileType || type,
      text: content || null,
      title: title || null,
    }

    if (fileUrl) {
      switch (fileType) {
        case "image":
          loopContent.image_url = fileUrl
          loopContent.caption = content
          break
        case "video":
          loopContent.video_url = fileUrl
          loopContent.description = content
          break
        case "audio":
          loopContent.audio_url = fileUrl
          loopContent.description = content
          break
        case "file":
          loopContent.file_url = fileUrl
          loopContent.file_name = fileName
          loopContent.description = content
          break
      }
    }

    // Insert loop into database
    const { data: loop, error: insertError } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content: content,             // store text in content
        media_url: fileUrl || null,   // store uploaded file here
        media_type: fileType || type || "text",
        parent_loop_id: null,
      })
      .select("id") // Only get the new loop id
      .single()

    if (insertError || !loop) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create loop" }, { status: 500 })
    }

    // Initialize loop stats
    await supabase.from("loop_stats").insert({
      loop_id: loop.id,
      likes_count: 0,
      branches_count: 0,
      comments_count: 0,
      shares_count: 0,
      views_count: 0,
    })

    // Fetch the full loop object with author and stats
    const { data: fullLoop, error: fetchError } = await supabase
      .from("loops")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified, is_premium),
        stats:loop_stats(likes_count, branches_count, comments_count, shares_count, views_count)
      `)
      .eq("id", loop.id)
      .single()

    if (fetchError || !fullLoop) {
      console.error("Fetch error after insert:", fetchError)
      return NextResponse.json({ error: "Failed to fetch created loop" }, { status: 500 })
    }

    // Fetch user interactions for this loop
    const { data: interactions, error: interactionError } = await supabase
      .from("loop_interactions")
      .select("interaction_type")
      .eq("user_id", user.id)
      .eq("loop_id", loop.id)

    if (interactionError) {
      console.error("Interaction fetch error:", interactionError)
    }

    // Build user_interactions object from loop_interactions
    fullLoop.user_interactions = {
      is_liked: interactions?.some(i => i.interaction_type === "like") || false,
      is_saved: interactions?.some(i => i.interaction_type === "save") || false,
    }

    return NextResponse.json({
      success: true,
      loop: fullLoop,
    })
  } catch (error) {
    console.error("Error creating loop:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
