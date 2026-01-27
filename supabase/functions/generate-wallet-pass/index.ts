import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// WalletWallet API for pass generation
// API Docs: https://walletwallet.dev/docs
const WALLETWALLET_API_URL = "https://api.walletwallet.dev/api/pkpass";
const WALLETWALLET_API_KEY = Deno.env.get("WALLETWALLET_API_KEY") || "";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface BusinessCardData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  cardUrl: string;
}

function buildInstructionHtml(params: {
  rawUrl: string;
  isRTL: boolean;
  title: string;
}): string {
  const { rawUrl, isRTL, title } = params;
  const dir = isRTL ? "rtl" : "ltr";

  return `<!doctype html>
<html lang="${isRTL ? "ar" : "en"}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --bg: #0c0f14;
        --fg: #f2f2f2;
        --muted: #858384;
        --card: linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 30%, hsl(250 20% 10%) 70%, #0c0f14 100%);
        --glow: 0 0 40px hsla(210, 100%, 65%, 0.35), 0 0 80px hsla(280, 70%, 65%, 0.18);
        --border: hsla(0, 0%, 100%, 0.08);
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color: var(--fg);
        background: linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 25%, hsl(250 20% 8%) 50%, hsl(260 15% 9%) 75%, #0c0f14 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(520px, 100%);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 22px;
        box-shadow: var(--glow);
      }
      .top {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 14px;
      }
      .icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        border: 1px solid var(--border);
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, hsla(210, 100%, 65%, 0.18), hsla(280, 70%, 65%, 0.14));
      }
      .title {
        font-size: 18px;
        font-weight: 700;
        line-height: 1.25;
      }
      .subtitle {
        font-size: 13px;
        color: var(--muted);
        margin-top: 4px;
      }
      .steps {
        margin: 14px 0 16px;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 10px;
      }
      .step {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px 12px;
        background: rgba(255,255,255,0.03);
      }
      .num {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-weight: 700;
        background: rgba(255,255,255,0.08);
        border: 1px solid var(--border);
        flex: 0 0 auto;
      }
      .text {
        font-size: 14px;
        line-height: 1.35;
      }
      .actions {
        display: grid;
        gap: 10px;
        margin-top: 10px;
      }
      .btn {
        appearance: none;
        border: 0;
        width: 100%;
        border-radius: 14px;
        padding: 12px 14px;
        color: var(--fg);
        font-weight: 700;
        font-size: 15px;
        background: linear-gradient(135deg, hsl(210 100% 65%) 0%, hsl(280 70% 65%) 50%, hsl(210 100% 65%) 100%);
        box-shadow: 0 8px 40px hsla(210, 100%, 65%, 0.25);
        text-decoration: none;
        text-align: center;
        display: inline-block;
      }
      .btn:active { transform: scale(0.98); }
      .hint {
        margin-top: 10px;
        font-size: 12px;
        color: var(--muted);
      }
      .divider {
        height: 1px;
        background: var(--border);
        margin: 14px 0;
      }
      .share {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
      }
      .kbd {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.05);
        color: var(--fg);
        opacity: 0.9;
      }
      .rtl { text-align: right; }
    </style>
  </head>
  <body>
    <div class="card ${isRTL ? "rtl" : ""}">
      <div class="top">
        <div class="icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16V3" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 7l4-4 4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="title">${isRTL ? "إضافة البطاقة إلى Apple Wallet" : "Add to Apple Wallet"}</div>
          <div class="subtitle">${isRTL ? "الخطوة الأخيرة بسيطة" : "One last step"}</div>
        </div>
      </div>

      <ul class="steps">
        <li class="step">
          <div class="num">1</div>
          <div class="text">
            ${isRTL ? "اضغط زر المشاركة في أعلى الشاشة" : "Tap the Share button at the top of the screen"}
            <div class="hint"><span class="share">${isRTL ? "زر المشاركة" : "Share"}</span> <span class="kbd">↗</span></div>
          </div>
        </li>
        <li class="step">
          <div class="num">2</div>
          <div class="text">${isRTL ? "اختر \"Open in Safari\"" : "Choose \"Open in Safari\""}</div>
        </li>
        <li class="step">
          <div class="num">3</div>
          <div class="text">${isRTL ? "في Safari ستظهر لك شاشة \"Add\" لإضافتها إلى Wallet" : "In Safari you'll see the \"Add\" screen to save it to Wallet"}</div>
        </li>
      </ul>

      <div class="divider"></div>

      <div class="actions">
        <a class="btn" href="${rawUrl}" target="_blank" rel="noopener noreferrer">${isRTL ? "فتح في Safari" : "Open in Safari"}</a>
      </div>

      <div class="hint">${isRTL ? "إذا بقيت هنا، استخدم زر المشاركة بالأعلى." : "If you stay on this screen, use the Share button above."}</div>
    </div>

    <script>
      (function () {
        try {
          var a = document.querySelector('a.btn');
          if (!a) return;
          setTimeout(function () {
            try { a.click(); } catch (e) {}
          }, 400);
        } catch (e) {}
      })();
    </script>
  </body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!WALLETWALLET_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing WALLETWALLET_API_KEY server secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cardData: BusinessCardData;
    
    // Support GET with base64 encoded data
    const url = new URL(req.url);
    const raw = url.searchParams.get("raw") === "1";

    if (req.method === "GET") {
      const dataParam = url.searchParams.get("data");
      if (!dataParam) {
        return new Response("Missing data parameter", { status: 400, headers: corsHeaders });
      }
      try {
        // Convert URL-safe base64 back to standard base64
        let base64 = dataParam.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const decoded = atob(base64);
        const jsonString = decodeURIComponent(escape(decoded));
        cardData = JSON.parse(jsonString);
        console.log("Decoded card data for:", cardData.firstName, cardData.lastName);
      } catch (e) {
        console.error("Decode error:", e);
        return new Response("Invalid data: " + String(e), { status: 400, headers: corsHeaders });
      }
    } else {
      // POST with JSON body
      const body = await req.json();
      cardData = body.cardData || body;
    }

    if (!cardData?.firstName || !cardData?.lastName) {
      return new Response("Missing firstName or lastName", { status: 400, headers: corsHeaders });
    }

    const fullName = `${cardData.firstName} ${cardData.lastName}`;
    console.log("Generating wallet pass for:", fullName);

    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
    const acceptLang = (req.headers.get("accept-language") || "").toLowerCase();
    const isRTL = acceptLang.includes("ar");
    void userAgent;

    // Default GET behavior: return a friendly instruction page.
    // This avoids the blank white screen in in-app viewers that can't render .pkpass.
    // `raw=1` forces the pkpass binary response.
    if (req.method === "GET" && !raw) {
      const rawUrl = new URL(url.toString());
      rawUrl.searchParams.set("raw", "1");

      return new Response(
        buildInstructionHtml({
          rawUrl: rawUrl.toString(),
          isRTL,
          title: isRTL ? "Wakti - Apple Wallet" : "Wakti - Apple Wallet",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        }
      );
    }

    // Build request body matching WalletWallet API docs EXACTLY
    // Only use documented fields: barcodeValue, barcodeFormat, title, label, value, colorPreset, expirationDays
    const apiBody = {
      barcodeValue: cardData.cardUrl || `https://wakti.app/card/${cardData.firstName.toLowerCase()}-${cardData.lastName.toLowerCase()}`,
      barcodeFormat: "QR",
      title: cardData.company ? `${fullName} - ${cardData.company}` : fullName,
      label: cardData.jobTitle || "Contact",
      value: cardData.email || cardData.phone || "",
      colorPreset: "dark",
      expirationDays: 365
    };

    console.log("Calling WalletWallet API with:", JSON.stringify(apiBody));

    const walletResponse = await fetch(WALLETWALLET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WALLETWALLET_API_KEY}`
      },
      body: JSON.stringify(apiBody)
    });

    if (!walletResponse.ok) {
      const errorText = await walletResponse.text();
      console.error("WalletWallet API error:", walletResponse.status, errorText);
      
      let errorMessage = "Failed to generate wallet pass";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        // Use default error message
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: walletResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the .pkpass binary data
    const pkpassData = await walletResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pkpassData);
    
    const filename = `${cardData.firstName}_${cardData.lastName}.pkpass`;
    console.log("Successfully generated pass:", filename, "size:", uint8Array.length);

    // Return the .pkpass file with proper headers for iOS
    return new Response(uint8Array, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": uint8Array.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (error) {
    console.error("Error generating wallet pass:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate wallet pass", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
