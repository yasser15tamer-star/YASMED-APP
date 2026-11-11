import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "غير مصرح" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "غير مصرح" }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, enabled")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.enabled) {
      return jsonResponse({ error: "صلاحية الإدارة مطلوبة" }, 403);
    }

    const { client_id } = await req.json();
    if (!client_id || typeof client_id !== "string") {
      return jsonResponse({ error: "معرف الحساب غير صالح" }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", client_id)
      .maybeSingle();

    if (targetError) {
      return jsonResponse({ error: "تعذر التحقق من الحساب" }, 500);
    }
    if (!targetProfile || targetProfile.role !== "client") {
      return jsonResponse({ error: "هذا الحساب ليس عميلاً" }, 400);
    }

    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(client_id);
    if (getUserError || !targetUser.user) {
      return jsonResponse({ error: "تعذر العثور على الحساب" }, 404);
    }

    const email = targetUser.user.email?.trim().toLowerCase();
    if (email) {
      const { error: recordError } = await adminClient
        .from("rejected_accounts")
        .upsert({ email, rejected_at: new Date().toISOString() });
      if (recordError) {
        return jsonResponse({ error: "تعذر تسجيل الرفض" }, 500);
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(client_id);
    if (deleteError) {
      return jsonResponse({ error: "تعذر حذف الحساب" }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "خطأ غير متوقع" }, 500);
  }
});
