/**
 * Auth Email Hook — sends Supabase Auth emails (password reset, signup
 * confirm, magic link, OTP) through SMTP2GO's HTTP API.
 *
 * Why this exists: Supabase's built-in message builder omits the Message-ID
 * header (Gmail rejects those, 550 5.7.1), and direct SMTP relays get
 * firewall-blocked from Supabase's network. The HTTP API has neither problem,
 * and lets us ship bilingual branded templates with full header control.
 *
 * Wired up via: Supabase Dashboard → Authentication → Auth Hooks → Send Email.
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hxauxozopvpzpdygoqwf.supabase.co";
const SMTP2GO_API_KEY = Deno.env.get("SMTP2GO_API_KEY") || "";
const FROM_HEADER = "Wakti AI <noreply@wakti.ai>";

// ---------- SMTP2GO HTTP API ----------

async function sendAuthEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": SMTP2GO_API_KEY,
    },
    body: JSON.stringify({
      sender: FROM_HEADER,
      to: [to],
      subject,
      html_body: html,
    }),
  });

  const result = await res.json().catch(() => ({}));
  const failures = result?.data?.failures;
  if (!res.ok || (Array.isArray(failures) && failures.length > 0)) {
    throw new Error(`SMTP2GO send failed: HTTP ${res.status} ${JSON.stringify(result).slice(0, 300)}`);
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
  if (!SMTP2GO_API_KEY) {
    console.error("[auth-email-hook] SMTP2GO_API_KEY secret is not set");
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

  // The HTTP API answers in milliseconds — well inside GoTrue's 5s hook
  // timeout — so we send inline and report real failures back to Auth.
  try {
    const confirmationUrl = buildConfirmationUrl(emailData);
    const copy = copyFor(emailData.email_action_type);
    const html = renderEmail(copy, confirmationUrl, emailData.token);
    await sendAuthEmail(recipient, copy.subject, html);
    console.log(`[auth-email-hook] sent ${emailData.email_action_type} email to ${recipient}`);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[auth-email-hook] send failed:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: { code: 500, msg: "Failed to send email", details: err instanceof Error ? err.message : String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
