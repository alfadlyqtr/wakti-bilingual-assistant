import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// WalletWallet API for pass generation
// API Docs: https://walletwallet.dev/docs
const WALLETWALLET_API_URL = "https://api.walletwallet.dev/api/pkpass";
const WALLETWALLET_API_KEY = "ww_live_6ddc4463e273c526b6e1a951435df2f2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let cardData: BusinessCardData;
    
    // Support GET with base64 encoded data
    if (req.method === "GET") {
      const url = new URL(req.url);
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
