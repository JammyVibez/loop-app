import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireModerator } from "@/lib/server-auth";

async function getUserFromToken(token: string) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// PUT /api/moderation/flags/[id] - Update a content flag (admin/moderator only)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, response } = await requireModerator(request);
    if (response || !user) return response;

    const supabase = createServerClient();

    const { status, action_taken, moderator_notes } = await request.json();

    // Validate required fields
    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Update content flag
    const { data: flag, error: updateError } = await supabase
      .from("content_flags")
      .update({
        status,
        action_taken: action_taken || null,
        moderator_id: user.id,
        moderator_notes: moderator_notes || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json({ error: "Failed to update content flag" }, { status: 500 });
    }

    // If the flag resulted in user suspension, update the user
    if (action_taken === "user_suspended" && flag.content_id) {
      const { error: userUpdateError } = await supabase
        .from("profiles")
        .update({ 
          is_banned: true,
          banned_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        })
        .eq("id", flag.content_id);

      if (userUpdateError) {
        console.error("Failed to suspend user:", userUpdateError);
      }
    }

    // If the flag resulted in content removal, we would delete or hide the content here
    // This would depend on the content_type of the flag

    return NextResponse.json({
      success: true,
      flag,
    });
  } catch (error) {
    console.error("Error updating content flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/moderation/flags/[id] - Get a specific content flag (admin/moderator only)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { response } = await requireModerator(request);
    if (response) return response;

    const supabase = createServerClient();

    // Fetch content flag
    const { data: flag, error } = await supabase
      .from("content_flags")
      .select(`
        *,
        reporter:profiles!reporter_id(username, display_name, avatar_url),
        content:profiles!content_id(username, display_name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: "Failed to fetch content flag" }, { status: 500 });
    }

    if (!flag) {
      return NextResponse.json({ error: "Content flag not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      flag,
    });
  } catch (error) {
    console.error("Error fetching content flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
