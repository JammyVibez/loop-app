import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const SKILL_LEVELS = new Set(["beginner", "intermediate", "advanced", "expert"])
const MAX_SKILLS = 20

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const [{ data: skills }, { data: portfolio }] = await Promise.all([
      supabase
        .from("developer_skills")
        .select("id, skill_name, skill_level, years_experience")
        .eq("user_id", user.id)
        .order("skill_name", { ascending: true }),
      supabase.from("developer_portfolios").select("*").eq("user_id", user.id).maybeSingle(),
    ])

    return NextResponse.json({
      success: true,
      skills: skills || [],
      portfolio: portfolio || null,
    })
  } catch (error) {
    console.error("Developer profile GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const supabase = createServerClient()

    // ---- Skills: replace the user's list (unique per skill_name) ----
    if (Array.isArray(body.skills)) {
      const skills = body.skills
        .filter(
          (s: any) =>
            s && typeof s.skill_name === "string" && s.skill_name.trim() && SKILL_LEVELS.has(s.skill_level || "beginner"),
        )
        .slice(0, MAX_SKILLS)
        .map((s: any) => ({
          skill_name: s.skill_name.trim().slice(0, 100),
          skill_level: s.skill_level || "beginner",
          years_experience: Math.max(0, Math.min(60, Number(s.years_experience) || 0)),
        }))

      const names = skills.map((s: any) => s.skill_name)
      const { data: existing } = await supabase
        .from("developer_skills")
        .select("id, skill_name")
        .eq("user_id", user.id)

      const existingByName = new Map((existing || []).map((e: any) => [e.skill_name, e.id]))
      for (const skill of skills) {
        const currentId = existingByName.get(skill.skill_name)
        if (currentId) {
          await supabase.from("developer_skills").update(skill).eq("id", currentId)
        } else {
          await supabase.from("developer_skills").insert({ ...skill, user_id: user.id })
        }
      }
      // Remove skills the user dropped.
      const keepNames = new Set(names)
      for (const row of existing || []) {
        if (!keepNames.has(row.skill_name)) {
          await supabase.from("developer_skills").delete().eq("id", row.id)
        }
      }
    }

    // ---- Portfolio: single row per user ----
    const portfolioPatch: Record<string, unknown> = {}
    const textFields: Array<[string, number]> = [
      ["title", 255],
      ["description", 5000],
      ["website_url", 500],
      ["github_url", 500],
      ["linkedin_url", 500],
      ["resume_url", 500],
      ["currency", 8],
    ]
    for (const [field, max] of textFields) {
      if (typeof body[field] === "string") {
        const value = body[field].trim()
        portfolioPatch[field] = value ? value.slice(0, max) : null
      }
    }
    if (Array.isArray(body.skills_list)) {
      portfolioPatch.skills = body.skills_list.map(String).filter(Boolean).slice(0, 30)
    }
    if (typeof body.experience_years === "number") {
      portfolioPatch.experience_years = Math.max(0, Math.min(60, body.experience_years))
    }
    if (body.hourly_rate !== undefined && body.hourly_rate !== null && body.hourly_rate !== "") {
      portfolioPatch.hourly_rate = Math.max(0, Number(body.hourly_rate) || 0)
    }
    if (typeof body.is_available_for_hire === "boolean") {
      portfolioPatch.is_available_for_hire = body.is_available_for_hire
    }

    if (Object.keys(portfolioPatch).length) {
      const { error } = await supabase
        .from("developer_portfolios")
        .upsert({ user_id: user.id, ...portfolioPatch }, { onConflict: "user_id" })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const [{ data: skills }, { data: portfolio }] = await Promise.all([
      supabase
        .from("developer_skills")
        .select("id, skill_name, skill_level, years_experience")
        .eq("user_id", user.id)
        .order("skill_name", { ascending: true }),
      supabase.from("developer_portfolios").select("*").eq("user_id", user.id).maybeSingle(),
    ])

    return NextResponse.json({ success: true, skills: skills || [], portfolio: portfolio || null })
  } catch (error) {
    console.error("Developer profile PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
