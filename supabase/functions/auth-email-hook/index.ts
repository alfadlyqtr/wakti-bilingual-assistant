/**
 * Auth Email Hook — sends Supabase Auth emails (password reset, signup
 * confirm, magic link, OTP) through Wakti's own cPanel mailbox.
 *
 * Why this exists: Supabase's built-in message builder omits the Message-ID
 * header, and Gmail rejects such messages (550 5.7.1). Building the message
 * ourselves lets us include every required header plus bilingual templates.
 *
 * Wired up via: Supabase Dashboard → Authentication → Auth Hooks → Send Email.
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hxauxozopvpzpdygoqwf.supabase.co";
const SMTP_HOST = Deno.env.get("AUTH_SMTP_HOST") || "p3plzcpnl507025.prod.phx3.secureserver.net";
const SMTP_USER = Deno.env.get("AUTH_SMTP_USER") || "noreply@wakti.ai";
const SMTP_PASS = Deno.env.get("AUTH_SMTP_PASS") || "";
const FROM_HEADER = "Wakti AI <noreply@wakti.ai>";

// ---------- helpers ----------

function base64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64Utf8(text: string): string {
  return base64FromBytes(new TextEncoder().encode(text));
}

/** RFC 2047 encoded-word for non-ASCII header values (e.g. Arabic subjects). */
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${base64Utf8(value)}?=`;
}

/** Wrap a base64 body at 76 chars per RFC 2045. */
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, "$&\r\n");
}

// ---------- minimal SMTP client (TLS 465 / STARTTLS 587) ----------

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
    if (code !== expected) throw new Error(`SMTP error ${code}: ${line}`);
    return line;
  }

  private async write(data: string): Promise<void> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(data));
  }

  async connect(): Promise<void> {
    this.conn = this.secure
      ? await Deno.connectTls({ hostname: this.host, port: this.port })
      : await Deno.connect({ hostname: this.host, port: this.port });
    this.reader = this.conn.readable.getReader();
    await this.expectCode(220);
  }

  async ehlo(): Promise<void> {
    await this.write(`EHLO wakti.ai\r\n`);
    let line = await this.readLine();
    while (line.startsWith("250-")) line = await this.readLine();
    if (!line.startsWith("250 ")) throw new Error(`EHLO failed: ${line}`);
  }

  async startTls(): Promise<void> {
    await this.write(`STARTTLS\r\n`);
    await this.expectCode(220);
    if (!this.conn) throw new Error("No connection");
    this.conn = await Deno.startTls(this.conn, { hostname: this.host });
    this.reader = this.conn.readable.getReader();
    await this.ehlo();
  }

  async authLogin(): Promise<void> {
    await this.write(`AUTH LOGIN\r\n`);
    await this.expectCode(334);
    await this.write(btoa(this.username) + "\r\n");
    await this.expectCode(334);
    await this.write(btoa(this.password) + "\r\n");
    await this.expectCode(235);
  }

  async send(from: string, to: string, subject: string, html: string): Promise<void> {
    await this.write(`MAIL FROM:<${from}>\r\n`);
    await this.expectCode(250);
    await this.write(`RCPT TO:<${to}>\r\n`);
    await this.expectCode(250);
    await this.write(`DATA\r\n`);
    await this.expectCode(354);

    const messageId = `<${crypto.randomUUID()}@wakti.ai>`;
    const msg =
      `Message-ID: ${messageId}\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `From: ${encodeHeaderValue(FROM_HEADER)}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${encodeHeaderValue(subject)}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: base64\r\n` +
      `\r\n` +
      wrap76(base64Utf8(html)) +
      `\r\n.\r\n`;
    await this.write(msg);
    await this.expectCode(250);
  }

  async quit(): Promise<void> {
    try {
      await this.write(`QUIT\r\n`);
      await this.expectCode(221);
    } catch { /* best effort */ }
    try { await this.reader?.cancel(); } catch { /* ignore */ }
    try { this.conn?.close(); } catch { /* ignore */ }
  }
}

async function sendSmtpOnce(port: number, secure: boolean, to: string, subject: string, html: string): Promise<void> {
  const client = new SmtpClient(SMTP_HOST, port, secure, SMTP_USER, SMTP_PASS);
  try {
    await client.connect();
    await client.ehlo();
    if (!secure && port === 587) await client.startTls();
    await client.authLogin();
    await client.send(SMTP_USER, to, subject, html);
    await client.quit();
  } catch (err) {
    try { await client.quit(); } catch { /* ignore */ }
    throw err;
  }
}

/** Try implicit TLS (465) first; fall back to STARTTLS (587). */
async function sendAuthEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await sendSmtpOnce(465, true, to, subject, html);
  } catch (err) {
    console.warn("[auth-email-hook] 465 failed, retrying on 587:", err instanceof Error ? err.message : err);
    await sendSmtpOnce(587, false, to, subject, html);
  }
}

// ---------- email content ----------

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
}

function buildConfirmationUrl(ed: EmailData): string {
  const url = new URL(`${SUPABASE_URL}/auth/v1/verify`);
  const isNewEmailChange = ed.email_action_type === "email" && ed.token_hash_new;
  url.searchParams.set("token", isNewEmailChange ? ed.token_hash_new : ed.token_hash);
  url.searchParams.set("type", isNewEmailChange ? "email_change" : ed.email_action_type);
  url.searchParams.set("redirect_to", ed.redirect_to || ed.site_url || "");
  return url.toString();
}

interface EmailCopy {
  subject: string;
  headingEn: string;
  bodyEn: string;
  buttonEn: string;
  headingAr: string;
  bodyAr: string;
  buttonAr: string;
  showCode: boolean;
}

function copyFor(type: string): EmailCopy {
  switch (type) {
    case "recovery":
      return {
        subject: "Reset your Wakti password — إعادة تعيين كلمة المرور",
        headingEn: "Reset your password",
        bodyEn: "We received a request to reset your Wakti password. Click the button below to choose a new one. This link works once and expires soon. If you didn't request this, you can safely ignore this email.",
        buttonEn: "Reset Password",
        headingAr: "إعادة تعيين كلمة المرور",
        bodyAr: "وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في وقتي. اضغط الزر أدناه لاختيار كلمة مرور جديدة. هذا الرابط يعمل مرة واحدة وينتهي قريبًا. إذا لم تطلب هذا، يمكنك تجاهل هذا البريد بأمان.",
        buttonAr: "إعادة تعيين كلمة المرور",
        showCode: false,
      };
    case "signup":
      return {
        subject: "Welcome to Wakti — confirm your email — تأكيد بريدك الإلكتروني",
        headingEn: "Welcome to Wakti!",
        bodyEn: "Thanks for signing up. Click the button below to confirm your email address and activate your account.",
        buttonEn: "Confirm Email",
        headingAr: "أهلاً بك في وقتي!",
        bodyAr: "شكرًا لتسجيلك. اضغط الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.",
        buttonAr: "تأكيد البريد الإلكتروني",
        showCode: false,
      };
    case "magiclink":
      return {
        subject: "Your Wakti sign-in link — رابط تسجيل الدخول",
        headingEn: "Your sign-in link",
        bodyEn: "Click the button below to sign in to Wakti. This link works once and expires soon.",
        buttonEn: "Sign In",
        headingAr: "رابط تسجيل الدخول",
        bodyAr: "اضغط الزر أدناه لتسجيل الدخول إلى وقتي. هذا الرابط يعمل مرة واحدة وينتهي قريبًا.",
        buttonAr: "تسجيل الدخول",
        showCode: false,
      };
    case "invite":
      return {
        subject: "You're invited to Wakti — تمت دعوتك إلى وقتي",
        headingEn: "You're invited!",
        bodyEn: "You've been invited to join Wakti. Click the button below to accept and create your account.",
        buttonEn: "Accept Invitation",
        headingAr: "تمت دعوتك!",
        bodyAr: "تمت دعوتك للانضمام إلى وقتي. اضغط الزر أدناه للقبول وإنشاء حسابك.",
        buttonAr: "قبول الدعوة",
        showCode: false,
      };
    case "email_change":
    case "email":
      return {
        subject: "Confirm your new email — تأكيد بريدك الإلكتروني الجديد",
        headingEn: "Confirm your new email",
        bodyEn: "Click the button below to confirm this address as the new email for your Wakti account. If you didn't request this, you can safely ignore this email.",
        buttonEn: "Confirm New Email",
        headingAr: "تأكيد بريدك الإلكتروني الجديد",
        bodyAr: "اضغط الزر أدناه لتأكيد هذا العنوان كبريد إلكتروني جديد لحسابك في وقتي. إذا لم تطلب هذا، يمكنك تجاهل هذا البريد بأمان.",
        buttonAr: "تأكيد البريد الجديد",
        showCode: false,
      };
    case "reauthentication":
      return {
        subject: "Your Wakti verification code — رمز التحقق",
        headingEn: "Your verification code",
        bodyEn: "Use the code below to verify your identity. It expires soon — don't share it with anyone.",
        buttonEn: "",
        headingAr: "رمز التحقق الخاص بك",
        bodyAr: "استخدم الرمز أدناه للتحقق من هويتك. ينتهي قريبًا — لا تشاركه مع أحد.",
        buttonAr: "",
        showCode: true,
      };
    default:
      // Account notifications (password changed, email changed, etc.)
      return {
        subject: "Wakti account notice — تنبيه حساب وقتي",
        headingEn: "Account notice",
        bodyEn: "This is a notification about a security change on your Wakti account. If you didn't make this change, please reset your password immediately.",
        buttonEn: "",
        headingAr: "تنبيه حساب",
        bodyAr: "هذا تنبيه حول تغيير أمني في حسابك في وقتي. إذا لم تقم بهذا التغيير، يرجى إعادة تعيين كلمة المرور فورًا.",
        buttonAr: "",
        showCode: false,
      };
  }
}

function renderEmail(copy: EmailCopy, confirmationUrl: string, otpCode: string): string {
  const button = (label: string, dir: string) =>
    label
      ? `<a href="${confirmationUrl}" dir="${dir}" style="display:inline-block;background:#060541;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:12px;margin:8px 0;">${label}</a>`
      : "";
  const linkFallback = confirmationUrl
    ? `<p style="font-size:12px;color:#858384;word-break:break-all;">${confirmationUrl}</p>`
    : "";
  const codeBox = copy.showCode
    ? `<div style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f2f2f2;border-radius:12px;padding:16px;text-align:center;margin:16px 0;">${otpCode}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:24px 0;">
      <span style="font-size:32px;font-weight:800;color:#060541;letter-spacing:4px;">WAKTI</span>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(6,5,65,0.06);">
      <div dir="ltr" style="text-align:left;">
        <h1 style="font-size:22px;color:#060541;margin:0 0 12px;">${copy.headingEn}</h1>
        <p style="font-size:15px;color:#3a3a3f;line-height:1.6;margin:0 0 16px;">${copy.bodyEn}</p>
        ${codeBox}
        ${button(copy.buttonEn, "ltr")}
        ${copy.buttonEn ? linkFallback : ""}
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
      <div dir="rtl" style="text-align:right;">
        <h1 style="font-size:22px;color:#060541;margin:0 0 12px;">${copy.headingAr}</h1>
        <p style="font-size:15px;color:#3a3a3f;line-height:1.8;margin:0 0 16px;">${copy.bodyAr}</p>
        ${codeBox}
        ${button(copy.buttonAr, "rtl")}
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#858384;padding:20px 0;">
      Wakti AI · wakti.qa<br>
      If you didn't request this email, you can safely ignore it.<br>
      إذا لم تطلب هذا البريد، يمكنك تجاهله بأمان.
    </p>
  </div>
</body>
</html>`;
}

// ---------- hook entry point ----------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }
  if (!SMTP_PASS) {
    console.error("[auth-email-hook] AUTH_SMTP_PASS secret is not set");
    return new Response(JSON.stringify({ error: { code: 500, msg: "Email sender not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace("v1,whsec_", "");

  let user: { email?: string };
  let emailData: EmailData;
  try {
    const wh = new Webhook(hookSecret);
    const verified = wh.verify(payload, headers) as { user: { email?: string }; email_data: EmailData };
    user = verified.user;
    emailData = verified.email_data;
  } catch (err) {
    console.warn("[auth-email-hook] signature verification failed:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: { code: 401, msg: "Invalid hook signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const recipient = user.email;
  if (!recipient) {
    return new Response(JSON.stringify({ error: { code: 400, msg: "No recipient email" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Answer Auth fast (GoTrue's hook timeout is 5s, slower than GoDaddy SMTP
  // from the edge network), then finish sending in the background.
  const sendJob = (async () => {
    const confirmationUrl = buildConfirmationUrl(emailData);
    const copy = copyFor(emailData.email_action_type);
    const html = renderEmail(copy, confirmationUrl, emailData.token);
    await sendAuthEmail(recipient, copy.subject, html);
    console.log(`[auth-email-hook] sent ${emailData.email_action_type} email to ${recipient}`);
  })();

  try {
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      sendJob.catch((err) => {
        console.error("[auth-email-hook] background send failed:", err instanceof Error ? err.message : err);
      })
    );
  } catch { /* waitUntil unavailable — fall through to inline await */ }

  if (!(globalThis as any).EdgeRuntime?.waitUntil) {
    try {
      await sendJob;
    } catch (err) {
      console.error("[auth-email-hook] send failed:", err instanceof Error ? err.message : err);
      return new Response(
        JSON.stringify({ error: { code: 500, msg: "Failed to send email", details: err instanceof Error ? err.message : String(err) } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
