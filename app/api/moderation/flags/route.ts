import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

async function getUserFromToken(token: string) {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// POST /api/moderation/flags - Create a new content flag
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { content_type, content_id, flag_type, description } = await request.json();

    // Validate required fields
    if (!content_type || !content_id || !flag_type) {
      return NextResponse.json(
        { error: "Content type, content ID, and flag type are required" },
        { status: 400 }
      );
    }

    // Create content flag
    const supabase = createClient();
    const { data: flag, error: insertError } = await supabase
      .from("content_flags")
      .insert({
        content_type,
        content_id,
        reporter_id: user.id,
        flag_type,
        description: description || "",
        status: "pending",
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json({ error: "Failed to create content flag" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      flag,
    });
  } catch (error) {
    console.error("Error creating content flag:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/moderation/flags - Get content flags (admin only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user is admin or moderator
    const supabase = createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin, is_verified")
      .eq("id", user.id)
      .single();

    if (profileError || (!profile?.is_admin && !profile?.is_verified)) {
      return NextResponse.json({ error: "Admin or moderator access required" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch content flags
    let query = supabase
      .from("content_flags")
      .select(`
        *,
        reporter:profiles!reporter_id(username, display_name, avatar_url),
        content:profiles!content_id(username, display_name, avatar_url)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: flags, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: "Failed to fetch content flags" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      flags: flags || [],
      hasMore: flags?.length === limit,
    });
  } catch (error) {
    console.error("Error fetching content flags:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
