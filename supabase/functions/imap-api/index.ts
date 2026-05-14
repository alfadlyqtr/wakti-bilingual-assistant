import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

class ImapClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";
  private tagCounter = 0;

  constructor(
    private host: string,
    private port: number,
    private secure: boolean,
    private username: string,
    private password: string
  ) {}

  private nextTag(): string {
    return `A${String(++this.tagCounter).padStart(4, "0")}`;
  }

  private async readBytes(maxMs = 10000): Promise<string> {
    if (!this.reader) throw new Error("Not connected");
    const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), maxMs));
    const read = this.reader.read();
    const result = await Promise.race([read, timer]);
    if (!result || result === null) return "";
    const r = result as ReadableStreamReadResult<Uint8Array>;
    if (r.done || !r.value) return "";
    return this.decoder.decode(r.value, { stream: true });
  }

  private async readUntilTagged(tag: string, timeoutMs = 15000): Promise<string[]> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const chunk = await this.readBytes(3000);
      if (chunk) this.buffer += chunk;
      const parts = this.buffer.split("\r\n");
      this.buffer = parts.pop() ?? "";
      for (const line of parts) {
        lines.push(line);
        if (line.startsWith(tag + " ")) return lines;
      }
      if (!chunk) await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`IMAP timeout waiting for ${tag}`);
  }

  async connect(): Promise<void> {
    if (this.secure) {
      this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    } else {
      this.conn = await Deno.connect({ hostname: this.host, port: this.port });
    }
    this.reader = this.conn.readable.getReader();
    let greeting = "";
    const deadline = Date.now() + 8000;
    while (!greeting.includes("OK") && Date.now() < deadline) {
      const chunk = await this.readBytes(2000);
      if (chunk) greeting += chunk;
    }
    if (!greeting.includes("OK")) throw new Error("No IMAP greeting");
  }

  private async send(cmd: string): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(cmd + "\r\n"));
  }

  async login(): Promise<void> {
    const tag = this.nextTag();
    await this.send(`${tag} LOGIN "${this.username.replace(/"/g, '\\"')}" "${this.password.replace(/"/g, '\\"')}"`);
    const lines = await this.readUntilTagged(tag);
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`IMAP LOGIN failed: ${last}`);
  }

  async select(mailbox: string): Promise<{ exists: number }> {
    const tag = this.nextTag();
    await this.send(`${tag} SELECT "${mailbox}"`);
    const lines = await this.readUntilTagged(tag);
    let exists = 0;
    for (const line of lines) {
      const m = line.match(/^\* (\d+) EXISTS/);
      if (m) exists = parseInt(m[1], 10);
    }
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`SELECT "${mailbox}" failed: ${last}`);
    return { exists };
  }

  async examine(mailbox: string): Promise<{ exists: number }> {
    const tag = this.nextTag();
    await this.send(`${tag} EXAMINE "${mailbox}"`);
    const lines = await this.readUntilTagged(tag);
    let exists = 0;
    for (const line of lines) {
      const m = line.match(/^\* (\d+) EXISTS/);
      if (m) exists = parseInt(m[1], 10);
    }
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`EXAMINE "${mailbox}" failed: ${last}`);
    return { exists };
  }

  async listMailboxes(): Promise<string[]> {
    const tag = this.nextTag();
    await this.send(`${tag} LIST "" "*"`);
    const lines = await this.readUntilTagged(tag);
    const boxes: string[] = [];
    for (const line of lines) {
      if (!line.startsWith("* LIST")) continue;
      const quoted = line.match(/"([^"]+)"\s*$/);
      if (quoted?.[1]) {
        boxes.push(quoted[1]);
        continue;
      }
      const fallback = line.match(/\s([^\s]+)\s*$/);
      if (fallback?.[1]) boxes.push(fallback[1]);
    }
    return boxes;
  }

  async fetchHeaders(page: number, pageSize: number, exists: number): Promise<{ uid: number; headers: string; isUnread: boolean }[]> {
    if (exists === 0) return [];
    const end = Math.max(1, exists - (page - 1) * pageSize);
    const start = Math.max(1, end - pageSize + 1);
    const tag = this.nextTag();
    await this.send(`${tag} FETCH ${start}:${end} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])`);
    const lines = await this.readUntilTagged(tag, 20000);
    return this.parseHeaders(lines);
  }

  private parseHeaders(lines: string[]): { uid: number; headers: string; isUnread: boolean }[] {
    const results: { uid: number; headers: string; isUnread: boolean }[] = [];
    let currentUid = 0;
    let collecting = false;
    let headerBuf = "";
    let currentIsUnread = false;

    for (const line of lines) {
      const fetchMatch = line.match(/^\* (\d+) FETCH/);
      if (fetchMatch) {
        if (currentUid > 0 && headerBuf.trim()) {
          results.push({ uid: currentUid, headers: headerBuf.trim(), isUnread: currentIsUnread });
        }
        const uidMatch = line.match(/UID (\d+)/i);
        currentUid = uidMatch ? parseInt(uidMatch[1], 10) : 0;
        collecting = line.includes("BODY[HEADER");
        headerBuf = "";
        const flagsMatch = line.match(/FLAGS \(([^)]*)\)/i);
        const flags = flagsMatch?.[1] || "";
        currentIsUnread = !/\\Seen/i.test(flags);
        continue;
      }
      if (collecting) {
        if (line === ")") {
          collecting = false;
          continue;
        }
        headerBuf += line + "\n";
      }
    }

    if (currentUid > 0 && headerBuf.trim()) {
      results.push({ uid: currentUid, headers: headerBuf.trim(), isUnread: currentIsUnread });
    }

    return results.sort((a, b) => b.uid - a.uid);
  }

  async fetchBody(uid: number): Promise<string> {
    const tag = this.nextTag();
    await this.send(`${tag} UID FETCH ${uid} (BODY.PEEK[])`);
    const lines = await this.readUntilTagged(tag, 30000);
    let collecting = false;
    let body = "";
    for (const line of lines) {
      if (line.match(/^\* \d+ FETCH/)) {
        collecting = true;
        continue;
      }
      if (collecting) {
        if (line === ")") break;
        body += line + "\n";
      }
    }
    return body;
  }

  async copy(uid: number, mailbox: string): Promise<void> {
    const tag = this.nextTag();
    await this.send(`${tag} UID COPY ${uid} "${mailbox.replace(/"/g, '\\"')}"`);
    const lines = await this.readUntilTagged(tag, 20000);
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`COPY to "${mailbox}" failed: ${last}`);
  }

  async addFlags(uid: number, flags: string[]): Promise<void> {
    const tag = this.nextTag();
    await this.send(`${tag} UID STORE ${uid} +FLAGS.SILENT (${flags.join(" ")})`);
    const lines = await this.readUntilTagged(tag, 20000);
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`STORE flags failed: ${last}`);
  }

  private async readUntilContinuationOrTagged(tag: string, timeoutMs = 15000): Promise<{ lines: string[]; continuation: boolean }> {
    const lines: string[] = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const chunk = await this.readBytes(3000);
      if (chunk) this.buffer += chunk;
      const parts = this.buffer.split("\r\n");
      this.buffer = parts.pop() ?? "";
      for (const line of parts) {
        lines.push(line);
        if (line.startsWith("+")) {
          return { lines, continuation: true };
        }
        if (line.startsWith(tag + " ")) {
          return { lines, continuation: false };
        }
      }
      if (!chunk) await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`IMAP timeout waiting for ${tag}`);
  }

  async append(mailbox: string, message: string, flags: string[] = []): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    const normalized = message.replace(/\r?\n/g, "\r\n");
    const bytes = this.encoder.encode(normalized);
    const tag = this.nextTag();
    const flagPart = flags.length > 0 ? ` (${flags.join(" ")})` : "";
    await this.send(`${tag} APPEND "${mailbox.replace(/"/g, '\\"')}"${flagPart} {${bytes.length}}`);
    const ready = await this.readUntilContinuationOrTagged(tag, 20000);
    if (!ready.continuation) {
      const last = ready.lines[ready.lines.length - 1] || "";
      if (!last.includes("OK")) throw new Error(`APPEND to "${mailbox}" failed: ${last}`);
    }
    await this.conn.write(bytes);
    await this.conn.write(this.encoder.encode("\r\n"));
    const lines = await this.readUntilTagged(tag, 45000);
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`APPEND to "${mailbox}" failed: ${last}`);
  }

  async expunge(): Promise<void> {
    const tag = this.nextTag();
    await this.send(`${tag} EXPUNGE`);
    const lines = await this.readUntilTagged(tag, 20000);
    const last = lines[lines.length - 1] || "";
    if (!last.includes("OK")) throw new Error(`EXPUNGE failed: ${last}`);
  }

  async logout(): Promise<void> {
    try {
      const tag = this.nextTag();
      await this.send(`${tag} LOGOUT`);
    } catch {
    }
    try { this.reader?.cancel().catch(() => {}); } catch {}
    try { this.conn?.close(); } catch {}
  }
}

function parseHeader(raw: string, name: string): string {
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => l.toLowerCase().startsWith(name.toLowerCase() + ":"));
  if (idx === -1) return "";
  let val = lines[idx].replace(new RegExp(`^${name}:\\s*`, "i"), "");
  let i = idx + 1;
  while (i < lines.length && /^[ \t]/.test(lines[i])) {
    val += " " + lines[i].trim();
    i++;
  }
  return decodeMimeWords(val.trim());
}

function decodeMimeWords(str: string): string {
  return str.replace(/=\?([^?]+)\?(B|Q)\?([^?]*)\?=/gi, (full, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        return new TextDecoder(charset).decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
      }
      return text
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
    } catch {
      return full;
    }
  });
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === "base64") {
    try {
      return new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
    } catch {
      return body;
    }
  }
  if (encoding === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function normalizeTextContent(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(html: string): string {
  return normalizeTextContent(
    decodeHtmlEntities(
      html
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\s*\/\s*(p|div|section|article|header|footer|h[1-6]|blockquote|pre|table|tr|ul|ol)\s*>/gi, "\n\n")
        .replace(/<\s*li[^>]*>/gi, "\n- ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function splitMimeHeadersAndBody(raw: string): { headers: string; body: string } {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const bodyStart = normalized.indexOf("\n\n");
  if (bodyStart === -1) {
    return { headers: normalized, body: "" };
  }
  return {
    headers: normalized.slice(0, bodyStart),
    body: normalized.slice(bodyStart + 2),
  };
}

function extractMimeBoundary(headers: string): string | null {
  const boundaryMatch = headers.match(/boundary=["']?([^"'\r\n;]+)["']?/im);
  return boundaryMatch ? boundaryMatch[1].trim() : null;
}

function parseMimeNode(rawPart: string): { text: string; html: string } {
  const { headers, body } = splitMimeHeadersAndBody(rawPart);
  const contentTypeMatch = headers.match(/^Content-Type:\s*([^\r\n;]+)/im);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : "text/plain";
  const transferEncodingMatch = headers.match(/^Content-Transfer-Encoding:\s*(\S+)/im);
  const transferEncoding = transferEncodingMatch ? transferEncodingMatch[1].trim().toLowerCase() : "";
  const boundary = extractMimeBoundary(headers);

  if (boundary) {
    const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = body
      .split(new RegExp(`--${escapedBoundary}(?:--)?`, "g"))
      .map((part) => part.trim())
      .filter((part) => part && part !== "--");

    let text = "";
    let html = "";

    for (const part of parts) {
      const parsed = parseMimeNode(part);
      if (!text && parsed.text) text = parsed.text;
      if (!html && parsed.html) html = parsed.html;
      if (text && html) break;
    }

    return { text, html };
  }

  const decoded = decodeBody(body, transferEncoding);
  if (contentType.includes("text/html")) {
    return { text: "", html: decoded };
  }
  if (contentType.includes("text/plain")) {
    return { text: normalizeTextContent(decoded), html: "" };
  }
  return { text: "", html: "" };
}

function extractBodyParts(raw: string): { text: string; html: string; snippet: string } {
  const normalizedRaw = raw.replace(/\r\n?/g, "\n");
  const parsed = parseMimeNode(normalizedRaw);
  const text = normalizeTextContent(parsed.text || stripHtml(parsed.html));
  const html = parsed.html || "";
  return { text, html, snippet: text.slice(0, 160).trim() };
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

function buildOutgoingMessage(params: {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: DraftAttachment[];
}): { rawMessage: string; messageId: string } {
  const { from, to, cc, subject, body, htmlBody, attachments } = params;
  const boundary = `----WaktiMail${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const alternativeBoundary = `----WaktiAlt${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const messageId = `<wakti-${crypto.randomUUID()}@mail.wakti.qa>`;

  let msg = "";
  msg += `MIME-Version: 1.0\r\n`;
  msg += `From: ${sanitizeHeaderValue(from)}\r\n`;
  msg += `To: ${to.map(sanitizeHeaderValue).join(", ")}\r\n`;
  if (cc.length > 0) {
    msg += `Cc: ${cc.map(sanitizeHeaderValue).join(", ")}\r\n`;
  }
  msg += `Subject: ${sanitizeHeaderValue(subject)}\r\n`;
  msg += `Date: ${new Date().toUTCString()}\r\n`;
  msg += `Message-ID: ${messageId}\r\n`;

  if (attachments.length > 0) {
    msg += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    msg += `--${boundary}\r\n`;
    if (htmlBody) {
      msg += `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n`;
      msg += `--${alternativeBoundary}\r\n`;
      msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
      msg += `${body}\r\n`;
      msg += `--${alternativeBoundary}\r\n`;
      msg += `Content-Type: text/html; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
      msg += `${htmlBody}\r\n`;
      msg += `--${alternativeBoundary}--\r\n`;
    } else {
      msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
      msg += `${body}\r\n`;
    }

    for (const attachment of attachments) {
      msg += `--${boundary}\r\n`;
      msg += `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${sanitizeAttachmentName(attachment.name)}"\r\n`;
      msg += `Content-Disposition: attachment; filename="${sanitizeAttachmentName(attachment.name)}"\r\n`;
      msg += `Content-Transfer-Encoding: base64\r\n\r\n`;
      msg += `${wrapBase64(attachment.content)}\r\n`;
    }

    msg += `--${boundary}--`;
    return { rawMessage: msg, messageId };
  }

  if (htmlBody) {
    msg += `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n`;
    msg += `--${alternativeBoundary}\r\n`;
    msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
    msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    msg += `${body}\r\n`;
    msg += `--${alternativeBoundary}\r\n`;
    msg += `Content-Type: text/html; charset=UTF-8\r\n`;
    msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    msg += `${htmlBody}\r\n`;
    msg += `--${alternativeBoundary}--`;
    return { rawMessage: msg, messageId };
  }

  msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
  msg += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
  msg += body;
  return { rawMessage: msg, messageId };
}

class SmtpClient {
  private conn: Deno.Conn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private buffer = "";

  constructor(
    private host: string,
    private port: number,
    private secure: boolean,
    private username: string,
    private password: string
  ) {}

  private async readLine(timeoutMs = 10000): Promise<string> {
    if (!this.reader) throw new Error("Not connected");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const idx = this.buffer.indexOf("\r\n");
      if (idx !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 2);
        return line;
      }
      const timer = new Promise<null>((r) => setTimeout(() => r(null), 3000));
      const result = await Promise.race([this.reader.read(), timer]);
      if (!result) continue;
      const r = result as ReadableStreamReadResult<Uint8Array>;
      if (r.done) break;
      if (r.value) this.buffer += new TextDecoder().decode(r.value, { stream: true });
    }
    throw new Error("SMTP read timeout");
  }

  private async expectCode(expected: number, timeoutMs = 10000): Promise<string> {
    while (true) {
      const line = await this.readLine(timeoutMs);
      if (!line.slice(3, 4).match(/[-]/)) {
        const code = parseInt(line.slice(0, 3), 10);
        if (code !== expected) throw new Error(`SMTP ${code}: ${line}`);
        return line;
      }
    }
  }

  async connect(): Promise<void> {
    if (this.secure) {
      this.conn = await Deno.connectTls({ hostname: this.host, port: this.port });
    } else {
      this.conn = await Deno.connect({ hostname: this.host, port: this.port });
    }
    this.reader = this.conn.readable.getReader();
    await this.expectCode(220);
  }

  async ehlo(): Promise<void> {
    await this.write(`EHLO wakti.qa\r\n`);
    while (true) {
      const line = await this.readLine();
      if (!line.slice(3, 4).match(/[-]/)) break;
    }
  }

  async startTls(): Promise<void> {
    await this.write(`STARTTLS\r\n`);
    await this.expectCode(220);
    if (!this.conn) throw new Error("No connection");
    this.conn = await Deno.startTls(this.conn, { hostname: this.host });
    this.reader = this.conn.readable.getReader();
    this.buffer = "";
    await this.ehlo();
  }

  async auth(): Promise<void> {
    const plain = base64Encode(new TextEncoder().encode(`\x00${this.username}\x00${this.password}`));
    await this.write(`AUTH PLAIN ${plain}\r\n`);
    try {
      await this.expectCode(235);
      return;
    } catch {
    }
    await this.write(`AUTH LOGIN\r\n`);
    await this.expectCode(334);
    await this.write(base64Encode(new TextEncoder().encode(this.username)) + "\r\n");
    await this.expectCode(334);
    await this.write(base64Encode(new TextEncoder().encode(this.password)) + "\r\n");
    await this.expectCode(235);
  }

  async send(from: string, to: string[], cc: string[], rawMessage: string, hasAttachments: boolean): Promise<void> {
    await this.write(`MAIL FROM:<${from}>\r\n`);
    await this.expectCode(250);
    for (const r of Array.from(new Set([...to, ...cc]))) {
      await this.write(`RCPT TO:<${r}>\r\n`);
      await this.expectCode(250);
    }
    await this.write(`DATA\r\n`);
    await this.expectCode(354);
    await this.write(rawMessage + "\r\n.\r\n");
    await this.expectCode(250, hasAttachments ? 45000 : 15000);
  }

  async quit(): Promise<void> {
    try { await this.write(`QUIT\r\n`); } catch {}
    try { this.reader?.cancel(); } catch {}
    try { this.conn?.close(); } catch {}
  }

  private async write(data: string): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    const bytes = this.encoder.encode(data);
    const chunkSize = 16 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      await this.conn.write(bytes.subarray(offset, offset + chunkSize));
    }
  }
}

type MailboxSession = {
  imap: ImapClient;
  login: string;
  selectedFolder: string;
  exists: number;
};

type ConnectionValidationResult = {
  verified: true;
  proof: {
    login: string;
    emailAddress: string;
    username: string;
    inboxFolder: string;
    inboxCount: number;
    sentFolder: string;
    foldersCount: number;
  };
};

function getLoginCandidates(conn: Record<string, unknown>): string[] {
  const values = [String(conn.username || "").trim(), String(conn.email_address || "").trim()]
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
  return values;
}

function createImapForLogin(conn: Record<string, unknown>, login: string) {
  return new ImapClient(
    String(conn.imap_host || String(conn.smtp_host || "").replace("smtp.", "imap.")),
    Number(conn.imap_port || 993),
    Boolean(conn.imap_secure ?? true),
    login,
    String(conn.password_encrypted || "")
  );
}

async function detectSentFolder(imap: ImapClient): Promise<string> {
  const boxes = await imap.listMailboxes();
  const sentFolderCandidates = ["Sent", "Sent Items", "Sent Messages", "[Gmail]/Sent Mail"];
  const exact = sentFolderCandidates.find((candidate) =>
    boxes.some((box) => box.toLowerCase() === candidate.toLowerCase())
  );
  if (exact) return exact;
  const fuzzy = boxes.find((box) => /sent/i.test(box));
  return fuzzy || "Sent";
}

async function detectTrashFolder(imap: ImapClient): Promise<string | null> {
  const boxes = await imap.listMailboxes();
  const trashFolderCandidates = ["Trash", "Deleted Items", "Deleted Messages", "Bin", "[Gmail]/Trash"];
  const exact = trashFolderCandidates.find((candidate) =>
    boxes.some((box) => box.toLowerCase() === candidate.toLowerCase())
  );
  if (exact) return exact;
  const fuzzy = boxes.find((box) => /trash|bin|deleted/i.test(box));
  return fuzzy || null;
}

async function openMailbox(conn: Record<string, unknown>, requestedFolder: string): Promise<MailboxSession> {
  const candidates = getLoginCandidates(conn);
  let lastError: Error | null = null;
  let bestSession: MailboxSession | null = null;
  for (const login of candidates) {
    const imap = createImapForLogin(conn, login);
    try {
      await imap.connect();
      await imap.login();
      const selectedFolder = requestedFolder === "SENT" ? await detectSentFolder(imap) : requestedFolder || "INBOX";
      const { exists } = await imap.select(selectedFolder);
      const currentSession = { imap, login, selectedFolder, exists };
      console.log("[imap-api] mailbox opened", { login, requestedFolder, selectedFolder, exists });
      if (!bestSession) {
        bestSession = currentSession;
        continue;
      }
      if (currentSession.exists > bestSession.exists) {
        await bestSession.imap.logout();
        bestSession = currentSession;
      } else {
        await currentSession.imap.logout();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log("[imap-api] mailbox open failed", { login, requestedFolder, error: lastError.message });
      try { await imap.logout(); } catch {}
    }
  }
  if (bestSession) {
    console.log("[imap-api] chosen mailbox", {
      requestedFolder,
      login: bestSession.login,
      selectedFolder: bestSession.selectedFolder,
      exists: bestSession.exists,
    });
    return bestSession;
  }
  throw lastError || new Error("Unable to open mailbox with saved email credentials");
}

async function listFoldersWithFallback(conn: Record<string, unknown>): Promise<string[]> {
  const candidates = getLoginCandidates(conn);
  let lastError: Error | null = null;
  for (const login of candidates) {
    const imap = createImapForLogin(conn, login);
    try {
      await imap.connect();
      await imap.login();
      const folders = await imap.listMailboxes();
      await imap.logout();
      console.log("[imap-api] folders loaded", { login, count: folders.length });
      return folders;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log("[imap-api] folder load failed", { login, error: lastError.message });
      try { await imap.logout(); } catch {}
    }
  }
  throw lastError || new Error("Unable to list mail folders with saved credentials");
}

async function sendViaBestSmtpLogin(
  conn: Record<string, unknown>,
  recipients: string[],
  ccRecipients: string[],
  rawMessage: string,
  hasAttachments: boolean
): Promise<void> {
  const candidates = getLoginCandidates(conn);
  let lastError: Error | null = null;
  for (const login of candidates) {
    const smtp = new SmtpClient(
      String(conn.smtp_host || ""),
      Number(conn.smtp_port || 587),
      Boolean(conn.smtp_secure),
      login,
      String(conn.password_encrypted || "")
    );
    try {
      await smtp.connect();
      await smtp.ehlo();
      if (!Boolean(conn.smtp_secure) && Number(conn.smtp_port || 587) === 587) {
        try { await smtp.startTls(); } catch {}
      }
      await smtp.auth();
      await smtp.send(String(conn.email_address || login), recipients, ccRecipients, rawMessage, hasAttachments);
      await smtp.quit();
      console.log("[imap-api] smtp sent", { login, recipientsCount: recipients.length + ccRecipients.length, hasAttachments });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log("[imap-api] smtp failed", { login, error: lastError.message });
      try { await smtp.quit(); } catch {}
    }
  }
  throw lastError || new Error("SMTP send failed");
}

function normalizeConnectionConfig(input: Record<string, unknown>): Record<string, unknown> {
  return {
    email_address: String(input.email_address || "").trim(),
    username: String(input.username || input.email_address || "").trim(),
    imap_host: String(input.imap_host || "").trim(),
    imap_port: Number(input.imap_port || 993),
    imap_secure: Boolean(input.imap_secure ?? true),
    smtp_host: String(input.smtp_host || "").trim(),
    smtp_port: Number(input.smtp_port || 587),
    smtp_secure: Boolean(input.smtp_secure ?? false),
    password_encrypted: String(input.password_encrypted || input.password || ""),
  };
}

async function validateConnection(conn: Record<string, unknown>): Promise<ConnectionValidationResult> {
  const session = await openMailbox(conn, "INBOX");
  try {
    const folders = await session.imap.listMailboxes();
    const sentFolder = await detectSentFolder(session.imap);
    return {
      verified: true,
      proof: {
        login: session.login,
        emailAddress: String(conn.email_address || session.login),
        username: String(conn.username || session.login),
        inboxFolder: session.selectedFolder,
        inboxCount: session.exists,
        sentFolder,
        foldersCount: folders.length,
      },
    };
  } finally {
    await session.imap.logout();
  }
}

async function deleteMessage(conn: Record<string, unknown>, folder: string, uid: number): Promise<{ success: true; targetFolder: string }> {
  const session = await openMailbox(conn, folder);
  try {
    const trashFolder = await detectTrashFolder(session.imap);
    if (trashFolder && trashFolder.toLowerCase() !== session.selectedFolder.toLowerCase()) {
      try {
        await session.imap.copy(uid, trashFolder);
      } catch (error) {
        console.log("[imap-api] copy to trash failed", {
          login: session.login,
          uid,
          selectedFolder: session.selectedFolder,
          trashFolder,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await session.imap.addFlags(uid, ["\\Deleted"]);
    await session.imap.expunge();
    return {
      success: true,
      targetFolder: trashFolder || session.selectedFolder,
    };
  } finally {
    await session.imap.logout();
  }
}

async function ensureSentCopy(conn: Record<string, unknown>, rawMessage: string, messageId: string): Promise<{ saved: boolean; skipped: boolean; folder: string | null }> {
  try {
    const session = await openMailbox(conn, "SENT");
    try {
      const recentHeaders = await session.imap.fetchHeaders(1, 10, session.exists);
      const alreadySaved = recentHeaders.some((header) => parseHeader(header.headers, "Message-ID") === messageId);
      if (alreadySaved) {
        return { saved: false, skipped: true, folder: session.selectedFolder };
      }
      await session.imap.append(session.selectedFolder, rawMessage, ["\\Seen"]);
      return { saved: true, skipped: false, folder: session.selectedFolder };
    } finally {
      await session.imap.logout();
    }
  } catch (error) {
    console.log("[imap-api] save sent copy failed", {
      error: error instanceof Error ? error.message : String(error),
      messageId,
    });
    return { saved: false, skipped: false, folder: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const userId = await verifyUser(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, connection_id } = body;
    const inlineConfig = body.config && typeof body.config === "object"
      ? normalizeConnectionConfig(body.config as Record<string, unknown>)
      : null;
    let conn: Record<string, unknown> | null = inlineConfig;

    if (!conn) {
      if (!connection_id) return jsonResponse({ error: "connection_id required" }, 400);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data, error: connErr } = await supabase
        .from("email_connections")
        .select("*")
        .eq("id", connection_id)
        .eq("user_id", userId)
        .single();

      if (connErr || !data) return jsonResponse({ error: "Connection not found" }, 404);
      conn = data as Record<string, unknown>;
    }

    if (action === "validate_connection") {
      if (!String(conn.email_address || "") || !String(conn.username || "") || !String(conn.imap_host || "") || !String(conn.password_encrypted || "")) {
        return jsonResponse({ error: "email, username, password, and IMAP host are required" }, 400);
      }
      const validation = await validateConnection(conn);
      return jsonResponse(validation);
    }

    if (action === "list_messages") {
      const requestedFolder = body.folder === "SENT" ? "SENT" : "INBOX";
      const page = Number(body.page || 1);
      const pageSize = 20;
      const session = await openMailbox(conn, requestedFolder);
      try {
        const headers = await session.imap.fetchHeaders(page, pageSize, session.exists);
        const messages = headers.map((h) => ({
          uid: h.uid,
          subject: parseHeader(h.headers, "Subject") || "(no subject)",
          from: parseHeader(h.headers, "From"),
          to: parseHeader(h.headers, "To"),
          date: parseHeader(h.headers, "Date"),
          snippet: "",
          isUnread: requestedFolder === "INBOX" ? h.isUnread : false,
        }));
        return jsonResponse({
          messages,
          hasMore: session.exists > page * pageSize,
          total: session.exists,
          folder: session.selectedFolder,
          mailbox: {
            login: session.login,
            exists: session.exists,
          },
        });
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "get_message") {
      const uid = Number(body.uid || 0);
      const folder = String(body.folder || "INBOX");
      if (!uid) return jsonResponse({ error: "uid required" }, 400);
      const session = await openMailbox(conn, folder);
      try {
        if (folder.toUpperCase() === "INBOX") {
          try {
            await session.imap.addFlags(uid, ["\\Seen"]);
          } catch (error) {
            console.log("[imap-api] mark seen failed", {
              login: session.login,
              uid,
              folder,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        const rawBody = await session.imap.fetchBody(uid);
        const { text, html, snippet } = extractBodyParts(rawBody);
        return jsonResponse({ uid, body: { text, html }, snippet });
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "send_message") {
      const recipients = normalizeRecipients(body.to);
      const ccRecipients = normalizeRecipients(body.cc);
      const subject = String(body.subject || "");
      const emailBody = String(body.body || "");
      const htmlBody = body.htmlBody ? String(body.htmlBody) : "";
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
        return jsonResponse({ error: "to, subject, body required" }, 400);
      }
      const senderAddress = String(conn.email_address || conn.username || "").trim();
      const outgoing = buildOutgoingMessage({
        from: senderAddress,
        to: recipients,
        cc: ccRecipients,
        subject,
        body: emailBody,
        htmlBody: htmlBody || undefined,
        attachments,
      });
      await sendViaBestSmtpLogin(conn, recipients, ccRecipients, outgoing.rawMessage, attachments.length > 0);
      const sentCopy = await ensureSentCopy(conn, outgoing.rawMessage, outgoing.messageId);
      return jsonResponse({
        success: true,
        savedToSent: sentCopy.saved || sentCopy.skipped,
        savedToSentByAppend: sentCopy.saved,
        sentFolder: sentCopy.folder,
      });
    }

    if (action === "delete_message") {
      const uid = Number(body.uid || 0);
      const folder = String(body.folder || "INBOX");
      if (!uid) return jsonResponse({ error: "uid required" }, 400);
      const result = await deleteMessage(conn, folder, uid);
      return jsonResponse(result);
    }

    if (action === "list_folders") {
      const folders = await listFoldersWithFallback(conn);
      return jsonResponse({ folders });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("imap-api error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
