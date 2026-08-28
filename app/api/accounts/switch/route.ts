import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';
import { authDbPool } from '@/lib/auth';

/**
 * Look up a user's current active session token directly from Better Auth's
 * session table. This avoids the stale-cookie problem: Better Auth rotates
 * tokens on each use, so any previously stored Set-Cookie header becomes
 * invalid after the first account switch.
 *
 * Returns the raw session token (not a Set-Cookie header), which we use
 * to construct a fresh cookie below.
 */
async function getActiveSessionToken(userId: string): Promise<string | null> {
  const res = await authDbPool.query(
    'SELECT token FROM "session" WHERE "userId" = $1 AND "expiresAt" > NOW() ORDER BY "createdAt" DESC LIMIT 1;',
    [userId]
  );
  return res.rows[0]?.token || null;
}

/**
 * Build a Set-Cookie header string for the Better Auth session token.
 * Detects the __Secure- prefix from the current request's cookies.
 */
function buildSessionCookie(req: NextRequest, token: string): string {
  const rawCookieHeader = req.headers.get('cookie') || '';
  const prefixMatch = rawCookieHeader.match(/(__Secure-)?better-auth\.session_token/);
  const prefix = prefixMatch ? (prefixMatch[1] || '') : '';
  const isSecure = req.nextUrl.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${prefix}better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

/**
 * POST /api/accounts/switch
 * Switch to a linked account by looking up the target user's current
 * active session from Better Auth's session table.
 * Body: { targetUserId: string }
 * When targetUserId === "primary", switches back to the primary account.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const currentUserId = user.id;
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    // Use service-role client to bypass RLS on linked_accounts
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (targetUserId === 'primary') {
      // === SWITCH BACK TO PRIMARY ===
      const { data: link, error: linkError } = await admin
        .from('linked_accounts')
        .select('owner_id')
        .eq('linked_user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (linkError || !link) {
        return NextResponse.json({ error: 'No linked account found' }, { status: 404 });
      }

      // Look up the primary user's LIVE session from Better Auth
      const primaryToken = await getActiveSessionToken(link.owner_id);
      if (!primaryToken) {
        return NextResponse.json(
          { error: 'Primary account has no active session. Please log in again.' },
          { status: 400 }
        );
      }

      await admin
        .from('linked_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('linked_user_id', currentUserId);

      const response = NextResponse.json({
        success: true,
        userId: link.owner_id,
      });
      response.headers.set('set-cookie', buildSessionCookie(req, primaryToken));
      return response;
    }

    // === SWITCH TO LINKED ACCOUNT ===
    const { data: linkCheck, error: checkError } = await admin
      .from('linked_accounts')
      .select('id')
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId)
      .limit(1)
      .maybeSingle();

    if (checkError || !linkCheck) {
      return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
    }

    // Look up the linked user's LIVE session from Better Auth
    const linkedToken = await getActiveSessionToken(targetUserId);
    if (!linkedToken) {
      return NextResponse.json(
        { error: 'Linked account has no active session. Please re-link this account.' },
        { status: 400 }
      );
    }

    await admin
      .from('linked_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId);

      const response = NextResponse.json({
        success: true,
        userId: targetUserId,
      });
      response.headers.set('set-cookie', buildSessionCookie(req, linkedToken));
      return response;
  } catch (error: any) {
    console.error('Account switch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to switch account' }, { status: 500 });
  }
}
