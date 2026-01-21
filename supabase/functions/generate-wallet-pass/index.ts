import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import forge from "npm:node-forge@1.3.1";

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
  profilePhotoUrl?: string;
  logoUrl?: string;
}

const WAKTI_COLORS = {
  background: "rgb(6, 5, 65)",
  foreground: "rgb(242, 242, 242)",
  label: "rgb(133, 131, 132)",
};

serve(async (req) => {
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

    const PASS_TYPE_ID = Deno.env.get("APPLE_PASS_TYPE_ID");
    const TEAM_ID = Deno.env.get("APPLE_TEAM_ID");
    const PASS_CERT_BASE64 = Deno.env.get("APPLE_PASS_CERTIFICATE_BASE64");
    const PASS_CERT_PASSWORD = Deno.env.get("APPLE_PASS_CERTIFICATE_PASSWORD");
    const WWDR_CERT_BASE64 = Deno.env.get("APPLE_WWDR_CERTIFICATE_BASE64");

    if (!PASS_TYPE_ID || !TEAM_ID || !PASS_CERT_BASE64 || !WWDR_CERT_BASE64) {
      console.log("Apple Wallet certificates not configured. Returning setup instructions.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "certificates_not_configured",
          message: "Apple Wallet certificates need to be configured in Supabase secrets.",
          instructions: {
            step1: "Go to Apple Developer Portal > Certificates, Identifiers & Profiles",
            step2: "Create a Pass Type ID (e.g., pass.ai.wakti.businesscard)",
            step3: "Create a Pass Type ID Certificate and download it",
            step4: "Export the certificate as .p12 and convert to base64",
            step5: "Add these secrets to Supabase: APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERTIFICATE_BASE64, APPLE_PASS_CERTIFICATE_PASSWORD, APPLE_WWDR_CERTIFICATE_BASE64"
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passJson = createPassJson(cardData, PASS_TYPE_ID, TEAM_ID);
    
    const zip = new JSZip();
    
    const passJsonString = JSON.stringify(passJson, null, 2);
    zip.addFile("pass.json", new TextEncoder().encode(passJsonString));

    const iconData = await createSimpleIcon(87, WAKTI_COLORS.background);
    const icon2xData = await createSimpleIcon(174, WAKTI_COLORS.background);
    const icon3xData = await createSimpleIcon(261, WAKTI_COLORS.background);
    
    zip.addFile("icon.png", iconData);
    zip.addFile("icon@2x.png", icon2xData);
    zip.addFile("icon@3x.png", icon3xData);

    const logoData = await createSimpleIcon(160, WAKTI_COLORS.background);
    const logo2xData = await createSimpleIcon(320, WAKTI_COLORS.background);
    
    zip.addFile("logo.png", logoData);
    zip.addFile("logo@2x.png", logo2xData);

    const manifest: Record<string, string> = {};
    
    for (const [filename, fileData] of Object.entries(zip.files())) {
      if (fileData instanceof Uint8Array) {
        const hash = await crypto.subtle.digest("SHA-1", fileData);
        manifest[filename] = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    const passJsonHash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(passJsonString));
    manifest["pass.json"] = Array.from(new Uint8Array(passJsonHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const manifestString = JSON.stringify(manifest);
    zip.addFile("manifest.json", new TextEncoder().encode(manifestString));

    try {
      console.log("Starting signing process...");
      const signature = signManifest(
        manifestString,
        PASS_CERT_BASE64,
        PASS_CERT_PASSWORD || "",
        WWDR_CERT_BASE64
      );
      zip.addFile("signature", signature);
      console.log("Signature added successfully.");
    } catch (signError) {
      console.error("Signing failed:", signError);
      return new Response(
        JSON.stringify({ error: "Failed to sign wallet pass", details: String(signError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const pkpassData = await zip.generateAsync({ type: "uint8array" });
    const pkpassBase64 = base64Encode(pkpassData);

    return new Response(
      JSON.stringify({
        success: true,
        type: "pkpass",
        data: pkpassBase64,
        filename: `${cardData.firstName}_${cardData.lastName}.pkpass`,
        mimeType: "application/vnd.apple.pkpass",
        message: "Wallet pass created successfully"
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

function signManifest(manifest: string, p12Base64: string, p12Password: string, wwdrBase64: string): Uint8Array {
  const p12Der = base64Decode(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(new forge.util.ByteStringBuffer(p12Der));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, p12Password);

  let key: any = null;
  let cert: any = null;

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.key) {
        key = safeBag.key;
      }
      if (safeBag.cert) {
        cert = safeBag.cert;
      }
    }
  }

  if (!key || !cert) {
    throw new Error("Could not find key or certificate in P12");
  }

  const wwdrDer = base64Decode(wwdrBase64);
  const wwdrAsn1 = forge.asn1.fromDer(new forge.util.ByteStringBuffer(wwdrDer));
  const wwdrCert = forge.pki.certificateFromAsn1(wwdrAsn1);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest, "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdrCert);
  
  p7.addSigner({
    key: key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data
      },
      {
        type: forge.pki.oids.messageDigest,
        // value will be auto-populated
      },
      {
        type: forge.pki.oids.signingTime,
        // value will be auto-populated
      }
    ]
  });

  p7.sign({ detached: true });

  const signatureAsn1 = p7.toAsn1();
  const signatureDer = forge.asn1.toDer(signatureAsn1).getBytes();
  
  const signatureBytes = new Uint8Array(signatureDer.length);
  for (let i = 0; i < signatureDer.length; i++) {
    signatureBytes[i] = signatureDer.charCodeAt(i);
  }

  return signatureBytes;
}

function createPassJson(data: BusinessCardData, passTypeId: string, teamId: string) {
  const serialNumber = crypto.randomUUID();
  
  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    serialNumber: serialNumber,
    organizationName: "Wakti AI",
    description: `${data.firstName} ${data.lastName} - Business Card`,
    logoText: data.company || "Wakti",
    foregroundColor: WAKTI_COLORS.foreground,
    backgroundColor: WAKTI_COLORS.background,
    labelColor: WAKTI_COLORS.label,
    generic: {
      primaryFields: [
        { key: "name", label: "NAME", value: `${data.firstName} ${data.lastName}` }
      ],
      secondaryFields: [
        { key: "title", label: "TITLE", value: data.jobTitle || "" },
        { key: "company", label: "COMPANY", value: data.company || "" }
      ],
      auxiliaryFields: [
        { key: "phone", label: "PHONE", value: data.phone || "" },
        { key: "email", label: "EMAIL", value: data.email || "" }
      ],
      backFields: [
        { key: "website", label: "Website", value: data.website || "" },
        { key: "cardUrl", label: "Digital Card", value: data.cardUrl }
      ]
    },
    barcodes: [
      { format: "PKBarcodeFormatQR", message: data.cardUrl, messageEncoding: "iso-8859-1" }
    ],
    webServiceURL: "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1",
    authenticationToken: serialNumber
  };
}

function createSimpleIcon(size: number, color: string): Promise<Uint8Array> {
  // Return a minimal valid PNG
  // In a real app, this would generate an image of the requested size and color
  return Promise.resolve(new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
    0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ]));
}
