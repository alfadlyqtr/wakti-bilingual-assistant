import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

 function isReconnectRequiredError(error: unknown) {
   const message = error instanceof Error ? error.message : String(error || "");
   return /invalid_grant|expired or revoked|token has been expired or revoked|revoked/i.test(message);
 }

 async function getPreferredGmailTokenRow(supabase: ReturnType<typeof createClient>, userId: string) {
   const { data, error } = await supabase
     .from("gmail_tokens")
     .select("access_token, refresh_token, expires_at, email_address, account_type")
     .eq("user_id", userId)
     .order("account_type", { ascending: true })
     .order("updated_at", { ascending: false })
     .limit(1)
     .maybeSingle();

   return { data, error };
 }

async function getValidAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: tokenRow, error } = await getPreferredGmailTokenRow(supabase, userId);

  if (error || !tokenRow) throw new Error("Gmail not connected");

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < 60 * 1000;

  if (needsRefresh) {
    if (!tokenRow.refresh_token) {
      await supabase
        .from("gmail_tokens")
        .delete()
        .eq("user_id", userId);
      throw new Error("Gmail reconnect required");
    }

    try {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      await supabase
        .from("gmail_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", userId);
      return refreshed.access_token;
    } catch (error) {
      if (isReconnectRequiredError(error)) {
        await supabase
          .from("gmail_tokens")
          .delete()
          .eq("user_id", userId);
        throw new Error("Gmail reconnect required");
      }
      throw error;
    }
  }

  return tokenRow.access_token;
}

type DraftAttachment = {
  name: string;
  contentType?: string;
  content: string;
};

type MailRecipient = {
  address: string;
  headerValue: string;
};

function splitRecipientList(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = index > 0 ? value[index - 1] : "";

    if (char === '"' && previousChar !== "\\") {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === "<") {
      angleDepth += 1;
    } else if (!inQuotes && char === ">") {
      angleDepth = Math.max(0, angleDepth - 1);
    }

    if (!inQuotes && angleDepth === 0 && (char === "," || char === ";")) {
      const token = current.trim();
      if (token) tokens.push(token);
      current = "";
      continue;
    }

    current += char;
  }

  const finalToken = current.trim();
  if (finalToken) tokens.push(finalToken);
  return tokens;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function extractEmailAddress(value: string): string {
  const match = sanitizeHeaderValue(value).match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function sanitizeDisplayName(value: string): string {
  return sanitizeHeaderValue(value)
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRecipientHeader(name: string, address: string): string {
  const cleanName = sanitizeDisplayName(name);
  if (!cleanName) return address;
  const escaped = cleanName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${address}>`;
}

function parseRecipientToken(token: string): MailRecipient | null {
  const cleaned = sanitizeHeaderValue(token);
  if (!cleaned) return null;

  const angleMatch = cleaned.match(/^(.*)<([^<>]+)>\s*$/);
  if (angleMatch) {
    const address = extractEmailAddress(angleMatch[2] || "");
    if (!address) return null;
    return {
      address,
      headerValue: formatRecipientHeader(angleMatch[1] || "", address),
    };
  }

  const address = extractEmailAddress(cleaned);
  if (!address) return null;
  if (cleaned === address) {
    return { address, headerValue: address };
  }

  return {
    address,
    headerValue: formatRecipientHeader(cleaned.replace(address, "").trim(), address),
  };
}

function normalizeRecipients(value: unknown): MailRecipient[] {
  const rawItems = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? [value]
      : [];

  const parsed: MailRecipient[] = [];
  for (const item of rawItems) {
    for (const token of splitRecipientList(item)) {
      const recipient = parseRecipientToken(token);
      if (recipient) parsed.push(recipient);
    }
  }
  return parsed;
}

function sanitizeAttachmentName(value: string): string {
  return sanitizeHeaderValue(value).replace(/"/g, "'");
}

function wrapBase64(value: string): string {
  const clean = value.replace(/\s+/g, "");
  return clean.match(/.{1,76}/g)?.join("\r\n") || "";
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeQuotedPrintable(value: string): string {
  const encoder = new TextEncoder();
  const normalized = value.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  return lines.map((line) => {
    const bytes = encoder.encode(line);
    let encodedLine = "";
    let currentLength = 0;

    const appendChunk = (chunk: string) => {
      if (currentLength + chunk.length > 75) {
        encodedLine += "=\r\n";
        currentLength = 0;
      }
      encodedLine += chunk;
      currentLength += chunk.length;
    };

    for (const byte of bytes) {
      const isPlainAscii = (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126);
      const chunk = isPlainAscii
        ? String.fromCharCode(byte)
        : `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      appendChunk(chunk);
    }

    return encodedLine;
  }).join("\r\n");
}

function buildRawEmailMessage(params: {
  from: string;
  to: MailRecipient[];
  cc: MailRecipient[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: DraftAttachment[];
}): string {
  const { from, to, cc, subject, body, htmlBody, attachments } = params;
  const outerBoundary = `----WaktiMixed${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const alternativeBoundary = `----WaktiAlt${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  let raw = "";
  raw += `From: ${sanitizeHeaderValue(from)}\r\n`;
  raw += `To: ${to.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
  if (cc.length > 0) {
    raw += `Cc: ${cc.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
  }
  raw += `Subject: ${sanitizeHeaderValue(subject)}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Date: ${new Date().toUTCString()}\r\n`;

  if (attachments.length > 0) {
    raw += `Content-Type: multipart/mixed; boundary="${outerBoundary}"\r\n\r\n`;
    raw += `--${outerBoundary}\r\n`;
    if (htmlBody) {
      raw += `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n`;
      raw += `--${alternativeBoundary}\r\n`;
      raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      raw += `${encodeQuotedPrintable(body)}\r\n`;
      raw += `--${alternativeBoundary}\r\n`;
      raw += `Content-Type: text/html; charset="UTF-8"\r\n`;
      raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      raw += `${encodeQuotedPrintable(htmlBody)}\r\n`;
      raw += `--${alternativeBoundary}--\r\n`;
    } else {
      raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      raw += `${encodeQuotedPrintable(body)}\r\n`;
    }

    for (const attachment of attachments) {
      raw += `--${outerBoundary}\r\n`;
      raw += `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${sanitizeAttachmentName(attachment.name)}"\r\n`;
      raw += `Content-Disposition: attachment; filename="${sanitizeAttachmentName(attachment.name)}"\r\n`;
      raw += `Content-Transfer-Encoding: base64\r\n\r\n`;
      raw += `${wrapBase64(attachment.content)}\r\n`;
    }

    raw += `--${outerBoundary}--\r\n`;
    return raw;
  }

  if (htmlBody) {
    raw += `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n`;
    raw += `--${alternativeBoundary}\r\n`;
    raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
    raw += `${encodeQuotedPrintable(body)}\r\n`;
    raw += `--${alternativeBoundary}\r\n`;
    raw += `Content-Type: text/html; charset="UTF-8"\r\n`;
    raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
    raw += `${encodeQuotedPrintable(htmlBody)}\r\n`;
    raw += `--${alternativeBoundary}--\r\n`;
    return raw;
  }

  raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  raw += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  raw += `${encodeQuotedPrintable(body)}\r\n`;
  return raw;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const userId = await verifyUser(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action !== "send_message") {
      return jsonResponse({ error: "Gmail is currently available in send-only mode." }, 403);
    }

    const accessToken = await getValidAccessToken(supabase, userId);
    const recipients = normalizeRecipients(body.to);
    const ccRecipients = normalizeRecipients(body.cc);
    const subject = String(body.subject || "");
    const emailBody = String(body.body || "");
    const htmlBody = body.htmlBody ? String(body.htmlBody) : "";
    const threadId = body.threadId ? String(body.threadId) : undefined;
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as Array<Record<string, unknown>>)
          .map((item) => ({
            name: String(item.name || "attachment"),
            contentType: item.contentType ? String(item.contentType) : undefined,
            content: String(item.content || ""),
          }))
          .filter((item) => item.name && item.content)
      : [];

    if (recipients.length === 0 || !subject || (!emailBody && !htmlBody)) {
      return jsonResponse({ error: "to, subject, and body are required" }, 400);
    }

    const { data: tokenRow } = await getPreferredGmailTokenRow(supabase, userId);
    const fromEmail = tokenRow?.email_address || "me";

    const raw = encodeBase64Url(buildRawEmailMessage({
      from: fromEmail,
      to: recipients,
      cc: ccRecipients,
      subject,
      body: emailBody,
      htmlBody: htmlBody || undefined,
      attachments,
    }));

    const sendBody: Record<string, string> = { raw };
    if (threadId) sendBody.threadId = threadId;

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(sendBody),
      }
    );
    const sendData = await sendRes.json();

    if (sendData.error) {
      return jsonResponse({ error: sendData.error.message || "Failed to send" }, 400);
    }

    return jsonResponse({ success: true, messageId: sendData.id, threadId: sendData.threadId });
  } catch (err: any) {
    console.error("gmail-api error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
