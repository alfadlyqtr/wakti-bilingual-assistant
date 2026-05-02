import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  auto_approve_claims: boolean;
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

type WishlistClaimRow = {
  id: string;
  item_id: string;
  status: string;
  claimer_id: string | null;
  public_claimer_name: string | null;
  public_claimer_email: string | null;
  public_claim_note: string | null;
  claimed_at: string;
};

type OwnerProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type PublicClaimPayload = {
  itemId?: string;
  claimerName?: string;
  claimerEmail?: string;
  note?: string;
};

type MinimalQueryBuilder = {
  select: (query: string) => MinimalQueryBuilder;
  insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
  eq: (column: string, value: unknown) => MinimalQueryBuilder;
  in: (column: string, values: unknown[]) => MinimalQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => MinimalQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

type MinimalSupabaseClient = {
  from: (table: string) => MinimalQueryBuilder;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function fetchPublicWishlistSnapshot(supabaseAdmin: MinimalSupabaseClient, id: string) {
  const { data: wishlist, error: wishlistError } = await supabaseAdmin
    .from("wishlists")
    .select("id, user_id, title, description, event_date, privacy, allow_claims, allow_sharing, auto_approve_claims")
    .eq("id", id)
    .maybeSingle();

  const wishlistRow = wishlist as WishlistRow | null;

  if (wishlistError) {
    throw new Error("Failed to fetch wishlist");
  }

  if (!wishlistRow || !wishlistRow.allow_sharing || wishlistRow.privacy !== "public") {
    return { wishlist: null, wishlistRow: null };
  }

  const ownerPromise = supabaseAdmin
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", wishlistRow.user_id)
      .maybeSingle() as Promise<{ data: unknown; error: unknown }>;

  const itemsPromise = supabaseAdmin
      .from("wishlist_items")
      .select("id, title, description, image_url, product_url, priority, is_received, ai_extracted")
      .eq("wishlist_id", wishlistRow.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }) as unknown as Promise<{ data: unknown; error: unknown }>;

  const claimsPromise = supabaseAdmin
      .from("wishlist_claims")
      .select("id, item_id, status, claimer_id, public_claimer_name, public_claimer_email, public_claim_note, claimed_at")
      .eq("wishlist_id", wishlistRow.id)
      .in("status", ["pending", "approved"])
      .order("claimed_at", { ascending: false }) as unknown as Promise<{ data: unknown; error: unknown }>;

  const [{ data: owner }, { data: items, error: itemsError }, { data: claims, error: claimsError }] = await Promise.all([
    ownerPromise,
    itemsPromise,
    claimsPromise,
  ]);

  const ownerProfile = owner as OwnerProfile | null;
  const itemRows = (items || []) as WishlistItemRow[];
  const claimRows = (claims || []) as WishlistClaimRow[];

  if (itemsError) {
    throw new Error("Failed to fetch wishlist items");
  }

  if (claimsError) {
    throw new Error("Failed to fetch wishlist claims");
  }

  const claimByItemId = new Map<string, WishlistClaimRow>();
  for (const claim of claimRows) {
    if (!claimByItemId.has(claim.item_id)) {
      claimByItemId.set(claim.item_id, claim);
    }
  }

  return {
    wishlistRow,
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
      items: itemRows.map((item) => {
        const claim = claimByItemId.get(item.id) || null;
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          image_url: item.image_url,
          product_url: item.product_url,
          priority: item.priority || 2,
          is_received: Boolean(item.is_received),
          ai_extracted: Boolean(item.ai_extracted),
          claim: claim
            ? {
                id: claim.id,
                status: claim.status,
                claimant_name: claim.public_claimer_name || "Someone",
                claimant_email: claim.public_claimer_email,
                note: claim.public_claim_note,
                is_public: claim.claimer_id === null,
              }
            : null,
        };
      }),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
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
  }) as unknown as MinimalSupabaseClient;

  try {
    if (req.method === "GET") {
      const result = await fetchPublicWishlistSnapshot(supabaseAdmin, id);
      if (!result.wishlist || !result.wishlistRow) {
        return json(404, { error: "Wishlist not found" });
      }

      return json(200, { wishlist: result.wishlist });
    }

    const result = await fetchPublicWishlistSnapshot(supabaseAdmin, id);
    if (!result.wishlist || !result.wishlistRow) {
      return json(404, { error: "Wishlist not found" });
    }

    if (!result.wishlistRow.allow_claims) {
      return json(400, { error: "Claims are disabled for this wishlist" });
    }

    const body = (await req.json().catch(() => null)) as PublicClaimPayload | null;
    const itemId = normalizeText(body?.itemId, 100);
    const claimerName = normalizeText(body?.claimerName, 120);
    const claimerEmail = normalizeText(body?.claimerEmail, 160)?.toLowerCase() || null;
    const note = normalizeText(body?.note, 500);

    if (!itemId) {
      return json(400, { error: "Missing item id" });
    }

    if (!claimerName) {
      return json(400, { error: "Please enter your name" });
    }

    if (!isValidEmail(claimerEmail)) {
      return json(400, { error: "Please enter a valid email" });
    }

    const item = result.wishlist.items.find((entry) => entry.id === itemId);
    if (!item) {
      return json(404, { error: "Wishlist item not found" });
    }

    if (item.is_received) {
      return json(400, { error: "This item has already been received" });
    }

    if (item.claim) {
      return json(409, { error: "This item has already been claimed" });
    }

    const status = result.wishlistRow.auto_approve_claims ? "approved" : "pending";

    const { error: insertError } = await supabaseAdmin
      .from("wishlist_claims")
      .insert({
        item_id: itemId,
        wishlist_id: result.wishlistRow.id,
        claimer_id: null,
        owner_id: result.wishlistRow.user_id,
        status,
        public_claimer_name: claimerName,
        public_claimer_email: claimerEmail,
        public_claim_note: note,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return json(409, { error: "This item has already been claimed" });
      }

      return json(500, { error: "Failed to create claim" });
    }

    const updated = await fetchPublicWishlistSnapshot(supabaseAdmin, id);
    return json(200, {
      message: status === "approved" ? "Item claimed" : "Claim submitted",
      wishlist: updated.wishlist,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(500, { error: message });
  }
});
