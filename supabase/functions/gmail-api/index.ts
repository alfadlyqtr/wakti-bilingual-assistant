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

async function getValidAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from("gmail_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow) throw new Error("Gmail not connected");

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < 60 * 1000;

  if (needsRefresh && tokenRow.refresh_token) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    await supabase
      .from("gmail_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("user_id", userId);
    return refreshed.access_token;
  }

  return tokenRow.access_token;
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  function walk(part: any) {
    if (!part) return;
    const mime = part.mimeType || "";
    const data = part.body?.data;

    if (mime === "text/plain" && data) {
      text = decodeBase64Url(data);
    } else if (mime === "text/html" && data) {
      html = decodeBase64Url(data);
    }

    if (part.parts) {
      for (const sub of part.parts) walk(sub);
    }
  }

  walk(payload);
  return { text, html };
}

function extractHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

type DraftAttachment = {
  name: string;
  contentType?: string;
  content: string;
};

function normalizeRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
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

function buildRawEmailMessage(params: {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: DraftAttachment[];
}): string {
  const { from, to, cc, subject, body, attachments } = params;
  const outerBoundary = `----WaktiMixed${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  let raw = "";
  raw += `From: ${sanitizeHeaderValue(from)}\r\n`;
  raw += `To: ${to.map(sanitizeHeaderValue).join(", ")}\r\n`;
  if (cc.length > 0) {
    raw += `Cc: ${cc.map(sanitizeHeaderValue).join(", ")}\r\n`;
  }
  raw += `Subject: ${sanitizeHeaderValue(subject)}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Date: ${new Date().toUTCString()}\r\n`;

  if (attachments.length > 0) {
    raw += `Content-Type: multipart/mixed; boundary="${outerBoundary}"\r\n\r\n`;
    raw += `--${outerBoundary}\r\n`;
    raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    raw += `${body}\r\n`;

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

  raw += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
  raw += `${body}\r\n`;
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
    const accessToken = await getValidAccessToken(supabase, userId);

    if (action === "list_messages") {
      const folder = body.folder || "INBOX";
      const pageToken = body.pageToken || "";
      const maxResults = body.maxResults || 20;

      const params = new URLSearchParams({
        labelIds: folder,
        maxResults: String(maxResults),
      });
      if (pageToken) params.set("pageToken", pageToken);

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const listData = await listRes.json();

      if (listData.error) {
        return jsonResponse({ error: listData.error.message || "Gmail API error" }, 400);
      }

      const messages = listData.messages || [];
      const nextPageToken = listData.nextPageToken || null;

      const summaries = await Promise.all(
        messages.map(async (msg: { id: string; threadId: string }) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          return {
            id: msg.id,
            threadId: msg.threadId,
            subject: extractHeader(headers, "subject") || "(no subject)",
            from: extractHeader(headers, "from"),
            to: extractHeader(headers, "to"),
            date: extractHeader(headers, "date"),
            snippet: msgData.snippet || "",
            labelIds: msgData.labelIds || [],
            isUnread: (msgData.labelIds || []).includes("UNREAD"),
          };
        })
      );

      return jsonResponse({ messages: summaries, nextPageToken });
    }

    if (action === "get_message") {
      const { messageId } = body;
      if (!messageId) return jsonResponse({ error: "messageId required" }, 400);

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();

      if (msgData.error) {
        return jsonResponse({ error: msgData.error.message || "Gmail API error" }, 400);
      }

      const headers = msgData.payload?.headers || [];
      const { text, html } = extractBody(msgData.payload);

      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
        }
      );

      return jsonResponse({
        id: messageId,
        threadId: msgData.threadId,
        subject: extractHeader(headers, "subject") || "(no subject)",
        from: extractHeader(headers, "from"),
        to: extractHeader(headers, "to"),
        date: extractHeader(headers, "date"),
        snippet: msgData.snippet || "",
        labelIds: msgData.labelIds || [],
        body: { text, html },
      });
    }

    if (action === "send_message") {
      const recipients = normalizeRecipients(body.to);
      const ccRecipients = normalizeRecipients(body.cc);
      const subject = String(body.subject || "");
      const emailBody = String(body.body || "");
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

      if (recipients.length === 0 || !subject || !emailBody) {
        return jsonResponse({ error: "to, subject, and body are required" }, 400);
      }

      const { data: tokenRow } = await supabase
        .from("gmail_tokens")
        .select("email_address")
        .eq("user_id", userId)
        .maybeSingle();
      const fromEmail = tokenRow?.email_address || "me";

      const raw = encodeBase64Url(buildRawEmailMessage({
        from: fromEmail,
        to: recipients,
        cc: ccRecipients,
        subject,
        body: emailBody,
        attachments,
      }));

      const sendBody: any = { raw };
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
    }

    if (action === "trash_message") {
      const { messageId } = body;
      if (!messageId) return jsonResponse({ error: "messageId required" }, 400);

      const trashRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        }
      );
      const trashData = await trashRes.json();

      if (trashData.error) {
        return jsonResponse({ error: trashData.error.message || "Failed to move email to trash" }, 400);
      }

      return jsonResponse({ success: true, messageId: trashData.id });
    }

    if (action === "list_labels") {
      const labelsRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/labels",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const labelsData = await labelsRes.json();

      if (labelsData.error) {
        return jsonResponse({ error: labelsData.error.message || "Gmail API error" }, 400);
      }

      const labels = (labelsData.labels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        messagesTotal: l.messagesTotal,
        messagesUnread: l.messagesUnread,
      }));

      return jsonResponse({ labels });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("gmail-api error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
