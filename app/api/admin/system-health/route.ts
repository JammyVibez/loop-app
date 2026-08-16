import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { fetchSystemHealth } from "@/lib/system-health"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const health = await fetchSystemHealth()

    return NextResponse.json({ success: true, ...health })
  } catch (error) {
    console.error("System health fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch system health" }, { status: 500 })
  }
}
