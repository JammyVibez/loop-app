import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { countBranchesByUser, resolveBranchLimits } from "@/lib/branch-limits"

export const dynamic = "force-dynamic"

/**
 * The limits a post's branch tree runs under, plus how many branches the
 * current account has already added to the root — so the branch dialog can
 * show "3 of 5 branches used" and disable the submit button at the cap.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const limits = await resolveBranchLimits(supabase, id)

    const user = await getUserFromRequest(request).catch(() => null)
    const branchesUsed =
      user && limits.rootId ? await countBranchesByUser(supabase, limits.rootId, user.id) : 0

    return NextResponse.json({
      success: true,
      max_depth: limits.maxDepth,
      max_branches_per_user: limits.maxPerUser,
      root_id: limits.rootId,
      branches_used: branchesUsed,
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error", details: error?.message }, { status: 500 })
  }
}
