import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/**
 * Send Email via SMTP Edge Function
 *
 * POST /send-email-smtp
 *   {
 *     to: string | string[],
 *     subject: string,
 *     body: string,
 *     html?: string,
 *     from_name?: string,
 *     cc?: string[],
 *     bcc?: string[],
 *     connection_id?: string  -- optional: specific connection to use
 *   }
 *
 * If no connection_id provided, uses the user's primary email connection.
 * Supports both Gmail OAuth (via gmail_tokens) and IMAP/SMTP (via email_connections).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MailRecipient = {
  address: string;
  headerValue: string;
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

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

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

function normalizeRecipients(value: string | string[]): MailRecipient[] {
  const rawItems = Array.isArray(value) ? value.map(String) : [String(value || "")];
  const parsed: MailRecipient[] = [];
  for (const item of rawItems) {
    for (const token of splitRecipientList(item)) {
      const recipient = parseRecipientToken(token);
      if (recipient) parsed.push(recipient);
    }
  }
  return parsed;
}

/**
 * Minimal SMTP client using Deno TCP sockets.
 * Supports TLS (port 465) and STARTTLS (port 587).
 */
class SmtpClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private encoder = new TextEncoder();

  constructor(
    private host: string,
    private port: number,
    private secure: boolean,
    private username: string,
    private password: string
  ) {}

  private async readLine(): Promise<string> {
    if (!this.reader) throw new Error("Not connected");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await this.reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const idx = buffer.indexOf("\r\n");
      if (idx !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        return line;
      }
    }
    return "";
  }

  private async expectCode(expected: number): Promise<string> {
    const line = await this.readLine();
    const code = parseInt(line.slice(0, 3), 10);
    if (code !== expected) {
      throw new Error(`SMTP error ${code}: ${line}`);
    }
    return line;
  }

  async connect(): Promise<void> {
    if (this.secure) {
      this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    } else {
      this.conn = await Deno.connect({ hostname: this.host, port: this.port });
    }
    if (!this.conn) throw new Error("Failed to connect");
    this.reader = this.conn.readable.getReader();
    await this.expectCode(220);
  }

  async ehlo(): Promise<void> {
    await this.write(`EHLO wakti.qa\r\n`);
    // Read all EHLO response lines (multi-line)
    let line = await this.readLine();
    while (line.startsWith("250-")) {
      line = await this.readLine();
    }
    if (!line.startsWith("250 ")) {
      throw new Error(`EHLO failed: ${line}`);
    }
  }

  async startTls(): Promise<void> {
    await this.write(`STARTTLS\r\n`);
    await this.expectCode(220);
    // Upgrade to TLS
    if (!this.conn) throw new Error("No connection");
    this.conn = await Deno.startTls(this.conn, { hostname: this.host });
    this.reader = this.conn.readable.getReader();
    // Re-EHLO after TLS
    await this.ehlo();
  }

  async authLogin(): Promise<void> {
    await this.write(`AUTH LOGIN\r\n`);
    await this.expectCode(334);
    await this.write(base64Encode(this.encoder.encode(this.username)) + "\r\n");
    await this.expectCode(334);
    await this.write(base64Encode(this.encoder.encode(this.password)) + "\r\n");
    await this.expectCode(235);
  }

  async authPlain(): Promise<void> {
    const authString = `\x00${this.username}\x00${this.password}`;
    const encoded = base64Encode(this.encoder.encode(authString));
    await this.write(`AUTH PLAIN ${encoded}\r\n`);
    await this.expectCode(235);
  }

  async mailFrom(from: string): Promise<void> {
    await this.write(`MAIL FROM:<${from}>\r\n`);
    await this.expectCode(250);
  }

  async rcptTo(to: string): Promise<void> {
    await this.write(`RCPT TO:<${to}>\r\n`);
    await this.expectCode(250);
  }

  async data(subject: string, from: string, toList: MailRecipient[], body: string, html?: string): Promise<void> {
    await this.write(`DATA\r\n`);
    await this.expectCode(354);

    const boundary = `----WaktiEmailBoundary${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const isMultipart = !!html;

    let msg = "";
    msg += `MIME-Version: 1.0\r\n`;
    msg += `From: ${from}\r\n`;
    msg += `To: ${toList.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
    msg += `Subject: ${subject}\r\n`;
    msg += `Date: ${new Date().toUTCString()}\r\n`;

    if (isMultipart) {
      msg += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      msg += `\r\n`;
      msg += `--${boundary}\r\n`;
      msg += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n`;
      msg += `\r\n`;
      msg += this.encodeQuotedPrintable(body) + `\r\n`;
      msg += `--${boundary}\r\n`;
      msg += `Content-Type: text/html; charset="UTF-8"\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n`;
      msg += `\r\n`;
      msg += this.encodeQuotedPrintable(html!) + `\r\n`;
      msg += `--${boundary}--\r\n`;
    } else {
      msg += `Content-Type: text/plain; charset="UTF-8"\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n`;
      msg += `\r\n`;
      msg += this.encodeQuotedPrintable(body) + `\r\n`;
    }

    msg += `\r\n.\r\n`;
    await this.write(msg);
    await this.expectCode(250);
  }

  async quit(): Promise<void> {
    await this.write(`QUIT\r\n`);
    await this.expectCode(221);
    this.reader?.cancel().catch(() => {});
    this.conn?.close();
  }

  private async write(data: string): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(data));
  }

  private encodeQuotedPrintable(text: string): string {
    // Simple quoted-printable: encode non-ASCII and special chars
    const lines: string[] = [];
    let currentLine = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = text.charCodeAt(i);

      let encoded: string;
      if (code >= 33 && code <= 126 && char !== '=') {
        encoded = char;
      } else if (char === '\n') {
        encoded = '\n';
      } else if (char === '\r') {
        continue; // skip CR, we'll handle LF
      } else {
        encoded = '=' + code.toString(16).toUpperCase().padStart(2, '0');
      }

      // Wrap lines at ~76 chars
      if (currentLine.length + encoded.length > 75) {
        lines.push(currentLine + '=');
        currentLine = '';
      }
      currentLine += encoded;
    }

    if (currentLine) lines.push(currentLine);
    return lines.join('\r\n');
  }
}

async function sendViaSmtp(
  smtpHost: string,
  smtpPort: number,
  smtpSecure: boolean,
  username: string,
  password: string,
  from: string,
  to: MailRecipient[],
  subject: string,
  body: string,
  html?: string
): Promise<void> {
  const client = new SmtpClient(smtpHost, smtpPort, smtpSecure, username, password);
  const envelopeFrom = extractEmailAddress(from) || sanitizeHeaderValue(from);
  try {
    await client.connect();
    await client.ehlo();

    // If not already TLS, try STARTTLS (port 587)
    if (!smtpSecure && smtpPort === 587) {
      try {
        await client.startTls();
      } catch {
        // STARTTLS failed or not supported, continue without it
        console.log("[SMTP] STARTTLS not available, continuing plaintext");
      }
    }

    await client.authLogin();
    await client.mailFrom(envelopeFrom);
    for (const recipient of to) {
      await client.rcptTo(recipient.address);
    }
    await client.data(subject, from, to, body, html);
    await client.quit();
  } catch (err) {
    console.error("[SMTP] Error:", err);
    throw err;
  }
}

async function sendViaGmailApi(
  accessToken: string,
  from: string,
  to: MailRecipient[],
  subject: string,
  body: string,
  html?: string
): Promise<void> {
  // Build RFC 2822 message
  const boundary = `----WaktiBoundary${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const isMultipart = !!html;

  let rawMsg = `MIME-Version: 1.0\r\n`;
  rawMsg += `From: ${from}\r\n`;
  rawMsg += `To: ${to.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
  rawMsg += `Subject: ${subject}\r\n`;
  rawMsg += `Date: ${new Date().toUTCString()}\r\n`;

  if (isMultipart) {
    rawMsg += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    rawMsg += `--${boundary}\r\n`;
    rawMsg += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    rawMsg += `${body}\r\n`;
    rawMsg += `--${boundary}\r\n`;
    rawMsg += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    rawMsg += `${html}\r\n`;
    rawMsg += `--${boundary}--\r\n`;
  } else {
    rawMsg += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    rawMsg += `${body}\r\n`;
  }

  const encodedMsg = base64Encode(new TextEncoder().encode(rawMsg))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMsg }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API error: ${resp.status}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const userId = await verifyUser(req);
  if (!userId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    const {
      to,
      subject,
      body,
      html,
      from_name,
      connection_id,
    } = payload as {
      to: string | string[];
      subject: string;
      body: string;
      html?: string;
      from_name?: string;
      connection_id?: string;
    };

    if (!to || !subject || !body) {
      return jsonResponse({ error: "Missing required fields: to, subject, body" }, 400);
    }

    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) {
      return jsonResponse({ error: "Missing required fields: to, subject, body" }, 400);
    }

    // 1. If connection_id specified, use that specific connection
    if (connection_id) {
      const { data: conn } = await supabase
        .from("email_connections")
        .select("*")
        .eq("id", connection_id)
        .eq("user_id", userId)
        .single();

      if (!conn) {
        return jsonResponse({ error: "Connection not found" }, 404);
      }

      await sendViaSmtp(
        conn.smtp_host,
        conn.smtp_port,
        conn.smtp_secure,
        conn.username,
        conn.password_encrypted,
        from_name ? `${from_name} <${conn.email_address}>` : conn.email_address,
        recipients,
        subject,
        body,
        html
      );

      return jsonResponse({ success: true, sent_via: "smtp", provider: conn.provider });
    }

    // 2. Try Gmail OAuth first (primary account)
    const { data: gmailToken } = await supabase
      .from("gmail_tokens")
      .select("access_token, email_address")
      .eq("user_id", userId)
      .eq("account_type", "primary")
      .maybeSingle();

    if (gmailToken?.access_token && gmailToken?.email_address) {
      await sendViaGmailApi(
        gmailToken.access_token,
        from_name ? `${from_name} <${gmailToken.email_address}>` : gmailToken.email_address,
        recipients,
        subject,
        body,
        html
      );
      return jsonResponse({ success: true, sent_via: "gmail_api" });
    }

    // 3. Fallback to IMAP/SMTP primary connection
    const { data: imapConn } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle();

    if (imapConn) {
      await sendViaSmtp(
        imapConn.smtp_host,
        imapConn.smtp_port,
        imapConn.smtp_secure,
        imapConn.username,
        imapConn.password_encrypted,
        from_name ? `${from_name} <${imapConn.email_address}>` : imapConn.email_address,
        recipients,
        subject,
        body,
        html
      );
      return jsonResponse({ success: true, sent_via: "smtp", provider: imapConn.provider });
    }

    return jsonResponse({ error: "No email connection found. Please connect an email account first." }, 400);

  } catch (err: any) {
    console.error("[send-email-smtp] error:", err);
    return jsonResponse({ error: err.message || "Failed to send email" }, 500);
  }
});
