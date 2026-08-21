import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/accounts/switch
 * Switch to a linked account by replaying the stored Set-Cookie header.
 * Body: { targetUserId: string }
 * When targetUserId === "primary", switches back to the primary account.
 */
export async function POST(req: NextRequest) {
  try {
    // Use getUserFromRequest which reads the session via Better Auth's API
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const currentUserId = user.id;
    const { targetUserId } = await req.json();

    // Use service-role client to bypass RLS — linked_accounts rows are owned
    // by the primary user, so the linked user can't read them via normal client.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // If switching back to primary, restore primary's stored session
    if (targetUserId === 'primary') {
      // Find the link where current user is the linked user (owner_id is the primary)
      const { data: link, error: linkError } = await admin
        .from('linked_accounts')
        .select('primary_session, owner_id')
        .eq('linked_user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (linkError || !link) {
        console.error('Switch to primary - link query error:', linkError);
        return NextResponse.json({ error: 'No linked account found' }, { status: 404 });
      }

      const primaryCookieHeader = link.primary_session;
      const primaryUserId = link.owner_id;

      if (!primaryCookieHeader) {
        return NextResponse.json({ error: 'Primary session cookie not stored. Please unlink and re-add.' }, { status: 400 });
      }

      // Update last_used_at
      await admin
        .from('linked_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('linked_user_id', currentUserId);

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
    const { data: linkCheck, error: checkError } = await admin
      .from('linked_accounts')
      .select('refresh_token, primary_session')
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId)
      .limit(1)
      .maybeSingle();

    if (checkError || !linkCheck) {
      console.error('Switch to linked - link query error:', checkError);
      return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
    }

    const linkedSetCookie = linkCheck.refresh_token;
    if (!linkedSetCookie) {
      return NextResponse.json({ error: 'No session stored for this account. Please unlink and re-add.' }, { status: 400 });
    }

    // If the primary user's session cookie hasn't been stored yet, store it now
    if (!linkCheck.primary_session) {
      // Get the raw token from the cookie for constructing the header
      const rawToken = extractTokenFromCookie(req.headers.get('cookie') || '');
      if (rawToken) {
        const baCookieHeader = `better-auth.session_token=${rawToken}; Path=/; HttpOnly; SameSite=Lax`;
        await admin
          .from('linked_accounts')
          .update({ primary_session: baCookieHeader })
          .eq('owner_id', currentUserId)
          .eq('linked_user_id', targetUserId);
      }
    }

    // Update last_used_at
    await admin
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

/** Extract the better-auth session token value from the raw Cookie header */
function extractTokenFromCookie(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  return match ? match[1] : null;
}
