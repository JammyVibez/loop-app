import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { isCloudinaryConfigured } from "@/lib/env-check"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration")
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")
  return createHash("sha1").update(toSign + apiSecret).digest("hex")
}

/**
 * Returns a short-lived Cloudinary signed-upload payload so the browser can
 * POST the file directly to Cloudinary (bypasses Vercel ~4.5MB body limit).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Media uploads are not configured (Cloudinary env vars missing)" },
        { status: 503 },
      )
    }

    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const type = String(body.type || "image")
    const folder = String(body.folder || "general").replace(/[^a-zA-Z0-9_-]/g, "") || "general"

    const sub =
      type === "video" ? "videos" : type === "audio" ? "audio" : type === "file" ? "files" : "images"
    const cloudFolder = `loop-app/${folder}/${sub}`

    const timestamp = Math.round(Date.now() / 1000)
    const paramsToSign: Record<string, string | number> = {
      folder: cloudFolder,
      timestamp,
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET!
    const signature = signParams(paramsToSign, apiSecret)

    const resourceType =
      type === "image" ? "image" : type === "video" || type === "audio" ? "video" : "auto"

    return NextResponse.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder: cloudFolder,
      resourceType,
    })
  } catch (error: any) {
    console.error("Upload sign error:", error)
    return NextResponse.json({ error: "Failed to create upload signature" }, { status: 500 })
  }
}
