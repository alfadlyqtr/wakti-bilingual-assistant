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

  async fetchHeaders(page: number, pageSize: number, exists: number): Promise<{ seq: number; headers: string }[]> {
    if (exists === 0) return [];
    const end = Math.max(1, exists - (page - 1) * pageSize);
    const start = Math.max(1, end - pageSize + 1);
    const tag = this.nextTag();
    await this.send(`${tag} FETCH ${start}:${end} (UID FLAGS BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)])`);
    const lines = await this.readUntilTagged(tag, 20000);
    return this.parseHeaders(lines);
  }

  private parseHeaders(lines: string[]): { seq: number; headers: string }[] {
    const results: { seq: number; headers: string }[] = [];
    let currentSeq = 0;
    let collecting = false;
    let headerBuf = "";

    for (const line of lines) {
      const fetchMatch = line.match(/^\* (\d+) FETCH/);
      if (fetchMatch) {
        if (currentSeq > 0 && headerBuf.trim()) {
          results.push({ seq: currentSeq, headers: headerBuf.trim() });
        }
        currentSeq = parseInt(fetchMatch[1], 10);
        collecting = line.includes("BODY[HEADER");
        headerBuf = "";
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

    if (currentSeq > 0 && headerBuf.trim()) {
      results.push({ seq: currentSeq, headers: headerBuf.trim() });
    }

    return results.sort((a, b) => b.seq - a.seq);
  }

  async fetchBody(seq: number): Promise<string> {
    const tag = this.nextTag();
    await this.send(`${tag} FETCH ${seq} (BODY[])`);
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractBodyParts(raw: string): { text: string; html: string; snippet: string } {
  const contentTypeMatch = raw.match(/^Content-Type:\s*([^\r\n;]+)/im);
  const topContentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : "text/plain";
  const bodyStart = raw.indexOf("\n\n");
  const bodyRaw = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;

  const boundaryMatch = raw.match(/boundary=["']?([^"'\r\n;]+)["']?/im);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = bodyRaw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"));
    let text = "";
    let html = "";
    for (const part of parts) {
      if (!part.trim() || part.trim() === "--") continue;
      const ctMatch = part.match(/^Content-Type:\s*([^\r\n;]+)/im);
      const ct = ctMatch ? ctMatch[1].trim().toLowerCase() : "";
      const teMatch = part.match(/^Content-Transfer-Encoding:\s*(\S+)/im);
      const te = teMatch ? teMatch[1].trim().toLowerCase() : "";
      const pBodyStart = part.indexOf("\n\n");
      const pBody = pBodyStart >= 0 ? part.slice(pBodyStart + 2) : "";
      const decoded = decodeBody(pBody, te);
      if (ct.includes("text/html")) html = decoded;
      else if (ct.includes("text/plain")) text = decoded;
    }
    const snippet = (text || stripHtml(html)).slice(0, 160).trim();
    return { text, html, snippet };
  }

  const teMatch = raw.match(/^Content-Transfer-Encoding:\s*(\S+)/im);
  const te = teMatch ? teMatch[1].trim().toLowerCase() : "";
  const decoded = decodeBody(bodyRaw, te);
  if (topContentType.includes("text/html")) {
    return { text: "", html: decoded, snippet: stripHtml(decoded).slice(0, 160).trim() };
  }
  return { text: decoded, html: "", snippet: decoded.slice(0, 160).trim() };
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

  private async expectCode(expected: number): Promise<string> {
    while (true) {
      const line = await this.readLine();
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

  async send(from: string, to: string[], subject: string, body: string): Promise<void> {
    await this.write(`MAIL FROM:<${from}>\r\n`);
    await this.expectCode(250);
    for (const r of to) {
      await this.write(`RCPT TO:<${r}>\r\n`);
      await this.expectCode(250);
    }
    await this.write(`DATA\r\n`);
    await this.expectCode(354);
    const msg = [
      `MIME-Version: 1.0`,
      `From: ${from}`,
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
      `.`,
    ].join("\r\n");
    await this.write(msg + "\r\n");
    await this.expectCode(250);
  }

  async quit(): Promise<void> {
    try { await this.write(`QUIT\r\n`); } catch {}
    try { this.reader?.cancel(); } catch {}
    try { this.conn?.close(); } catch {}
  }

  private async write(data: string): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(data));
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

async function openMailbox(conn: Record<string, unknown>, requestedFolder: string, requiredSeq?: number): Promise<MailboxSession> {
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
      if (typeof requiredSeq === "number" && requiredSeq > 0 && exists < requiredSeq) {
        console.log("[imap-api] mailbox too small", { login, requestedFolder, selectedFolder, exists, requiredSeq });
        await imap.logout();
        continue;
      }
      const currentSession = { imap, login, selectedFolder, exists };
      console.log("[imap-api] mailbox opened", { login, requestedFolder, selectedFolder, exists, requiredSeq });
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
      requiredSeq,
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

async function sendViaBestSmtpLogin(conn: Record<string, unknown>, recipients: string[], subject: string, body: string): Promise<void> {
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
      await smtp.send(String(conn.email_address || login), recipients, subject, body);
      await smtp.quit();
      console.log("[imap-api] smtp sent", { login, recipientsCount: recipients.length });
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
          uid: h.seq,
          subject: parseHeader(h.headers, "Subject") || "(no subject)",
          from: parseHeader(h.headers, "From"),
          to: parseHeader(h.headers, "To"),
          date: parseHeader(h.headers, "Date"),
          snippet: "",
          isUnread: false,
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
      const session = await openMailbox(conn, folder, uid);
      try {
        const rawBody = await session.imap.fetchBody(uid);
        const { text, html, snippet } = extractBodyParts(rawBody);
        return jsonResponse({ uid, body: { text, html }, snippet });
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "send_message") {
      const recipients = Array.isArray(body.to) ? body.to.map(String) : [String(body.to || "")].filter(Boolean);
      const subject = String(body.subject || "");
      const emailBody = String(body.body || "");
      if (recipients.length === 0 || !subject || !emailBody) {
        return jsonResponse({ error: "to, subject, body required" }, 400);
      }
      await sendViaBestSmtpLogin(conn, recipients, subject, emailBody);
      return jsonResponse({ success: true });
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
