import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/server-auth';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/accounts/switch
 * Switch to a linked account by setting the stored raw session token as a cookie.
 * Body: { targetUserId: string }
 * When targetUserId === "primary", switches back to the primary account.
 *
 * The raw token is the value Better Auth puts in the session cookie.
 * When we set it as the cookie, Better Auth's API/middleware will hash it
 * and look it up in the session table — finding the existing session row.
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
      // Find the link where current user is the linked user
      const { data: link, error: linkError } = await admin
        .from('linked_accounts')
        .select('primary_session, owner_id')
        .eq('linked_user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (linkError || !link) {
        console.error('Switch to primary - not found:', linkError);
        return NextResponse.json({ error: 'No linked account found' }, { status: 404 });
      }

      const primaryToken = link.primary_session;
      if (!primaryToken) {
        return NextResponse.json(
          { error: 'Primary session not stored. Please unlink and re-link this account.' },
          { status: 400 }
        );
      }

      // Update last_used_at
      await admin
        .from('linked_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('linked_user_id', currentUserId);

      // Build response with fresh cookie
      const response = NextResponse.json({
        success: true,
        userId: link.owner_id,
      });

      // Set the primary user's raw token as a fresh cookie
      response.cookies.set('better-auth.session_token', primaryToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        // Don't set secure in dev (localhost)
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    }

    // === SWITCH TO LINKED ACCOUNT ===
    const { data: linkCheck, error: checkError } = await admin
      .from('linked_accounts')
      .select('refresh_token, primary_session')
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId)
      .limit(1)
      .maybeSingle();

    if (checkError || !linkCheck) {
      console.error('Switch to linked - not found:', checkError);
      return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
    }

    const linkedToken = linkCheck.refresh_token;
    if (!linkedToken) {
      return NextResponse.json(
        { error: 'No session stored for this account. Please unlink and re-link.' },
        { status: 400 }
      );
    }

    // If the primary user's token hasn't been stored yet, store it now
    if (!linkCheck.primary_session) {
      const reqCookie = req.headers.get('cookie') || '';
      const cookieMatch = reqCookie.match(/better-auth\.session_token=([^;]+)/);
      if (cookieMatch) {
        await admin
          .from('linked_accounts')
          .update({ primary_session: cookieMatch[1] })
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

    // Build response with fresh cookie
    const response = NextResponse.json({
      success: true,
      userId: targetUserId,
    });

    // Set the linked user's raw token as a fresh cookie
    response.cookies.set('better-auth.session_token', linkedToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Account switch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to switch account' }, { status: 500 });
  }
}
