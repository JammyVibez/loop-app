/**
 * Consolidated API handler utilities.
 *
 * Usage — wrap any Next.js App Router handler to get:
 *   - Automatic try/catch with consistent JSON error responses
 *   - Optional auth gating (withUser, withAdmin, withModerator)
 *   - Typed context passing (user, profile, supabase client)
 *
 * Example:
 *   import { withUser } from "@/lib/api-handler"
 *
 *   export const POST = withUser(async (request, { user }) => {
 *     return NextResponse.json({ success: true, userId: user.id })
 *   })
 */

import { type NextRequest, NextResponse } from "next/server"
import {
  getUserFromRequest,
  requireUser,
  requireAdmin,
  requireModerator,
} from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Minimal user shape returned by our auth helpers. */
export interface AuthUser {
  id: string
  email?: string
  name?: string
  user_metadata?: {
    username?: string
    display_name?: string
    avatar_url?: string | null
  }
}

/** Profile row from the profiles table. */
export interface AuthProfile {
  id: string
  is_admin?: boolean
  is_moderator?: boolean
  is_verified?: boolean
  is_premium?: boolean
  username?: string
  display_name?: string
  avatar_url?: string | null
}

/** Context passed to wrapped handlers. */
export interface HandlerContext {
  /** Authenticated user (always present in withUser/withAdmin/withModerator). */
  user: AuthUser
  /** Profile row from the database (present in withAdmin/withModerator). */
  profile?: AuthProfile | null
  /** Pre-created Supabase server client for convenience. */
  supabase: ReturnType<typeof createServerClient>
}

/** Inner handler signature — receives request + context. */
type HandlerFn<T extends HandlerContext = HandlerContext> = (
  request: NextRequest,
  ctx: T,
) => Promise<NextResponse> | NextResponse

/** Handler with dynamic route params (e.g. [id], [circleId]). */
export type Params = Record<string, string>
type ParamsHandlerFn<T extends HandlerContext = HandlerContext> = (
  request: NextRequest,
  ctx: T & { params: Promise<Params> },
) => Promise<NextResponse> | NextResponse

/* -------------------------------------------------------------------------- */
/*  Error helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Standardized error response. Always returns JSON. */
export function apiError(
  message: string,
  status: number = 500,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}

/** Standardized success response. */
export function apiSuccess(
  data: Record<string, unknown>,
  status: number = 200,
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

/* -------------------------------------------------------------------------- */
/*  Base wrapper (no auth)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a handler with automatic try/catch. No auth gating.
 * The handler receives a pre-created Supabase client.
 *
 *   export const GET = withHandler(async (req, ctx) => { ... })
 */
export function withHandler(handler: HandlerFn<HandlerContext>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = createServerClient()
      return await handler(request, { user: null as unknown as AuthUser, supabase })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * Wraps a handler with auth gating. Returns 401 if not authenticated.
 *
 *   export const POST = withUser(async (req, { user }) => { ... })
 */
export function withUser(handler: HandlerFn<HandlerContext>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const { user, response } = await requireUser(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, supabase })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * Wraps a handler with admin auth gating. Returns 401/403 if not authorized.
 *
 *   export const DELETE = withAdmin(async (req, { user, profile, supabase }) => { ... })
 */
export function withAdmin(handler: HandlerFn<HandlerContext & { profile: AuthProfile }>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const { user, profile, response } = await requireAdmin(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, profile: profile as AuthProfile, supabase })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * Wraps a handler with moderator auth gating. Returns 401/403 if not authorized.
 *
 *   export const POST = withModerator(async (req, { user, profile }) => { ... })
 */
export function withModerator(handler: HandlerFn<HandlerContext & { profile: AuthProfile }>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const { user, profile, response } = await requireModerator(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, profile: profile as AuthProfile, supabase })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Params-aware wrappers (for dynamic routes like [id], [circleId])            */
/* -------------------------------------------------------------------------- */

/**
 * withHandler + dynamic params.
 *
 *   export const GET = withHandlerParams(async (req, { params, supabase }) => {
 *     const { id } = await params
 *   })
 */
export function withHandlerParams(handler: ParamsHandlerFn<HandlerContext>) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<Params> },
  ): Promise<NextResponse> => {
    try {
      const supabase = createServerClient()
      return await handler(request, { user: null as unknown as AuthUser, supabase, params })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * withUser + dynamic params.
 */
export function withUserParams(handler: ParamsHandlerFn<HandlerContext>) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<Params> },
  ): Promise<NextResponse> => {
    try {
      const { user, response } = await requireUser(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, supabase, params })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * withAdmin + dynamic params.
 */
export function withAdminParams(handler: ParamsHandlerFn<HandlerContext & { profile: AuthProfile }>) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<Params> },
  ): Promise<NextResponse> => {
    try {
      const { user, profile, response } = await requireAdmin(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, profile: profile as AuthProfile, supabase, params })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/**
 * withModerator + dynamic params.
 */
export function withModeratorParams(handler: ParamsHandlerFn<HandlerContext & { profile: AuthProfile }>) {
  return async (
    request: NextRequest,
    { params }: { params: Promise<Params> },
  ): Promise<NextResponse> => {
    try {
      const { user, profile, response } = await requireModerator(request)
      if (response) return response

      const supabase = createServerClient()
      return await handler(request, { user: user!, profile: profile as AuthProfile, supabase, params })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Internal server error"
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}:`, msg)
      return apiError(msg, 500)
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Legacy helpers — keep existing patterns working                            */
/* -------------------------------------------------------------------------- */

export { getUserFromRequest, requireUser, requireAdmin, requireModerator }
