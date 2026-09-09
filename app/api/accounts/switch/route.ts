import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';
import { auth, authDbPool } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * POST /api/accounts/switch
 * Switch the active session to a linked account (or back to the primary one).
 *
 * Why we mint a FRESH session instead of replaying a stored cookie:
 * Better Auth rotates session tokens on every authenticated use, so any
 * token stored at link time is dead by the time the user wants to switch —
 * the browser would send an invalid cookie and every request would 401,
 * which looked like "switching logs me out completely".
 *
 * Instead we create a brand-new session row for the target user in Better
 * Auth's session table and set its token as the session cookie. The new
 * token is live from the moment it's issued, so the switch always works.
 *
 * Body: { targetUserId: string } — "primary" switches back to the owner.
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function buildSessionCookie(req: NextRequest, token: string): string {
  const rawCookieHeader = req.headers.get('cookie') || '';
  const prefixMatch = rawCookieHeader.match(/(__Secure-)?better-auth\.session_token/);
  const prefix = prefixMatch ? (prefixMatch[1] || '') : '';
  const isSecure = req.nextUrl.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${prefix}better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
}

async function mintFreshSession(userId: string): Promise<{ token: string; expiresAt: Date } | null> {
  // Confirm the target user actually exists.
  const userRes = await authDbPool.query('SELECT id FROM "user" WHERE id = $1 LIMIT 1;', [userId]);
  if (!userRes.rows[0]) return null;

  const token = generateSessionToken();
  // Match Better Auth's default session lifetime (7 days) unless configured.
  const expiresInDays = Number(process.env.BETTER_AUTH_SESSION_EXPIRES_DAYS || 7);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000);

  await authDbPool.query(
    `INSERT INTO "session" ("id", "token", "userId", "expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent")
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW(), NULL, 'account-switch')`,
    [token, userId, expiresAt.toISOString()]
  );

  return { token, expiresAt };
}

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

    // Service-role client to bypass RLS on linked_accounts.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve which account we're switching TO.
    let resolvedUserId: string;

    // First, figure out who owns this group of accounts.
    const { data: asLinked } = await admin
      .from('linked_accounts')
      .select('owner_id')
      .eq('linked_user_id', currentUserId)
      .limit(1)
      .maybeSingle();

    const ownerId = asLinked?.owner_id || currentUserId;

    if (targetUserId === 'primary') {
      // === SWITCH BACK TO PRIMARY ===
      resolvedUserId = ownerId;
    } else {
      // === SWITCH TO LINKED ACCOUNT ===
      const { data: linkCheck, error: checkError } = await admin
        .from('linked_accounts')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('linked_user_id', targetUserId)
        .limit(1)
        .maybeSingle();

      if (checkError || !linkCheck) {
        return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
      }
      resolvedUserId = targetUserId;
    }

    if (resolvedUserId === currentUserId) {
      return NextResponse.json({ success: true, userId: currentUserId, message: 'Already active' });
    }

    // Mint a guaranteed-live session for the target account.
    const session = await mintFreshSession(resolvedUserId);
    if (!session) {
      return NextResponse.json({ error: 'Target account not found' }, { status: 404 });
    }

    await admin
      .from('linked_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .or(
        targetUserId === 'primary'
          ? `linked_user_id.eq.${currentUserId}`
          : `and(owner_id.eq.${ownerId},linked_user_id.eq.${targetUserId})`
      );

    const response = NextResponse.json({
      success: true,
      userId: resolvedUserId,
    });
    response.headers.set('set-cookie', buildSessionCookie(req, session.token));
    return response;
  } catch (error: any) {
    console.error('Account switch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to switch account' }, { status: 500 });
  }
}
