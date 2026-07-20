import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMAP_PAGE_SIZE = 20;
const IMAP_MESSAGE_CACHE_TTL_MS = 1000 * 60 * 20;

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

type MailboxListMessage = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isUnread: boolean;
};

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

  async fetchHeadersByUids(uids: number[]): Promise<{ uid: number; headers: string; isUnread: boolean }[]> {
    if (uids.length === 0) return [];
    const tag = this.nextTag();
    await this.send(`${tag} UID FETCH ${uids.join(",")} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])`);
    const lines = await this.readUntilTagged(tag, 20000);
    return this.parseHeaders(lines);
  }

  async searchHeaderUids(field: "FROM" | "TO" | "SUBJECT", query: string): Promise<number[]> {
    const escapedQuery = escapeImapQuotedString(query);
    const attempts = [
      `${this.nextTag()} UID SEARCH CHARSET UTF-8 HEADER ${field} "${escapedQuery}"`,
      `${this.nextTag()} UID SEARCH HEADER ${field} "${escapedQuery}"`,
    ];
    let lastError: Error | null = null;

    for (const command of attempts) {
      const tag = command.split(" ")[0];
      await this.send(command);
      const lines = await this.readUntilTagged(tag, 20000);
      const last = lines[lines.length - 1] || "";
      if (last.includes("OK")) {
        return parseSearchUids(lines);
      }
      lastError = new Error(`SEARCH ${field} failed: ${last}`);
      if (!/BADCHARSET|CHARSET|UTF-8|utf-8/i.test(last)) {
        break;
      }
    }

    throw lastError || new Error(`SEARCH ${field} failed`);
  }

  async searchMessageUids(query: string): Promise<number[]> {
    const fromMatches = await this.searchHeaderUids("FROM", query);
    const toMatches = await this.searchHeaderUids("TO", query);
    const subjectMatches = await this.searchHeaderUids("SUBJECT", query);

    return Array.from(new Set([...fromMatches, ...toMatches, ...subjectMatches]))
      .sort((a, b) => b - a);
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
    return this.fetchBodySection(uid);
  }

  async fetchBodySection(uid: number, section = ""): Promise<string> {
    const tag = this.nextTag();
    const sectionTarget = section ? `BODY.PEEK[${section}]` : "BODY.PEEK[]";
    await this.send(`${tag} UID FETCH ${uid} (${sectionTarget})`);
    const lines = await this.readUntilTagged(tag, 30000);
    return extractFetchBodyContent(lines);
  }

  async fetchBodyStructure(uid: number): Promise<string> {
    const tag = this.nextTag();
    await this.send(`${tag} UID FETCH ${uid} (BODYSTRUCTURE)`);
    const lines = await this.readUntilTagged(tag, 20000);
    const payload = extractBodyStructurePayload(lines);
    if (!payload) {
      throw new Error("BODYSTRUCTURE not found in IMAP response");
    }
    return payload;
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

function escapeImapQuotedString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseSearchUids(lines: string[]): number[] {
  const seen = new Set<number>();
  const matches: number[] = [];

  for (const line of lines) {
    const searchMatch = line.match(/^\* SEARCH(?:\s+(.*))?$/i);
    if (!searchMatch) continue;
    const values = (searchMatch[1] || "")
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    for (const value of values) {
      if (seen.has(value)) continue;
      seen.add(value);
      matches.push(value);
    }
  }

  return matches;
}

function extractFetchBodyContent(lines: string[]): string {
  let collecting = false;
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (!collecting && line.match(/^\* \d+ FETCH/)) {
      collecting = true;
      continue;
    }
    if (!collecting) {
      continue;
    }
    if (line.match(/^\)\s*(?:[A-Z]\d+\s+(?:OK|NO|BAD)\b.*)?$/i)) {
      break;
    }
    if (line.match(/^[A-Z]\d+\s+(?:OK|NO|BAD)\b/i)) {
      break;
    }
    bodyLines.push(line);
  }
  return bodyLines
    .join("\n")
    .replace(/\n?\)\s*[A-Z]\d+\s+(?:OK|NO|BAD)\b[^\n\r]*$/i, "")
    .replace(/\n?[A-Z]\d+\s+(?:OK|NO|BAD)\b[^\n\r]*$/i, "")
    .trimEnd();
}

function extractBodyStructurePayload(lines: string[]): string | null {
  const joined = lines.join(" ");
  const markerIndex = joined.toUpperCase().indexOf("BODYSTRUCTURE");
  if (markerIndex === -1) return null;
  const startIndex = joined.indexOf("(", markerIndex);
  if (startIndex === -1) return null;
  return extractBalancedImapList(joined, startIndex);
}

function extractBalancedImapList(value: string, startIndex: number): string | null {
  let depth = 0;
  let inQuotes = false;
  let escaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (inQuotes) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

type ImapListValue = string | number | null | ImapListValue[];

type ParsedBodyStructurePart = {
  id: string;
  fetchSection: string;
  type: string;
  subtype: string;
  contentType: string;
  charset: string | null;
  encoding: string;
  size?: number;
  inline: boolean;
  isAttachment: boolean;
  name: string | null;
  children?: ParsedBodyStructurePart[];
};

function parseImapListValue(input: string): ImapListValue {
  let cursor = 0;

  const skipWhitespace = () => {
    while (cursor < input.length && /\s/.test(input[cursor])) {
      cursor += 1;
    }
  };

  const readValue = (): ImapListValue => {
    skipWhitespace();
    if (input[cursor] === "(") {
      cursor += 1;
      const list: ImapListValue[] = [];
      while (cursor < input.length) {
        skipWhitespace();
        if (input[cursor] === ")") {
          cursor += 1;
          break;
        }
        list.push(readValue());
      }
      return list;
    }

    if (input[cursor] === '"') {
      cursor += 1;
      let value = "";
      while (cursor < input.length) {
        const char = input[cursor];
        cursor += 1;
        if (char === "\\") {
          if (cursor < input.length) {
            value += input[cursor];
            cursor += 1;
          }
          continue;
        }
        if (char === '"') {
          break;
        }
        value += char;
      }
      return value;
    }

    const start = cursor;
    while (cursor < input.length && !/[()\s]/.test(input[cursor])) {
      cursor += 1;
    }
    const token = input.slice(start, cursor);
    if (/^NIL$/i.test(token)) return null;
    if (/^\d+$/.test(token)) return Number(token);
    return token;
  };

  return readValue();
}

function parseBodyStructureParams(value: ImapListValue): Record<string, string> {
  if (!Array.isArray(value)) return {};
  const params: Record<string, string> = {};
  for (let index = 0; index < value.length; index += 2) {
    const key = value[index];
    const rawValue = value[index + 1];
    if (typeof key !== "string") continue;
    if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
    params[key.toLowerCase()] = String(rawValue);
  }
  return params;
}

function parseBodyStructureDisposition(value: ImapListValue): { type: string; params: Record<string, string> } | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rawType = value[0];
  if (typeof rawType !== "string") return null;
  return {
    type: rawType.toLowerCase(),
    params: parseBodyStructureParams(value[1]),
  };
}

function getBodyStructureDispositionIndex(type: string, subtype: string): number {
  if (type === "text") return 9;
  if (type === "message" && subtype === "rfc822") return 11;
  return 8;
}

function buildBodyStructureTree(value: ImapListValue, id = "0", section = ""): ParsedBodyStructurePart | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  if (Array.isArray(value[0])) {
    let childCount = 0;
    while (childCount < value.length && Array.isArray(value[childCount])) {
      childCount += 1;
    }
    const rawSubtype = value[childCount];
    const subtype = typeof rawSubtype === "string" ? rawSubtype.toLowerCase() : "mixed";
    const children = value
      .slice(0, childCount)
      .map((child, index) => buildBodyStructureTree(
        child,
        `${id}.${index + 1}`,
        section ? `${section}.${index + 1}` : `${index + 1}`,
      ))
      .filter(Boolean) as ParsedBodyStructurePart[];

    return {
      id,
      fetchSection: section || "TEXT",
      type: "multipart",
      subtype,
      contentType: `multipart/${subtype}`,
      charset: null,
      encoding: "",
      inline: false,
      isAttachment: false,
      name: null,
      children,
    };
  }

  const type = typeof value[0] === "string" ? value[0].toLowerCase() : "application";
  const subtype = typeof value[1] === "string" ? value[1].toLowerCase() : "octet-stream";
  const params = parseBodyStructureParams(value[2]);
  const encoding = typeof value[5] === "string" ? value[5].toLowerCase() : "7bit";
  const size = typeof value[6] === "number" ? value[6] : undefined;
  const disposition = parseBodyStructureDisposition(value[getBodyStructureDispositionIndex(type, subtype)]);
  const name = disposition?.params.filename || disposition?.params.name || params.name || null;
  const inline = disposition?.type === "inline";
  const isAttachment = disposition?.type === "attachment" || Boolean(name) || (inline && Boolean(name));

  return {
    id,
    fetchSection: section || "TEXT",
    type,
    subtype,
    contentType: `${type}/${subtype}`,
    charset: typeof params.charset === "string" ? params.charset : null,
    encoding,
    size,
    inline,
    isAttachment,
    name,
  };
}

function parseBodyStructureTree(payload: string): ParsedBodyStructurePart | null {
  try {
    const parsed = parseImapListValue(payload);
    return buildBodyStructureTree(parsed);
  } catch {
    return null;
  }
}

function collectBodyStructureContent(root: ParsedBodyStructurePart): {
  textPart: ParsedBodyStructurePart | null;
  htmlPart: ParsedBodyStructurePart | null;
  attachments: ParsedAttachment[];
} {
  let textPart: ParsedBodyStructurePart | null = null;
  let htmlPart: ParsedBodyStructurePart | null = null;
  const attachments: ParsedAttachment[] = [];

  const visit = (part: ParsedBodyStructurePart) => {
    if (part.children?.length) {
      part.children.forEach(visit);
      return;
    }

    if (part.isAttachment) {
      attachments.push({
        id: part.id,
        name: part.name || "attachment",
        contentType: part.contentType,
        size: part.size,
        inline: part.inline,
      });
      return;
    }

    if (part.type === "text" && part.subtype === "plain" && !textPart) {
      textPart = part;
      return;
    }
    if (part.type === "text" && part.subtype === "html" && !htmlPart) {
      htmlPart = part;
    }
  };

  visit(root);
  return { textPart, htmlPart, attachments };
}

function findBodyStructurePartById(root: ParsedBodyStructurePart, id: string): ParsedBodyStructurePart | null {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const match = findBodyStructurePartById(child, id);
    if (match) return match;
  }
  return null;
}

function normalizeCharset(charset?: string | null): string {
  const normalized = (charset || "").trim().toLowerCase();
  if (!normalized) return "utf-8";
  if (normalized === "utf8") return "utf-8";
  if (normalized === "cp1252") return "windows-1252";
  if (normalized === "latin1" || normalized === "latin-1") return "iso-8859-1";
  return normalized;
}

function decodeBytesToText(bytes: Uint8Array, charset?: string | null): string {
  const preferred = normalizeCharset(charset);
  const fallbacks = [preferred, "utf-8", "windows-1252", "iso-8859-1"];
  for (const candidate of Array.from(new Set(fallbacks))) {
    try {
      return new TextDecoder(candidate).decode(bytes);
    } catch {
    }
  }
  return new TextDecoder().decode(bytes);
}

function extractContentTypeCharset(headers: string): string | null {
  const match = headers.match(/charset\s*=\s*["']?([^"';\r\n]+)/i);
  return match?.[1]?.trim() || null;
}

function decodeFetchedBodyPart(content: string, encoding: string, contentType: string, charset?: string | null): string {
  const decoded = decodeBody(content, encoding, charset).replace(/\r\n?/g, "\n");
  if (contentType === "text/plain") {
    return normalizeTextContent(decoded);
  }
  return decoded;
}

function decodeMimeWords(str: string): string {
  return str.replace(/=\?([^?]+)\?(B|Q)\?([^?]*)\?=/gi, (full, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        return decodeBytesToText(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)), charset);
      }
      return decodeBytesToText(decodeQuotedPrintableBytes(text.replace(/_/g, " ")), charset);
    } catch {
      return full;
    }
  });
}

function decodeBody(body: string, encoding: string, charset?: string | null): string {
  if (encoding === "base64") {
    try {
      return decodeBytesToText(Uint8Array.from(atob(body.replace(/\s/g, "")), (c) => c.charCodeAt(0)), charset);
    } catch {
      return body;
    }
  }
  if (encoding === "quoted-printable") {
    return decodeBytesToText(decodeQuotedPrintableBytes(body), charset);
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

type ParsedAttachment = {
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  inline?: boolean;
  content?: string;
};

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

function extractHeaderParameter(headers: string, key: string): string | null {
  const encodedMatch = headers.match(new RegExp(`${key}\\*=([^;\\r\\n]+)`, "i"));
  if (encodedMatch?.[1]) {
    const cleaned = encodedMatch[1].trim().replace(/^"|"$/g, "");
    const value = cleaned.includes("''") ? cleaned.split("''").slice(1).join("''") : cleaned;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  const quotedMatch = headers.match(new RegExp(`${key}="([^"]+)"`, "i"));
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const plainMatch = headers.match(new RegExp(`${key}=([^;\\r\\n]+)`, "i"));
  return plainMatch?.[1]?.trim().replace(/^"|"$/g, "") || null;
}

function extractAttachmentName(headers: string): string | null {
  return extractHeaderParameter(headers, "filename") || extractHeaderParameter(headers, "name");
}

function decodeQuotedPrintableBytes(body: string): Uint8Array {
  const normalized = body.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "=" && /^[0-9A-F]{2}$/i.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(normalized.charCodeAt(index));
  }

  return new Uint8Array(bytes);
}

function encodeAttachmentContent(body: string, transferEncoding: string): string {
  if (transferEncoding === "base64") {
    return body.replace(/\s+/g, "");
  }
  if (transferEncoding === "quoted-printable") {
    return base64Encode(decodeQuotedPrintableBytes(body));
  }
  return base64Encode(new TextEncoder().encode(body));
}

function estimateAttachmentSize(body: string, transferEncoding: string): number | undefined {
  if (transferEncoding === "base64") {
    const normalized = body.replace(/\s+/g, "");
    if (!normalized) return undefined;
    const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
  }
  if (transferEncoding === "quoted-printable") {
    return decodeQuotedPrintableBytes(body).length;
  }
  return new TextEncoder().encode(body).length;
}

function parseMimeNode(rawPart: string, path = "0", includeAttachmentContent = false): { text: string; html: string; attachments: ParsedAttachment[] } {
  const { headers, body } = splitMimeHeadersAndBody(rawPart);
  const contentTypeMatch = headers.match(/^Content-Type:\s*([^\r\n;]+)/im);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : "text/plain";
  const charset = extractContentTypeCharset(headers);
  const transferEncodingMatch = headers.match(/^Content-Transfer-Encoding:\s*(\S+)/im);
  const transferEncoding = transferEncodingMatch ? transferEncodingMatch[1].trim().toLowerCase() : "";
  const dispositionMatch = headers.match(/^Content-Disposition:\s*([^\r\n;]+)/im);
  const disposition = dispositionMatch ? dispositionMatch[1].trim().toLowerCase() : "";
  const boundary = extractMimeBoundary(headers);

  if (boundary) {
    const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = body
      .split(new RegExp(`--${escapedBoundary}(?:--)?`, "g"))
      .map((part) => part.trim())
      .filter((part) => part && part !== "--");

    let text = "";
    let html = "";
    const attachments: ParsedAttachment[] = [];

    for (let index = 0; index < parts.length; index += 1) {
      const parsed = parseMimeNode(parts[index], `${path}.${index + 1}`, includeAttachmentContent);
      if (!text && parsed.text) text = parsed.text;
      if (!html && parsed.html) html = parsed.html;
      if (parsed.attachments.length > 0) {
        attachments.push(...parsed.attachments);
      }
    }

    return { text, html, attachments };
  }

  const attachmentName = extractAttachmentName(headers);
  const isAttachment = Boolean(attachmentName) || disposition.includes("attachment");
  const isInlineAttachment = disposition.includes("inline") && Boolean(attachmentName);

  if (isAttachment || isInlineAttachment) {
    return {
      text: "",
      html: "",
      attachments: [
        {
          id: path,
          name: attachmentName || "attachment",
          contentType,
          size: estimateAttachmentSize(body, transferEncoding),
          inline: isInlineAttachment,
          content: includeAttachmentContent ? encodeAttachmentContent(body, transferEncoding) : undefined,
        },
      ],
    };
  }

  const decoded = decodeBody(body, transferEncoding, charset);
  if (contentType.includes("text/html")) {
    return { text: "", html: decoded, attachments: [] };
  }
  if (contentType.includes("text/plain")) {
    return { text: normalizeTextContent(decoded), html: "", attachments: [] };
  }
  return { text: "", html: "", attachments: [] };
}

function extractBodyParts(raw: string): { text: string; html: string; snippet: string; attachments: ParsedAttachment[] } {
  const normalizedRaw = raw.replace(/\r\n?/g, "\n");
  const parsed = parseMimeNode(normalizedRaw);
  const text = normalizeTextContent(parsed.text || stripHtml(parsed.html));
  const html = parsed.html || "";
  return { text, html, snippet: text.slice(0, 160).trim(), attachments: parsed.attachments };
}

function findAttachmentById(raw: string, attachmentId: string): ParsedAttachment | null {
  const normalizedRaw = raw.replace(/\r\n?/g, "\n");
  const parsed = parseMimeNode(normalizedRaw, "0", true);
  return parsed.attachments.find((attachment) => attachment.id === attachmentId) || null;
}

async function extractOptimizedMessage(imap: ImapClient, uid: number): Promise<{ text: string; html: string; snippet: string; attachments: ParsedAttachment[] } | null> {
  const structurePayload = await imap.fetchBodyStructure(uid);
  const structureTree = parseBodyStructureTree(structurePayload);
  if (!structureTree) return null;

  const { textPart, htmlPart, attachments } = collectBodyStructureContent(structureTree);
  let text = "";
  let html = "";

  if (textPart) {
    const rawText = await imap.fetchBodySection(uid, textPart.fetchSection);
    text = decodeFetchedBodyPart(rawText, textPart.encoding, textPart.contentType, textPart.charset);
  }

  if (htmlPart) {
    const rawHtml = await imap.fetchBodySection(uid, htmlPart.fetchSection);
    html = decodeFetchedBodyPart(rawHtml, htmlPart.encoding, htmlPart.contentType, htmlPart.charset);
  }

  if (!text && html) {
    text = normalizeTextContent(stripHtml(html));
  }

  return {
    text,
    html,
    snippet: text.slice(0, 160).trim(),
    attachments,
  };
}

async function downloadAttachmentFromStructure(imap: ImapClient, uid: number, attachmentId: string): Promise<ParsedAttachment | null> {
  const structurePayload = await imap.fetchBodyStructure(uid);
  const structureTree = parseBodyStructureTree(structurePayload);
  if (!structureTree) return null;

  const attachmentPart = findBodyStructurePartById(structureTree, attachmentId);
  if (!attachmentPart || !attachmentPart.isAttachment) return null;

  const rawAttachment = await imap.fetchBodySection(uid, attachmentPart.fetchSection);
  return {
    id: attachmentPart.id,
    name: attachmentPart.name || "attachment",
    contentType: attachmentPart.contentType,
    size: attachmentPart.size,
    inline: attachmentPart.inline,
    content: encodeAttachmentContent(rawAttachment, attachmentPart.encoding),
  };
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

type EmailSendReceiptRow = {
  send_id: string;
  connection_id: string | null;
  transport_message_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  mailbox_login: string | null;
  sent_folder: string | null;
  saved_to_sent: boolean | null;
  subject: string | null;
  sent_at: string;
};

function normalizeSendId(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

function buildWaktiMessageId(sendId?: string): string {
  const localPart = sendId || crypto.randomUUID();
  return `<wakti-${localPart}@mail.wakti.qa>`;
}

async function getEmailSendReceipt(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  provider: "imap" | "gmail",
  sendId: string,
  connectionId?: string,
): Promise<EmailSendReceiptRow | null> {
  let query = supabase
    .from("email_send_receipts")
    .select("send_id, connection_id, transport_message_id, message_id, thread_id, mailbox_login, sent_folder, saved_to_sent, subject, sent_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("send_id", sendId)
    .order("sent_at", { ascending: false })
    .limit(1);

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as EmailSendReceiptRow | null) || null;
}

async function storeEmailSendReceipt(
  supabase: ReturnType<typeof createClient>,
  payload: {
    userId: string;
    provider: "imap" | "gmail";
    sendId: string;
    connectionId?: string;
    transportMessageId?: string;
    messageId?: string;
    threadId?: string;
    mailboxLogin?: string;
    sentFolder?: string | null;
    savedToSent?: boolean;
    subject?: string;
    toRecipients?: string[];
    ccRecipients?: string[];
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("email_send_receipts")
    .upsert({
      user_id: payload.userId,
      provider: payload.provider,
      send_id: payload.sendId,
      connection_id: payload.connectionId || null,
      transport_message_id: payload.transportMessageId || null,
      message_id: payload.messageId || null,
      thread_id: payload.threadId || null,
      mailbox_login: payload.mailboxLogin || null,
      sent_folder: payload.sentFolder || null,
      saved_to_sent: payload.savedToSent === true,
      subject: payload.subject || "",
      to_recipients: payload.toRecipients || [],
      cc_recipients: payload.ccRecipients || [],
      metadata: payload.metadata || {},
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,provider,send_id",
    });

  if (error) throw error;
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

function buildOutgoingMessage(params: {
  from: string;
  to: MailRecipient[];
  cc: MailRecipient[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: DraftAttachment[];
  sendId?: string;
}): { rawMessage: string; messageId: string } {
  const { from, to, cc, subject, body, htmlBody, attachments, sendId } = params;
  const boundary = `----WaktiMail${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const alternativeBoundary = `----WaktiAlt${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const messageId = buildWaktiMessageId(sendId);

  let msg = "";
  msg += `MIME-Version: 1.0\r\n`;
  msg += `From: ${sanitizeHeaderValue(from)}\r\n`;
  msg += `To: ${to.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
  if (cc.length > 0) {
    msg += `Cc: ${cc.map((recipient) => sanitizeHeaderValue(recipient.headerValue)).join(", ")}\r\n`;
  }
  msg += `Subject: ${sanitizeHeaderValue(subject)}\r\n`;
  msg += `Date: ${new Date().toUTCString()}\r\n`;
  msg += `Message-ID: ${messageId}\r\n`;
  if (sendId) {
    msg += `X-Wakti-Send-Id: ${sanitizeHeaderValue(sendId)}\r\n`;
  }

  if (attachments.length > 0) {
    msg += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    msg += `--${boundary}\r\n`;
    if (htmlBody) {
      msg += `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"\r\n\r\n`;
      msg += `--${alternativeBoundary}\r\n`;
      msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      msg += `${encodeQuotedPrintable(body)}\r\n`;
      msg += `--${alternativeBoundary}\r\n`;
      msg += `Content-Type: text/html; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      msg += `${encodeQuotedPrintable(htmlBody)}\r\n`;
      msg += `--${alternativeBoundary}--\r\n`;
    } else {
      msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
      msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
      msg += `${encodeQuotedPrintable(body)}\r\n`;
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
    msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
    msg += `${encodeQuotedPrintable(body)}\r\n`;
    msg += `--${alternativeBoundary}\r\n`;
    msg += `Content-Type: text/html; charset=UTF-8\r\n`;
    msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
    msg += `${encodeQuotedPrintable(htmlBody)}\r\n`;
    msg += `--${alternativeBoundary}--`;
    return { rawMessage: msg, messageId };
  }

  msg += `Content-Type: text/plain; charset=UTF-8\r\n`;
  msg += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
  msg += encodeQuotedPrintable(body);
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
      if (r.done) {
        const trailing = this.buffer.trim();
        this.buffer = "";
        if (trailing) return trailing;
        throw new Error("SMTP connection closed");
      }
      if (r.value) this.buffer += new TextDecoder().decode(r.value, { stream: true });
    }
    throw new Error("SMTP read timeout");
  }

  private async expectCode(expected: number | number[], timeoutMs = 10000): Promise<string> {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];
    while (true) {
      const line = await this.readLine(timeoutMs);
      if (!line.slice(3, 4).match(/[-]/)) {
        const code = parseInt(line.slice(0, 3), 10);
        if (!expectedCodes.includes(code)) throw new Error(`SMTP ${code}: ${line}`);
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
      await this.expectCode([250, 251]);
    }
    await this.write(`DATA\r\n`);
    await this.expectCode(354);
    await this.write(rawMessage + "\r\n.\r\n");
    try {
      await this.expectCode(250, hasAttachments ? 90000 : 60000);
    } catch (error) {
      if (error instanceof Error && error.message === "SMTP read timeout") {
        await this.expectCode(250, hasAttachments ? 90000 : 60000);
        return;
      }
      throw error;
    }
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

type CachedMailboxState = {
  messages: MailboxListMessage[];
  hasMore: boolean;
  page: number;
  total: number;
  folder: string;
  mailbox: {
    login: string;
    exists: number;
  };
  unreadCount: number;
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

function mergeMailboxMessages(primary: MailboxListMessage[], secondary: MailboxListMessage[]): MailboxListMessage[] {
  const seen = new Set<number>();
  const merged: MailboxListMessage[] = [];

  for (const message of primary) {
    if (!Number.isInteger(message.uid) || message.uid <= 0 || seen.has(message.uid)) continue;
    seen.add(message.uid);
    merged.push(message);
  }

  for (const message of secondary) {
    if (!Number.isInteger(message.uid) || message.uid <= 0 || seen.has(message.uid)) continue;
    seen.add(message.uid);
    merged.push(message);
  }

  return merged;
}

function normalizeCachedMailboxMessages(value: unknown): MailboxListMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const safeItem = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const uid = Number(safeItem.uid || 0);
      if (!Number.isInteger(uid) || uid <= 0) return null;
      return {
        uid,
        subject: typeof safeItem.subject === "string" ? safeItem.subject : "",
        from: typeof safeItem.from === "string" ? safeItem.from : "",
        to: typeof safeItem.to === "string" ? safeItem.to : "",
        date: typeof safeItem.date === "string" ? safeItem.date : "",
        snippet: typeof safeItem.snippet === "string" ? safeItem.snippet : "",
        isUnread: safeItem.isUnread === true,
      } satisfies MailboxListMessage;
    })
    .filter(Boolean) as MailboxListMessage[];
}

function normalizeCachedAttachments(value: unknown): ParsedAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const safeItem = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const id = typeof safeItem.id === "string" ? safeItem.id : "";
      const name = typeof safeItem.name === "string" ? safeItem.name : "";
      if (!id || !name) return null;
      return {
        id,
        name,
        contentType: typeof safeItem.contentType === "string" ? safeItem.contentType : undefined,
        size: typeof safeItem.size === "number" ? safeItem.size : undefined,
        inline: safeItem.inline === true,
      } satisfies ParsedAttachment;
    })
    .filter(Boolean) as ParsedAttachment[];
}

function buildMailboxMessages(headers: { uid: number; headers: string; isUnread: boolean }[], requestedFolder: string): MailboxListMessage[] {
  return headers.map((header) => ({
    uid: header.uid,
    subject: parseHeader(header.headers, "Subject") || "(no subject)",
    from: parseHeader(header.headers, "From"),
    to: parseHeader(header.headers, "To"),
    date: parseHeader(header.headers, "Date"),
    snippet: "",
    isUnread: requestedFolder === "INBOX" ? header.isUnread : false,
  }));
}

async function readMailboxCache(supabase: any, userId: string, connectionId: string, folder: string): Promise<CachedMailboxState | null> {
  const { data, error } = await supabase
    .from("imap_mailbox_cache")
    .select("messages, has_more, cached_page, total_messages, real_folder, mailbox_login, unread_count")
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("folder", folder)
    .maybeSingle();

  if (error || !data) return null;
  const messages = normalizeCachedMailboxMessages(data.messages);
  const total = Number(data.total_messages || messages.length || 0);
  return {
    messages,
    hasMore: Boolean(data.has_more),
    page: Math.max(1, Number(data.cached_page || 1)),
    total,
    folder: typeof data.real_folder === "string" && data.real_folder ? data.real_folder : folder,
    mailbox: {
      login: typeof data.mailbox_login === "string" ? data.mailbox_login : "",
      exists: total,
    },
    unreadCount: Math.max(0, Number(data.unread_count || 0)),
  };
}

async function writeMailboxCache(
  supabase: any,
  userId: string,
  connectionId: string,
  folder: string,
  mailbox: { login: string; exists: number; folder: string },
  incomingMessages: MailboxListMessage[],
  page: number,
  pageSize: number,
  hasMore: boolean,
): Promise<CachedMailboxState> {
  const existing = await readMailboxCache(supabase, userId, connectionId, folder);
  const shouldPreserveLoadedPages = page === 1 && Boolean(existing?.page && existing.page > 1);
  const total = Math.max(0, Number(mailbox.exists || 0));
  const nextMessages = page === 1
    ? (shouldPreserveLoadedPages
      ? mergeMailboxMessages(incomingMessages, existing?.messages || [])
      : incomingMessages)
    : mergeMailboxMessages(existing?.messages || [], incomingMessages);
  const nextPage = shouldPreserveLoadedPages ? Number(existing?.page || page) : page;
  const nextHasMore = shouldPreserveLoadedPages ? total > nextPage * pageSize : hasMore;
  const unreadCount = folder === "INBOX" ? nextMessages.filter((message) => message.isUnread).length : 0;

  await supabase
    .from("imap_mailbox_cache")
    .upsert({
      user_id: userId,
      connection_id: connectionId,
      folder,
      real_folder: mailbox.folder || folder,
      mailbox_login: mailbox.login,
      total_messages: total,
      cached_page: nextPage,
      page_size: pageSize,
      has_more: nextHasMore,
      unread_count: unreadCount,
      messages: nextMessages,
      synced_at: new Date().toISOString(),
    }, { onConflict: "connection_id,folder" });

  return {
    messages: nextMessages,
    hasMore: nextHasMore,
    page: nextPage,
    total,
    folder: mailbox.folder || folder,
    mailbox: {
      login: mailbox.login,
      exists: total,
    },
    unreadCount,
  };
}

async function markMailboxMessageRead(supabase: any, userId: string, connectionId: string, folder: string, uid: number) {
  const existing = await readMailboxCache(supabase, userId, connectionId, folder);
  if (!existing || folder !== "INBOX") return;
  let changed = false;
  const nextMessages = existing.messages.map((message) => {
    if (message.uid !== uid || !message.isUnread) return message;
    changed = true;
    return { ...message, isUnread: false };
  });
  if (!changed) return;
  await supabase
    .from("imap_mailbox_cache")
    .update({
      messages: nextMessages,
      unread_count: Math.max(0, nextMessages.filter((message) => message.isUnread).length),
      synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("folder", folder);
}

async function removeMailboxMessage(supabase: any, userId: string, connectionId: string, folder: string, uid: number) {
  const existing = await readMailboxCache(supabase, userId, connectionId, folder);
  if (!existing) return;
  const nextMessages = existing.messages.filter((message) => message.uid !== uid);
  const removedCount = existing.messages.length - nextMessages.length;
  if (!removedCount && existing.total === 0) return;
  const nextTotal = Math.max(0, existing.total - removedCount);
  await supabase
    .from("imap_mailbox_cache")
    .update({
      messages: nextMessages,
      total_messages: nextTotal,
      has_more: nextTotal > Math.max(1, existing.page) * IMAP_PAGE_SIZE,
      unread_count: folder === "INBOX" ? nextMessages.filter((message) => message.isUnread).length : 0,
      synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("folder", folder);
}

async function readMessageCache(supabase: any, userId: string, connectionId: string, folder: string, uid: number) {
  const { data, error } = await supabase
    .from("imap_message_cache")
    .select("uid, subject, sender, recipient, sent_at, snippet, body_text, body_html, attachments, expires_at")
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("folder", folder)
    .eq("uid", uid)
    .maybeSingle();

  if (error || !data) return null;
  const expiresAt = typeof data.expires_at === "string" ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return null;
  return {
    uid: Number(data.uid || uid),
    subject: typeof data.subject === "string" ? data.subject : "",
    from: typeof data.sender === "string" ? data.sender : "",
    to: typeof data.recipient === "string" ? data.recipient : "",
    date: typeof data.sent_at === "string" ? data.sent_at : "",
    snippet: typeof data.snippet === "string" ? data.snippet : "",
    body: {
      text: typeof data.body_text === "string" ? data.body_text : "",
      html: typeof data.body_html === "string" ? data.body_html : "",
    },
    attachments: normalizeCachedAttachments(data.attachments),
  };
}

async function writeMessageCache(
  supabase: any,
  userId: string,
  connectionId: string,
  folder: string,
  payload: {
    uid: number;
    subject: string;
    from: string;
    to: string;
    date: string;
    snippet: string;
    body: { text: string; html: string };
    attachments: ParsedAttachment[];
  },
) {
  await supabase
    .from("imap_message_cache")
    .upsert({
      user_id: userId,
      connection_id: connectionId,
      folder,
      uid: payload.uid,
      subject: payload.subject,
      sender: payload.from,
      recipient: payload.to,
      sent_at: payload.date,
      snippet: payload.snippet,
      body_text: payload.body.text,
      body_html: payload.body.html,
      attachments: payload.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        inline: attachment.inline,
      })),
      synced_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + IMAP_MESSAGE_CACHE_TTL_MS).toISOString(),
    }, { onConflict: "connection_id,folder,uid" });
}

async function deleteMessageCache(supabase: any, userId: string, connectionId: string, folder: string, uid: number) {
  await supabase
    .from("imap_message_cache")
    .delete()
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .eq("folder", folder)
    .eq("uid", uid);
}

async function persistConnectionHints(
  supabase: any,
  connectionId: string,
  conn: Record<string, unknown>,
  session: MailboxSession,
  requestedFolder: string,
) {
  if (!connectionId) return;
  const updates: Record<string, unknown> = {};
  if (String(conn.preferred_imap_login || "") !== session.login) {
    updates.preferred_imap_login = session.login;
  }
  if (requestedFolder === "SENT" && String(conn.preferred_sent_folder || "") !== session.selectedFolder) {
    updates.preferred_sent_folder = session.selectedFolder;
  }
  if (Object.keys(updates).length === 0) return;
  await supabase
    .from("email_connections")
    .update(updates)
    .eq("id", connectionId);
}

function isIcloudConnection(conn: Record<string, unknown>): boolean {
  const provider = String(conn.provider || "").trim().toLowerCase();
  if (provider === "icloud") return true;
  const email = String(conn.email_address || "").trim().toLowerCase();
  const domain = email.split("@")[1] || "";
  return ["icloud.com", "me.com", "mac.com"].includes(domain);
}

function getLoginCandidates(conn: Record<string, unknown>): string[] {
  const username = String(conn.username || "").trim();
  const email = String(conn.email_address || "").trim();
  const preferredLogin = String(conn.preferred_imap_login || "").trim();
  const usernameLocalPart = username.includes("@") ? username.split("@")[0].trim() : username;
  const emailLocalPart = email.includes("@") ? email.split("@")[0].trim() : email;
  const values = isIcloudConnection(conn)
    ? [preferredLogin, emailLocalPart, usernameLocalPart, username, email]
    : [preferredLogin, username, email];
  return values
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function formatConnectionError(conn: Record<string, unknown>, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isIcloudConnection(conn) && /AUTHENTICATIONFAILED|IMAP LOGIN failed/i.test(message)) {
    return "Apple / iCloud login failed. Make sure iCloud Mail is enabled on this Apple account and use a fresh Apple app-specific password from account.apple.com.";
  }
  return message;
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
  const preferredLogin = String(conn.preferred_imap_login || "").trim();
  const preferredSentFolder = String(conn.preferred_sent_folder || "").trim();
  let lastError: Error | null = null;
  let bestSession: MailboxSession | null = null;
  for (const login of candidates) {
    const imap = createImapForLogin(conn, login);
    try {
      await imap.connect();
      await imap.login();
      let selectedFolder = requestedFolder || "INBOX";
      let exists = 0;
      if (requestedFolder === "SENT") {
        if (preferredSentFolder) {
          try {
            const selected = await imap.select(preferredSentFolder);
            selectedFolder = preferredSentFolder;
            exists = selected.exists;
          } catch {
            selectedFolder = await detectSentFolder(imap);
            const selected = await imap.select(selectedFolder);
            exists = selected.exists;
          }
        } else {
          selectedFolder = await detectSentFolder(imap);
          const selected = await imap.select(selectedFolder);
          exists = selected.exists;
        }
      } else {
        const selected = await imap.select(selectedFolder);
        exists = selected.exists;
      }
      const currentSession = { imap, login, selectedFolder, exists };
      console.log("[imap-api] mailbox opened", { login, requestedFolder, selectedFolder, exists });
      if (preferredLogin && login === preferredLogin) {
        return currentSession;
      }
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
  recipients: MailRecipient[],
  ccRecipients: MailRecipient[],
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
      await smtp.send(
        String(conn.email_address || login),
        recipients.map((recipient) => recipient.address),
        ccRecipients.map((recipient) => recipient.address),
        rawMessage,
        hasAttachments
      );
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
    password_encrypted: String(input.password_encrypted || input.password || "").trim(),
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action, connection_id } = body;
    const sendId = normalizeSendId(body.send_id);

    if (action === "get_send_receipt") {
      if (!sendId) return jsonResponse({ error: "send_id required" }, 400);
      if (!connection_id) return jsonResponse({ error: "connection_id required" }, 400);
      const receipt = await getEmailSendReceipt(supabase, userId, "imap", sendId, String(connection_id));
      return jsonResponse({
        found: Boolean(receipt),
        receipt,
      });
    }

    const inlineConfig = body.config && typeof body.config === "object"
      ? normalizeConnectionConfig(body.config as Record<string, unknown>)
      : null;
    let conn: Record<string, unknown> | null = inlineConfig;

    if (!conn) {
      if (!connection_id) return jsonResponse({ error: "connection_id required" }, 400);
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
      let validation: ConnectionValidationResult;
      try {
        validation = await validateConnection(conn);
      } catch (error) {
        throw new Error(formatConnectionError(conn, error));
      }
      return jsonResponse(validation);
    }

    if (action === "list_messages") {
      const requestedFolder = body.folder === "SENT" ? "SENT" : "INBOX";
      const page = Number(body.page || 1);
      const pageSize = IMAP_PAGE_SIZE;
      const session = await openMailbox(conn, requestedFolder);
      try {
        const headers = await session.imap.fetchHeaders(page, pageSize, session.exists);
        const messages = buildMailboxMessages(headers, requestedFolder);
        const cached = connection_id
          ? await writeMailboxCache(
            supabase,
            userId,
            String(connection_id),
            requestedFolder,
            { login: session.login, exists: session.exists, folder: session.selectedFolder },
            messages,
            page,
            pageSize,
            session.exists > page * pageSize,
          )
          : null;
        if (connection_id) {
          await persistConnectionHints(supabase, String(connection_id), conn, session, requestedFolder);
        }
        return jsonResponse({
          messages: cached?.messages || messages,
          hasMore: cached?.hasMore ?? (session.exists > page * pageSize),
          total: cached?.total ?? session.exists,
          page: cached?.page ?? page,
          folder: cached?.folder || session.selectedFolder,
          mailbox: cached?.mailbox || {
            login: session.login,
            exists: session.exists,
          },
        });
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "search_messages") {
      const requestedFolder = body.folder === "SENT" ? "SENT" : "INBOX";
      const query = String(body.query || "").trim();
      const page = Math.max(1, Number(body.page || 1));
      const pageSize = IMAP_PAGE_SIZE;
      if (!query) return jsonResponse({ error: "query required" }, 400);
      const session = await openMailbox(conn, requestedFolder);
      try {
        const matchedUids = await session.imap.searchMessageUids(query);
        const start = (page - 1) * pageSize;
        const headers = await session.imap.fetchHeadersByUids(matchedUids.slice(start, start + pageSize));
        const messages = buildMailboxMessages(headers, requestedFolder);
        if (connection_id) {
          await persistConnectionHints(supabase, String(connection_id), conn, session, requestedFolder);
        }
        return jsonResponse({
          messages,
          hasMore: matchedUids.length > page * pageSize,
          total: matchedUids.length,
          page,
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
      if (connection_id) {
        const cached = await readMessageCache(supabase, userId, String(connection_id), folder, uid);
        if (cached) {
          if (folder.toUpperCase() === "INBOX") {
            await markMailboxMessageRead(supabase, userId, String(connection_id), "INBOX", uid);
          }
          return jsonResponse(cached);
        }
      }
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
        let text = "";
        let html = "";
        let snippet = "";
        let attachments: ParsedAttachment[] = [];

        try {
          const optimized = await extractOptimizedMessage(session.imap, uid);
          if (optimized) {
            text = optimized.text;
            html = optimized.html;
            snippet = optimized.snippet;
            attachments = optimized.attachments;
          } else {
            throw new Error("Optimized body extraction unavailable");
          }
        } catch (optimizedError) {
          console.log("[imap-api] optimized message fetch fallback", {
            login: session.login,
            uid,
            folder,
            error: optimizedError instanceof Error ? optimizedError.message : String(optimizedError),
          });
          const rawBody = await session.imap.fetchBody(uid);
          const parsed = extractBodyParts(rawBody);
          text = parsed.text;
          html = parsed.html;
          snippet = parsed.snippet;
          attachments = parsed.attachments;
        }
        const cachedMailbox = connection_id
          ? await readMailboxCache(supabase, userId, String(connection_id), folder.toUpperCase() === "SENT" ? "SENT" : "INBOX")
          : null;
        const headerMatch = cachedMailbox?.messages.find((message) => message.uid === uid) || null;
        const payload = {
          uid,
          subject: headerMatch?.subject || "",
          from: headerMatch?.from || "",
          to: headerMatch?.to || "",
          date: headerMatch?.date || "",
          snippet,
          body: { text, html },
          attachments,
        };
        if (connection_id) {
          await writeMessageCache(supabase, userId, String(connection_id), folder, payload);
          if (folder.toUpperCase() === "INBOX") {
            await markMailboxMessageRead(supabase, userId, String(connection_id), "INBOX", uid);
          }
          await persistConnectionHints(supabase, String(connection_id), conn, session, folder);
        }
        return jsonResponse(payload);
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "download_attachment") {
      const uid = Number(body.uid || 0);
      const folder = String(body.folder || "INBOX");
      const attachmentId = String(body.attachmentId || "");
      if (!uid) return jsonResponse({ error: "uid required" }, 400);
      if (!attachmentId) return jsonResponse({ error: "attachmentId required" }, 400);
      const session = await openMailbox(conn, folder);
      try {
        let attachment: ParsedAttachment | null = null;
        try {
          attachment = await downloadAttachmentFromStructure(session.imap, uid, attachmentId);
        } catch (optimizedError) {
          console.log("[imap-api] optimized attachment fetch fallback", {
            login: session.login,
            uid,
            folder,
            attachmentId,
            error: optimizedError instanceof Error ? optimizedError.message : String(optimizedError),
          });
        }
        if (!attachment) {
          const rawBody = await session.imap.fetchBody(uid);
          attachment = findAttachmentById(rawBody, attachmentId);
        }
        if (!attachment || !attachment.content) {
          return jsonResponse({ error: "Attachment not found" }, 404);
        }
        return jsonResponse({
          name: attachment.name,
          contentType: attachment.contentType || "application/octet-stream",
          size: attachment.size,
          content: attachment.content,
        });
      } finally {
        await session.imap.logout();
      }
    }

    if (action === "send_message") {
      if (sendId) {
        const existingReceipt = await getEmailSendReceipt(
          supabase,
          userId,
          "imap",
          sendId,
          connection_id ? String(connection_id) : undefined,
        );
        if (existingReceipt) {
          return jsonResponse({
            success: true,
            duplicate: true,
            sendId,
            messageId: existingReceipt.message_id,
            sentFolder: existingReceipt.sent_folder,
            savedToSent: existingReceipt.saved_to_sent === true,
          });
        }
      }

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
        sendId: sendId || undefined,
      });
      await sendViaBestSmtpLogin(conn, recipients, ccRecipients, outgoing.rawMessage, attachments.length > 0);
      const sentCopy = await ensureSentCopy(conn, outgoing.rawMessage, outgoing.messageId);
      if (sendId) {
        try {
          await storeEmailSendReceipt(supabase, {
            userId,
            provider: "imap",
            sendId,
            connectionId: connection_id ? String(connection_id) : undefined,
            messageId: outgoing.messageId,
            mailboxLogin: String(conn.email_address || conn.username || "").trim(),
            sentFolder: sentCopy.folder,
            savedToSent: sentCopy.saved || sentCopy.skipped,
            subject,
            toRecipients: recipients.map((recipient) => recipient.address),
            ccRecipients: ccRecipients.map((recipient) => recipient.address),
            metadata: {
              savedToSentByAppend: sentCopy.saved,
              savedToSentSkipped: sentCopy.skipped,
            },
          });
        } catch (receiptError) {
          console.error("[imap-api] failed to store send receipt", {
            sendId,
            error: receiptError instanceof Error ? receiptError.message : String(receiptError),
          });
        }
      }
      return jsonResponse({
        success: true,
        sendId: sendId || null,
        messageId: outgoing.messageId,
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
      if (connection_id) {
        await removeMailboxMessage(supabase, userId, String(connection_id), folder === "SENT" ? "SENT" : "INBOX", uid);
        await deleteMessageCache(supabase, userId, String(connection_id), folder, uid);
      }
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
