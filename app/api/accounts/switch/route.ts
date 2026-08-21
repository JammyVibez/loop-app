import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/accounts/switch
 * Switch to a linked account by replaying the stored Set-Cookie header.
 * Body: { targetUserId: string }
 * When targetUserId === "primary", switches back to the primary account.
 */
export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json();

    // Get current session cookie from request
    const currentSessionCookie = req.headers.get('cookie') || '';

    // Get current authenticated user from Better Auth session cookie
    const baCookieMatch = currentSessionCookie.match(/better-auth\.session_token=([^;]+)/);
    if (!baCookieMatch) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const currentRawToken = baCookieMatch[1];

    const supabase = createServerClient();

    // If switching back to primary, restore primary's stored session
    if (targetUserId === 'primary') {
      // Find the link where current user is the linked user (owner_id is the primary)
      const { data: link, error: linkError } = await supabase
        .from('linked_accounts')
        .select('primary_session, owner_id')
        .eq('linked_user_id', await getCurrentUserId(currentRawToken))
        .limit(1)
        .maybeSingle();

      if (linkError || !link) {
        return NextResponse.json({ error: 'No linked account found' }, { status: 404 });
      }

      const primaryCookieHeader = link.primary_session;
      const primaryUserId = link.owner_id;

      if (!primaryCookieHeader) {
        return NextResponse.json({ error: 'Primary session cookie not stored. Please unlink and re-add.' }, { status: 400 });
      }

      // Update last_used_at
      await supabase
        .from('linked_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('linked_user_id', await getCurrentUserId(currentRawToken));

      // Return the stored Set-Cookie header to restore primary session
      const response = NextResponse.json({
        success: true,
        userId: primaryUserId,
        cookieHeader: primaryCookieHeader,
      });

      // Forward each cookie from the stored header
      const cookies = primaryCookieHeader.split(',').map((c: string) => c.trim());
      for (const cookie of cookies) {
        response.headers.append('Set-Cookie', cookie);
      }

      return response;
    }

    // Normal switch to linked account
    const currentUserId = await getCurrentUserId(currentRawToken);

    const { data: linkCheck, error: checkError } = await supabase
      .from('linked_accounts')
      .select('refresh_token, primary_session')
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId)
      .limit(1)
      .maybeSingle();

    if (checkError || !linkCheck) {
      return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
    }

    const linkedSetCookie = linkCheck.refresh_token;
    if (!linkedSetCookie) {
      return NextResponse.json({ error: 'No session stored for this account. Please unlink and re-add.' }, { status: 400 });
    }

    // If the primary user's session cookie hasn't been stored yet, store it now
    if (!linkCheck.primary_session) {
      const baCookieHeader = `better-auth.session_token=${currentRawToken}; Path=/; HttpOnly; SameSite=Lax`;

      await supabase
        .from('linked_accounts')
        .update({ primary_session: baCookieHeader })
        .eq('owner_id', currentUserId)
        .eq('linked_user_id', targetUserId);
    }

    // Update last_used_at
    await supabase
      .from('linked_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId);

    // Return the stored Set-Cookie header for the linked account
    const response = NextResponse.json({
      success: true,
      userId: targetUserId,
      cookieHeader: linkedSetCookie,
    });

    // Forward each cookie from the stored header
    const cookies = linkedSetCookie.split(',').map((c: string) => c.trim());
    for (const cookie of cookies) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error: any) {
    console.error('Account switch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to switch account' }, { status: 500 });
  }
}

/**
 * Get user ID from Better Auth session token by querying the session table
 * Uses service role to bypass RLS
 */
async function getCurrentUserId(rawToken: string): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try exact token match first, then partial match
  const { data } = await admin
    .from('session')
    .select('userId')
    .eq('token', rawToken)
    .limit(1)
    .maybeSingle();

  if (data?.userId) return data.userId;

  // Partial match fallback (token might be stored with prefix)
  const { data: partial } = await admin
    .from('session')
    .select('userId')
    .like('token', `%${rawToken.substring(0, 20)}%`)
    .limit(1)
    .maybeSingle();

  if (partial?.userId) return partial.userId;

  throw new Error('Could not identify current user from session');
}
