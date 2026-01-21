import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardData } = await req.json() as { cardData: BusinessCardData };

    if (!cardData || !cardData.firstName || !cardData.lastName) {
      return new Response(
        JSON.stringify({ error: "Missing required card data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a simple vCard-based pass
    // Note: Full Apple Wallet .pkpass generation requires:
    // 1. Apple Developer Certificate (Pass Type ID certificate)
    // 2. Private key for signing
    // 3. Apple WWDR certificate
    // For now, we'll generate a downloadable vCard as a fallback
    
    const vCard = generateVCard(cardData);
    const vCardBlob = new TextEncoder().encode(vCard);
    const vCardBase64 = btoa(String.fromCharCode(...vCardBlob));

    // Return the vCard data for download
    // In production, this would return a signed .pkpass file
    return new Response(
      JSON.stringify({
        success: true,
        type: "vcard", // Will be "pkpass" when Apple certificates are configured
        data: vCardBase64,
        filename: `${cardData.firstName}_${cardData.lastName}.vcf`,
        mimeType: "text/vcard",
        message: "Apple Wallet pass generation requires Apple Developer certificates. For now, download your contact card.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating wallet pass:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate wallet pass", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateVCard(data: BusinessCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${data.firstName} ${data.lastName}`,
    `N:${data.lastName};${data.firstName};;;`,
  ];

  if (data.email) lines.push(`EMAIL;TYPE=WORK:${data.email}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone}`);
  if (data.company) lines.push(`ORG:${data.company}`);
  if (data.jobTitle) lines.push(`TITLE:${data.jobTitle}`);
  if (data.website) lines.push(`URL:${data.website}`);
  if (data.cardUrl) lines.push(`URL;TYPE=CARD:${data.cardUrl}`);
  
  lines.push(`NOTE:Created with Wakti AI - ${data.cardUrl}`);
  lines.push("END:VCARD");

  return lines.join("\r\n");
}
