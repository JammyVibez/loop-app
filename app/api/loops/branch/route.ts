import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
    const parentId = formData.get("parent_id") as string
    const file = formData.get("file") as File | null

    if (!content && !file) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }

    if (!parentId) {
      return NextResponse.json({ error: "Parent loop ID is required" }, { status: 400 })
    }

    // Check if parent loop exists
    const { data: parentLoop, error: parentError } = await supabase
      .from("loops")
      .select("id, branch_depth")
      .eq("id", parentId)
      .single()

    if (parentError || !parentLoop) {
      return NextResponse.json({ error: "Parent loop not found" }, { status: 404 })
    }

    // Check branch depth limit (max 10 levels)
    if (parentLoop.branch_depth >= 10) {
      return NextResponse.json({ error: "Maximum branch depth reached" }, { status: 400 })
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
          resourceType = "video"
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

    // Create branch content object
    const branchContent: any = {
      type: fileType || type,
      text: content || null,
      title: title || null,
    }

    if (fileUrl) {
      switch (fileType) {
        case "image":
          branchContent.image_url = fileUrl
          branchContent.caption = content
          break
        case "video":
          branchContent.video_url = fileUrl
          branchContent.description = content
          break
        case "audio":
          branchContent.audio_url = fileUrl
          branchContent.description = content
          break
        case "file":
          branchContent.file_url = fileUrl
          branchContent.file_name = fileName
          branchContent.description = content
          break
      }
    }

    // Insert branch into database
    const { data: branch, error: insertError } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content: branchContent,
        parent_id: parentId,
        branch_depth: parentLoop.branch_depth + 1,
        circle_id: null,
      })
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified, verification_level, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
    }

    // Initialize branch stats
    await supabase.from("loop_stats").insert({
      loop_id: branch.id,
      likes: 0,
      branches: 0,
      comments: 0,
      saves: 0,
      views: 0,
    })

    // Update parent loop branch count
    await supabase.rpc("increment_loop_branches", { loop_id: parentId })

    return NextResponse.json({
      success: true,
      branch,
    })
  } catch (error) {
    console.error("Error creating branch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
