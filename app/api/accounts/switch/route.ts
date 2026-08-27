import { NextResponse } from 'next/server';
import { } from '@/lib/server-auth';
import { } from '@supabase/supabase-js';

/**
 * POST /api/accounts/switch
 * Switch to a linked account by forwarding the stored Set-Cookie header.
 * Body: { targetUserId: string }
 * When targetUserId === "primary", switches back to the primary account.
 *
 * Uses the exact same pattern as the login route: forwards the raw
 * Set-Cookie header from Better Auth's signInEmail response.
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
        .select('primary_session, owner_id')
        .eq('linked_user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (linkError || !link) {
        return NextResponse.json({ error: 'No linked account found' }, { status: 404 });
      }

      const primaryCookie = link.primary_session;
      if (!primaryCookie) {
        return NextResponse.json(
          { error: 'Primary session not stored. Please unlink and re-link.' },
          { status: 400 }
        );
      }

      await admin
        .from('linked_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('linked_user_id', currentUserId);

      // Forward the stored Set-Cookie header EXACTLY — same as login route
      const response = NextResponse.json({
        success: true,
        userId: link.owner_id,
      });
      response.headers.set('set-cookie', primaryCookie);
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
      return NextResponse.json({ error: 'Account not linked' }, { status: 404 });
    }

    const linkedCookie = linkCheck.refresh_token;
    if (!linkedCookie) {
      return NextResponse.json(
        { error: 'No session stored. Please unlink and re-link.' },
        { status: 400 }
      );
    }

    // Store the primary user's Set-Cookie if not yet stored
    if (!linkCheck.primary_session) {
      const primaryCookie = req.headers.get('set-cookie') || '';
      if (primaryCookie) {
        await admin
          .from('linked_accounts')
          .update({ primary_session: primaryCookie })
          .eq('owner_id', currentUserId)
          .eq('linked_user_id', targetUserId);
      }
    }

    await admin
      .from('linked_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('owner_id', currentUserId)
      .eq('linked_user_id', targetUserId);

    // Forward the stored Set-Cookie header EXACTLY — same as login route
    const response = NextResponse.json({
      success: true,
      userId: targetUserId,
    });
    response.headers.set('set-cookie', linkedCookie);
    return response;
  } catch (error: any) {
    console.error('Account switch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to switch account' }, { status: 500 });
  }
}
