import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type GuestCompleteSignupBody = {
  email?: string;
  password?: string;
  profileData?: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isAnonymousUser(user: any): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  if (user.app_metadata?.provider === "anonymous") return true;
  if (user.app_metadata?.is_anonymous === true) return true;
  if (user.user_metadata?.is_anonymous === true) return true;
  return false;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const denoEnv = (globalThis as typeof globalThis & {
  Deno?: { env?: { get: (key: string) => string | undefined } };
}).Deno?.env;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "unauthorized" }, 401);
    }

    const supabaseUrl = denoEnv?.get("SUPABASE_URL") ?? "";
    const anonKey = denoEnv?.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    const authedUser = authData.user;

    if (authError || !authedUser) {
      return jsonResponse({ success: false, error: "unauthorized" }, 401);
    }

    if (!isAnonymousUser(authedUser)) {
      return jsonResponse({ success: false, error: "This flow only applies to anonymous users." }, 400);
    }

    const body = await req.json().catch(() => ({} as GuestCompleteSignupBody));
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const profileData = body.profileData && typeof body.profileData === "object" && !Array.isArray(body.profileData)
      ? body.profileData
      : {};

    if (!email || !password) {
      return jsonResponse({ success: false, error: "Email and password are required." }, 400);
    }

    const fullName = typeof profileData.full_name === "string" ? profileData.full_name.trim() : "";
    const username = typeof profileData.username === "string" ? profileData.username.trim() : "";
    const displayName = fullName || username || email;

    const mergedUserMetadata = {
      ...(authedUser.user_metadata ?? {}),
      ...profileData,
      ...(displayName ? { display_name: displayName } : {}),
      ...(fullName ? { full_name: fullName } : {}),
      is_anonymous: false,
    };
    const mergedAppMetadata = {
      ...(authedUser.app_metadata ?? {}),
      provider: "email",
      providers: ["email"],
      is_anonymous: false,
    };

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: updatedUserData, error: updateError } = await serviceClient.auth.admin.updateUserById(
      authedUser.id,
      {
        email,
        password,
        email_confirm: true,
        app_metadata: mergedAppMetadata,
        user_metadata: mergedUserMetadata,
        is_anonymous: false,
      } as any,
    );

    if (updateError) {
      return jsonResponse({ success: false, error: updateError.message }, 400);
    }

    const profileUpdate: Record<string, unknown> = {
      email,
      display_name: displayName,
      updated_at: new Date().toISOString(),
      trial_usage: {},
      free_access_start_at: new Date().toISOString(),
    };

    if (username) {
      profileUpdate.username = username;
    }

    await serviceClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", authedUser.id);

    return jsonResponse({
      success: true,
      user: {
        id: updatedUserData.user?.id ?? authedUser.id,
        email: updatedUserData.user?.email ?? email,
        is_anonymous: (updatedUserData.user as any)?.is_anonymous ?? false,
        provider: updatedUserData.user?.app_metadata?.provider ?? null,
      },
    });
  } catch (error) {
    console.error("[guest-complete-signup] Error:", error instanceof Error ? error.message : error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
