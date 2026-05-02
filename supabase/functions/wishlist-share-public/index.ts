import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type WishlistRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  privacy: "public" | "contacts" | "private";
  allow_claims: boolean;
  allow_sharing: boolean;
};

type WishlistItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  priority: number | null;
  is_received: boolean | null;
  ai_extracted: boolean | null;
};

type OwnerProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Server not configured" });
  }

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) {
    return json(400, { error: "Missing wishlist id" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: wishlist, error: wishlistError } = await supabaseAdmin
      .from("wishlists")
      .select("id, user_id, title, description, event_date, privacy, allow_claims, allow_sharing")
      .eq("id", id)
      .maybeSingle();

    const wishlistRow = wishlist as WishlistRow | null;

    if (wishlistError) {
      return json(500, { error: "Failed to fetch wishlist" });
    }

    if (!wishlistRow || !wishlistRow.allow_sharing || wishlistRow.privacy !== "public") {
      return json(404, { error: "Wishlist not found" });
    }

    const [{ data: owner }, { data: items, error: itemsError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", wishlistRow.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("wishlist_items")
        .select("id, title, description, image_url, product_url, priority, is_received, ai_extracted")
        .eq("wishlist_id", wishlistRow.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    const ownerProfile = owner as OwnerProfile | null;
    const itemRows = (items || []) as WishlistItemRow[];

    if (itemsError) {
      return json(500, { error: "Failed to fetch wishlist items" });
    }

    return json(200, {
      wishlist: {
        id: wishlistRow.id,
        title: wishlistRow.title,
        description: wishlistRow.description,
        event_date: wishlistRow.event_date,
        allow_claims: wishlistRow.allow_claims,
        owner: {
          username: ownerProfile?.username || "unknown",
          display_name: ownerProfile?.display_name || ownerProfile?.username || "",
          avatar_url: ownerProfile?.avatar_url || null,
        },
        items: itemRows.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          image_url: item.image_url,
          product_url: item.product_url,
          priority: item.priority || 2,
          is_received: Boolean(item.is_received),
          ai_extracted: Boolean(item.ai_extracted),
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: message });
  }
});
