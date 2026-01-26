import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// WalletWallet API - Simple pass generation service
const WALLETWALLET_API_URL = "https://api.walletwallet.dev/api/pkpass";
const WALLETWALLET_API_KEY = "ww_live_6ddc4463e273c526b6e1a951435df2f2";

// CORS headers configured to ensure proper handling on iOS devices
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Type, Content-Disposition, Content-Length, Cache-Control, Pragma, Expires",
  "Access-Control-Allow-Credentials": "true"
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
  qrCodeBase64?: string;
  profilePhotoUrl?: string;
  logoUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let cardData: BusinessCardData;
    
    // Support both GET (direct URL for iOS) and POST (from frontend)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const dataParam = url.searchParams.get("data");
      if (!dataParam) {
        return new Response("Missing data parameter", { status: 400 });
      }
      try {
        let jsonString;
        try {
          const decoded = atob(dataParam);
          jsonString = decodeURIComponent(escape(decoded));
        } catch (_decodeErr) {
          console.log("First decode method failed, trying fallback");
          const decoded = atob(dataParam.replace(/-/g, '+').replace(/_/g, '/'));
          jsonString = decoded;
        }
        cardData = JSON.parse(jsonString);
        console.log("Successfully decoded card data:", cardData.firstName, cardData.lastName);
      } catch (e) {
        console.error("Failed to decode data:", e);
        return new Response("Invalid data parameter", { status: 400 });
      }
    } else {
      const body = await req.json();
      cardData = body.cardData;
    }

    if (!cardData || !cardData.firstName || !cardData.lastName) {
      return new Response(
        JSON.stringify({ error: "Missing required card data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the pass title and value
    const fullName = `${cardData.firstName} ${cardData.lastName}`;
    const title = cardData.company ? `${fullName} - ${cardData.company}` : fullName;
    const label = cardData.jobTitle || "Business Card";
    const value = cardData.email || cardData.phone || cardData.website || "";
    
    // Call WalletWallet API to generate the .pkpass file
    console.log("Calling WalletWallet API for:", fullName);
    
    const walletResponse = await fetch(WALLETWALLET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WALLETWALLET_API_KEY}`
      },
      body: JSON.stringify({
        barcodeValue: cardData.cardUrl,
        barcodeFormat: "QR",
        title: title.substring(0, 50), // Limit title length
        label: label.substring(0, 30),
        value: value.substring(0, 50),
        colorPreset: "dark", // Wakti dark theme
        expirationDays: 365
      })
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
