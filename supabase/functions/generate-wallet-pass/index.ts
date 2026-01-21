import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import forge from "npm:node-forge@1.3.1";

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
    let cardData: BusinessCardData;
    
    // Support both GET (direct URL for iOS) and POST (from frontend)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const dataParam = url.searchParams.get("data");
      if (!dataParam) {
        return new Response("Missing data parameter", { status: 400 });
      }
      try {
        cardData = JSON.parse(atob(dataParam));
      } catch {
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

    const PASS_TYPE_ID = Deno.env.get("APPLE_PASS_TYPE_ID");
    const TEAM_ID = Deno.env.get("APPLE_TEAM_ID");
    const PASS_CERT_BASE64 = Deno.env.get("APPLE_PASS_CERTIFICATE_BASE64");
    const PASS_CERT_PASSWORD = Deno.env.get("APPLE_PASS_CERTIFICATE_PASSWORD");
    const WWDR_CERT_BASE64 = Deno.env.get("APPLE_WWDR_CERTIFICATE_BASE64");

    if (!PASS_TYPE_ID || !TEAM_ID || !PASS_CERT_BASE64 || !WWDR_CERT_BASE64) {
      console.log("Apple Wallet certificates not configured.");
      return new Response(
        JSON.stringify({ error: "certificates_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the .pkpass file
    const pkpassData = await generatePkpass(cardData, PASS_TYPE_ID, TEAM_ID, PASS_CERT_BASE64, PASS_CERT_PASSWORD || "", WWDR_CERT_BASE64);
    
    const filename = `${cardData.firstName}_${cardData.lastName}.pkpass`;

    // Return the .pkpass file directly with proper headers
    // This is what makes iOS show the native "Add to Wallet" UI
    return new Response(new Uint8Array(pkpassData), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pkpassData.length.toString(),
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

async function generatePkpass(
  cardData: BusinessCardData,
  passTypeId: string,
  teamId: string,
  p12Base64: string,
  p12Password: string,
  wwdrBase64: string
): Promise<Uint8Array> {
  const passJson = createPassJson(cardData, passTypeId, teamId);
  const zip = new JSZip();
  
  const passJsonString = JSON.stringify(passJson, null, 2);
  zip.addFile("pass.json", new TextEncoder().encode(passJsonString));

  // Create proper PNG icons with Wakti branding
  const iconData = createColoredPng(29, 29, [6, 5, 65]);
  const icon2xData = createColoredPng(58, 58, [6, 5, 65]);
  const icon3xData = createColoredPng(87, 87, [6, 5, 65]);
  
  zip.addFile("icon.png", iconData);
  zip.addFile("icon@2x.png", icon2xData);
  zip.addFile("icon@3x.png", icon3xData);

  const logoData = createColoredPng(160, 50, [6, 5, 65]);
  const logo2xData = createColoredPng(320, 100, [6, 5, 65]);
  
  zip.addFile("logo.png", logoData);
  zip.addFile("logo@2x.png", logo2xData);

  // If there's a thumbnail/profile photo URL, we could fetch it here
  // For now, create a placeholder thumbnail
  const thumbData = createColoredPng(90, 90, [6, 5, 65]);
  const thumb2xData = createColoredPng(180, 180, [6, 5, 65]);
  zip.addFile("thumbnail.png", thumbData);
  zip.addFile("thumbnail@2x.png", thumb2xData);

  // Build manifest with SHA1 hashes
  const manifest: Record<string, string> = {};
  const filesToHash = [
    { name: "pass.json", data: new TextEncoder().encode(passJsonString) },
    { name: "icon.png", data: iconData },
    { name: "icon@2x.png", data: icon2xData },
    { name: "icon@3x.png", data: icon3xData },
    { name: "logo.png", data: logoData },
    { name: "logo@2x.png", data: logo2xData },
    { name: "thumbnail.png", data: thumbData },
    { name: "thumbnail@2x.png", data: thumb2xData },
  ];

  for (const file of filesToHash) {
    const hash = await crypto.subtle.digest("SHA-1", file.data);
    manifest[file.name] = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const manifestString = JSON.stringify(manifest);
  zip.addFile("manifest.json", new TextEncoder().encode(manifestString));

  // Sign the manifest
  const signature = signManifest(manifestString, p12Base64, p12Password, wwdrBase64);
  zip.addFile("signature", signature);

  return await zip.generateAsync({ type: "uint8array" });
}

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

// Generate a simple colored PNG image
// This creates a valid PNG with the specified dimensions and RGB color
function createColoredPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  // For simplicity, we'll create a minimal valid PNG
  // Apple Wallet requires proper PNGs but accepts simple solid color images
  
  // PNG file structure:
  // - 8-byte signature
  // - IHDR chunk (image header)
  // - IDAT chunk (image data - compressed)
  // - IEND chunk (image end)
  
  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);  // width
  ihdrView.setUint32(4, height, false); // height
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrChunk = createPngChunk("IHDR", ihdrData);
  
  // Create raw image data (RGB, no filter)
  const rawData = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawData[rowStart] = 0; // filter byte (none)
    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      rawData[pixelStart] = rgb[0];     // R
      rawData[pixelStart + 1] = rgb[1]; // G
      rawData[pixelStart + 2] = rgb[2]; // B
    }
  }
  
  // Compress with deflate (using a simple uncompressed deflate block)
  const compressedData = deflateUncompressed(rawData);
  const idatChunk = createPngChunk("IDAT", compressedData);
  
  // IEND chunk
  const iendChunk = createPngChunk("IEND", new Uint8Array(0));
  
  // Combine all parts
  const png = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdrChunk, offset); offset += ihdrChunk.length;
  png.set(idatChunk, offset); offset += idatChunk.length;
  png.set(iendChunk, offset);
  
  return png;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  
  // Length
  view.setUint32(0, data.length, false);
  
  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  
  // Data
  chunk.set(data, 8);
  
  // CRC32
  const crcData = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) {
    crcData[i] = type.charCodeAt(i);
  }
  crcData.set(data, 4);
  const crc = crc32(crcData);
  view.setUint32(8 + data.length, crc, false);
  
  return chunk;
}

function deflateUncompressed(data: Uint8Array): Uint8Array {
  // Create uncompressed deflate stream (zlib format)
  // Header: 0x78 0x01 (deflate, no compression)
  // Then uncompressed blocks
  
  const maxBlockSize = 65535;
  const numBlocks = Math.ceil(data.length / maxBlockSize);
  const outputSize = 2 + numBlocks * 5 + data.length + 4; // header + block headers + data + adler32
  const output = new Uint8Array(outputSize);
  
  output[0] = 0x78; // CMF
  output[1] = 0x01; // FLG (no dict, fastest)
  
  let outPos = 2;
  let inPos = 0;
  
  for (let i = 0; i < numBlocks; i++) {
    const isLast = i === numBlocks - 1;
    const blockSize = Math.min(maxBlockSize, data.length - inPos);
    
    output[outPos++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE=00 (no compression)
    output[outPos++] = blockSize & 0xFF;
    output[outPos++] = (blockSize >> 8) & 0xFF;
    output[outPos++] = (~blockSize) & 0xFF;
    output[outPos++] = ((~blockSize) >> 8) & 0xFF;
    
    output.set(data.subarray(inPos, inPos + blockSize), outPos);
    outPos += blockSize;
    inPos += blockSize;
  }
  
  // Adler-32 checksum
  const adler = adler32(data);
  output[outPos++] = (adler >> 24) & 0xFF;
  output[outPos++] = (adler >> 16) & 0xFF;
  output[outPos++] = (adler >> 8) & 0xFF;
  output[outPos++] = adler & 0xFF;
  
  return output.subarray(0, outPos);
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
