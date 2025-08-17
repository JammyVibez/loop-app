import { type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

// GET /api/admin/settings - Get all admin settings
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

    // Get all settings
    const { data: settings, error } = await supabase
      .from("admin_settings")
      .select("*");

    if (error) {
      throw error;
    }

    // Convert settings array to object
    const settingsObject: Record<string, any> = {};
    settings.forEach(setting => {
      settingsObject[setting.setting_key] = setting.setting_value;
    });

    return new Response(
      JSON.stringify({ success: true, data: settingsObject }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// POST /api/admin/settings - Update admin settings
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

    // Parse request body
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, error: "Settings data is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update each setting
    const updates = Object.entries(settings).map(([key, value]) => 
      supabase
        .from("admin_settings")
        .update({ 
          setting_value: value,
          updated_by: session.user.id,
          updated_at: new Date().toISOString()
        })
        .eq("setting_key", key)
    );

    // Execute all updates
    const results = await Promise.allSettled(updates);
    
    // Check for any errors
    const errors = results.filter(result => result.status === "rejected");
    if (errors.length > 0) {
      console.error("Errors updating settings:", errors);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update some settings" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Settings updated successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating admin settings:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
