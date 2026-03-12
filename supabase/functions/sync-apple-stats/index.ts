import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// deno-lint-ignore no-explicit-any
import { SignJWT } from "https://deno.land/x/jose@v4.15.5/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const APPLE_KEY_ID = Deno.env.get("APPLE_KEY_ID") || "";
const APPLE_ISSUER_ID = Deno.env.get("APPLE_ISSUER_ID") || "";
const APPLE_PRIVATE_KEY = Deno.env.get("APPLE_PRIVATE_KEY") || "";

// App Store Connect vendor number (the numeric ID from App Store Connect)
const APPLE_VENDOR_NUMBER = Deno.env.get("APPLE_VENDOR_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Build Apple JWT (ES256) ───────────────────────────────────────────────────
async function buildAppleJWT(): Promise<string> {
  // Apple private keys come as PEM — strip headers and decode
  const pemClean = APPLE_PRIVATE_KEY
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const keyBytes = Uint8Array.from(atob(pemClean), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_ISSUER_ID)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("20m")
    .sign(privateKey);

  return jwt;
}

// ── Get yesterday's date in YYYY-MM-DD ───────────────────────────────────────
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// ── Fetch Apple Sales report (gzip → decompress → TSV parse) ─────────────────
async function fetchAppleSalesReport(token: string, reportDate: string): Promise<number> {
  // Apple expects date in YYYY-MM-DD format
  const url = new URL("https://api.appstoreconnect.apple.com/v1/salesReports");
  url.searchParams.set("filter[frequency]", "DAILY");
  url.searchParams.set("filter[reportDate]", reportDate);
  url.searchParams.set("filter[reportSubType]", "SUMMARY");
  url.searchParams.set("filter[reportType]", "SALES");
  url.searchParams.set("filter[vendorNumber]", APPLE_VENDOR_NUMBER);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "gzip",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apple API error ${res.status}: ${errText}`);
  }

  // Response is gzip-compressed TSV — decompress it
  const compressed = await res.arrayBuffer();
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const tsv = new TextDecoder().decode(merged);
  const lines = tsv.trim().split("\n");

  if (lines.length < 2) return 0; // header only = no data

  // TSV header: Provider | Provider Country | SKU | Developer | Title | Version |
  //             Product Type Identifier | Units | Developer Proceeds | Begin Date | End Date | ...
  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const unitsIdx = headers.indexOf("units");

  if (unitsIdx === -1) {
    throw new Error(`Could not find 'Units' column. Headers: ${headers.join(", ")}`);
  }

  let totalDownloads = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const units = parseInt(cols[unitsIdx] ?? "0", 10);
    if (!isNaN(units) && units > 0) {
      totalDownloads += units;
    }
  }

  return totalDownloads;
}

// ── Upsert into app_metrics ───────────────────────────────────────────────────
async function upsertMetric(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  reportDate: string,
  downloads: number
): Promise<void> {
  const { error } = await supabase
    .from("app_metrics")
    .upsert(
      {
        report_date: reportDate,
        platform: "apple",
        downloads,
        revenue: 0, // Revenue comes from financial reports — sales report gives units only
        updated_at: new Date().toISOString(),
      },
      { onConflict: "report_date,platform" }
    );

  if (error) throw new Error(`DB upsert failed: ${error.message}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate required secrets
    if (!APPLE_KEY_ID || !APPLE_ISSUER_ID || !APPLE_PRIVATE_KEY) {
      return jsonResp({ error: "Apple API secrets not configured (APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY)" }, 500);
    }
    if (!APPLE_VENDOR_NUMBER) {
      return jsonResp({ error: "APPLE_VENDOR_NUMBER secret not set" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Allow optional override of date via body (for backfilling)
    let reportDate = getYesterday();
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.date) reportDate = body.date;
      } catch {
        // no body — use yesterday
      }
    }

    console.log(`[sync-apple-stats] Syncing report for date: ${reportDate}`);

    // 1. Build Apple JWT
    const token = await buildAppleJWT();

    // 2. Fetch sales report
    const downloads = await fetchAppleSalesReport(token, reportDate);

    console.log(`[sync-apple-stats] Downloads for ${reportDate}: ${downloads}`);

    // 3. Upsert into DB
    await upsertMetric(supabase, reportDate, downloads);

    return jsonResp({
      success: true,
      report_date: reportDate,
      platform: "apple",
      downloads,
    });
  } catch (err) {
    console.error("[sync-apple-stats] error:", err);
    return jsonResp({ error: "Sync failed", details: String(err) }, 500);
  }
});
