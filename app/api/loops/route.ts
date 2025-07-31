import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { FormData } from "formdata-node"
import fetch from "node-fetch"

// Initialize Supabase client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
async function uploadToCloudinary(file: File, resourceType: "image" | "video" | "raw" = "raw") {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET!)
  formData.append("resource_type", resourceType)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
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
        author:profiles(id, username, display_name, avatar_url, is_verified, verification_level, is_premium),
        loop_stats(likes, branches, comments, saves, views),
        branches:loops!parent_id(
          id,
          author:profiles(id, username, display_name, avatar_url),
          content,
          created_at,
          loop_stats(likes, branches, comments)
        )
      `)
      .is("parent_id", null) // Only root loops
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

    const formData = await request.formData()
    const content = formData.get("content") as string
    const title = formData.get("title") as string
    const type = formData.get("type") as string
    const file = formData.get("file") as File | null

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
        content: loopContent,
        parent_id: null,
        circle_id: null,
      })
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified, verification_level, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create loop" }, { status: 500 })
    }

    // Initialize loop stats
    await supabase.from("loop_stats").insert({
      loop_id: loop.id,
      likes: 0,
      branches: 0,
      comments: 0,
      saves: 0,
      views: 0,
    })

    return NextResponse.json({
      success: true,
      loop,
    })
  } catch (error) {
    console.error("Error creating loop:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
