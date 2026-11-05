import { type NextRequest, NextResponse } from "next/server"
import { auth, authDbPool } from "@/lib/auth"
import { getBearerToken } from "@/lib/server-auth"
import { readLegalAcceptance, recordLegalAcceptance } from "@/lib/legal-acceptance"

export const dynamic = "force-dynamic"

/**
 * Same contract as the Rust API's `legal/acceptance` route.
 *
 * The consent screen talks to /api/v1/legal/acceptance, and next.config only
 * proxies /api/v1 to the Rust service when RUST_API_ORIGIN is configured. On a
 * deployment without it every call 404s, so the gate could never read a status
 * or record an agreement. Serving the identical contract here keeps the flow
 * working in both setups.
 */

type AcceptanceBody = { terms_accepted?: unknown; privacy_acknowledged?: unknown }

async function resolveAuthUserId(request: NextRequest): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session?.user?.id) return session.user.id
  } catch {
    // Fall through to the bearer-token lookup below.
  }

  const token = getBearerToken(request)
  if (!token) return null

  const { rows } = await authDbPool.query<{ userId: string }>(
    'SELECT s."userId" FROM "session" s WHERE s.token = $1 AND s."expiresAt" > NOW()',
    [token],
  )
  return rows[0]?.userId ?? null
}

function unauthorized() {
  return NextResponse.json(
    { error: "unauthorized", message: "Sign in to continue." },
    { status: 401 },
  )
}

function unavailable() {
  return NextResponse.json(
    {
      error: "legal_acceptance_unavailable",
      message: "We could not save your agreement right now. Please try again.",
    },
    { status: 503 },
  )
}

export async function GET(request: NextRequest) {
  const authUserId = await resolveAuthUserId(request)
  if (!authUserId) return unauthorized()

  try {
    const status = await readLegalAcceptance(authUserId)
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Could not read legal acceptance:", error)
    return unavailable()
  }
}

export async function POST(request: NextRequest) {
  const authUserId = await resolveAuthUserId(request)
  if (!authUserId) return unauthorized()

  let body: AcceptanceBody
  try {
    body = (await request.json()) as AcceptanceBody
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "A JSON body is required." },
      { status: 400 },
    )
  }

  // Agreement can only be recorded once the operator's legal and privacy
  // details are published; otherwise the documents users would agree to are
  // incomplete.
  let status
  try {
    status = await readLegalAcceptance(authUserId)
  } catch (error) {
    console.error("Could not read legal acceptance:", error)
    return unavailable()
  }

  if (!status.publication_ready) {
    return NextResponse.json(
      {
        error: "legal_publication_incomplete",
        message:
          "The service operator has not completed the required legal and privacy publication details. Agreement has not been recorded.",
      },
      { status: 503 },
    )
  }

  if (body?.terms_accepted !== true || body?.privacy_acknowledged !== true) {
    return NextResponse.json(
      {
        error: "legal_acceptance_required",
        message: "Agree to the Terms of Service and acknowledge the Privacy Policy to continue.",
      },
      { status: 422 },
    )
  }

  try {
    await recordLegalAcceptance(authUserId)
    return NextResponse.json(await readLegalAcceptance(authUserId), { status: 201 })
  } catch (error) {
    console.error("Could not record legal acceptance:", error)
    return unavailable()
  }
}
