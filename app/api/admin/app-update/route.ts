import { type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

// GET /api/admin/app-update - Get current app update mode status
export async function GET() {
  try {
    const supabase = createServerClient();
    
    // Check if user is admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get app update mode setting
    const { data: setting, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "app_update_mode")
      .single();

    if (error) {
      console.error("Error fetching app update mode:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch app update mode" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: setting?.setting_value || { enabled: false, message: "App is currently updating" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching app update mode:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// POST /api/admin/app-update - Update app update mode status
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Check if user is admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const { enabled, message, version, update_notes } = await request.json();

    // Update app update mode setting
    const { data, error } = await supabase
      .from("admin_settings")
      .update({ 
        setting_value: { enabled, message, version, update_notes },
        updated_by: session.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("setting_key", "app_update_mode")
      .select()
      .single();

    if (error) {
      console.error("Error updating app update mode:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update app update mode" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data, message: "App update mode updated successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating app update mode:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
