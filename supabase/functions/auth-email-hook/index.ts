/**
 * Auth Email Hook — sends Supabase Auth emails (password reset, signup
 * confirm, magic link, OTP) through SMTP2GO's HTTP API.
 *
 * Why this exists: Supabase's built-in message builder omits the Message-ID
 * header (Gmail rejects those, 550 5.7.1), and direct SMTP relays get
 * firewall-blocked from Supabase's network. The HTTP API has neither problem,
 * and lets us ship branded templates in the user's own language.
 *
 * Language: the app appends ?lang=ar|en to the redirect URL when requesting
 * the email; we render the template in that language.
 *
 * Wired up via: Supabase Dashboard → Authentication → Auth Hooks → Send Email.
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hxauxozopvpzpdygoqwf.supabase.co";
const SMTP2GO_API_KEY = Deno.env.get("SMTP2GO_API_KEY") || "";
const FROM_HEADER = "Wakti AI <noreply@wakti.ai>";
const LOGO_URL = "https://www.wakti.qa/apple-touch-icon.png";

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

type Lang = "en" | "ar";

function langFromRedirect(redirectTo: string): Lang {
  try {
    return new URL(redirectTo).searchParams.get("lang") === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
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
  heading: string;
  body: string;
  button: string;
  ignore: string;
  showCode: boolean;
  codeLabel: string;
}

const COPY: Record<string, { en: Omit<EmailCopy, "showCode" | "codeLabel">; ar: Omit<EmailCopy, "showCode" | "codeLabel"> }> = {
  recovery: {
    en: {
      subject: "Reset your Wakti password",
      heading: "Reset your password",
      body: "We received a request to reset your Wakti password. Click the button below to choose a new one — this link works once and expires soon.",
      button: "Reset Password",
      ignore: "If you didn't request this, you can safely ignore this email — your password stays unchanged.",
    },
    ar: {
      subject: "إعادة تعيين كلمة المرور — وقتي",
      heading: "إعادة تعيين كلمة المرور",
      body: "وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في وقتي. اضغط الزر أدناه لاختيار كلمة مرور جديدة — هذا الرابط يعمل مرة واحدة وينتهي قريبًا.",
      button: "إعادة تعيين كلمة المرور",
      ignore: "إذا لم تطلب هذا، يمكنك تجاهل هذا البريد بأمان — كلمة المرور الحالية لن تتغير.",
    },
  },
  signup: {
    en: {
      subject: "Welcome to Wakti — confirm your email",
      heading: "Welcome to Wakti!",
      body: "Thanks for signing up. One last step — confirm your email address to activate your account and start using Wakti.",
      button: "Confirm Email",
      ignore: "If you didn't create this account, you can safely ignore this email.",
    },
    ar: {
      subject: "أهلاً بك في وقتي — أكد بريدك الإلكتروني",
      heading: "أهلاً بك في وقتي!",
      body: "شكرًا لتسجيلك. خطوة أخيرة — أكد بريدك الإلكتروني لتفعيل حسابك والبدء باستخدام وقتي.",
      button: "تأكيد البريد الإلكتروني",
      ignore: "إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذا البريد بأمان.",
    },
  },
  magiclink: {
    en: {
      subject: "Your Wakti sign-in link",
      heading: "Your sign-in link",
      body: "Click the button below to sign in to Wakti. This link works once and expires soon.",
      button: "Sign In",
      ignore: "If you didn't request this link, you can safely ignore this email.",
    },
    ar: {
      subject: "رابط تسجيل الدخول — وقتي",
      heading: "رابط تسجيل الدخول",
      body: "اضغط الزر أدناه لتسجيل الدخول إلى وقتي. هذا الرابط يعمل مرة واحدة وينتهي قريبًا.",
      button: "تسجيل الدخول",
      ignore: "إذا لم تطلب هذا الرابط، يمكنك تجاهل هذا البريد بأمان.",
    },
  },
  invite: {
    en: {
      subject: "You're invited to Wakti",
      heading: "You're invited!",
      body: "You've been invited to join Wakti — your intelligent digital partner for tasks, events, voice and more. Click below to accept and create your account.",
      button: "Accept Invitation",
      ignore: "If you weren't expecting this invitation, you can safely ignore this email.",
    },
    ar: {
      subject: "تمت دعوتك إلى وقتي",
      heading: "تمت دعوتك!",
      body: "تمت دعوتك للانضمام إلى وقتي — شريكك الرقمي الذكي للمهام والفعاليات والصوت وأكثر. اضغط أدناه للقبول وإنشاء حسابك.",
      button: "قبول الدعوة",
      ignore: "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد بأمان.",
    },
  },
  email_change: {
    en: {
      subject: "Confirm your new email address",
      heading: "Confirm your new email",
      body: "Click the button below to confirm this address as the new email for your Wakti account.",
      button: "Confirm New Email",
      ignore: "If you didn't request this change, you can safely ignore this email.",
    },
    ar: {
      subject: "تأكيد بريدك الإلكتروني الجديد — وقتي",
      heading: "تأكيد بريدك الإلكتروني الجديد",
      body: "اضغط الزر أدناه لتأكيد هذا العنوان كبريد إلكتروني جديد لحسابك في وقتي.",
      button: "تأكيد البريد الجديد",
      ignore: "إذا لم تطلب هذا التغيير، يمكنك تجاهل هذا البريد بأمان.",
    },
  },
  reauthentication: {
    en: {
      subject: "Your Wakti verification code",
      heading: "Your verification code",
      body: "Enter this code to verify your identity. It expires soon — never share it with anyone.",
      button: "",
      ignore: "If you didn't request this code, you can safely ignore this email.",
    },
    ar: {
      subject: "رمز التحقق — وقتي",
      heading: "رمز التحقق الخاص بك",
      body: "أدخل هذا الرمز للتحقق من هويتك. ينتهي قريبًا — لا تشاركه مع أحد أبدًا.",
      button: "",
      ignore: "إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.",
    },
  },
  notice: {
    en: {
      subject: "Wakti account security notice",
      heading: "Account security notice",
      body: "This is a notification about a security change on your Wakti account.",
      button: "",
      ignore: "If you didn't make this change, please reset your password immediately.",
    },
    ar: {
      subject: "تنبيه أمني لحساب وقتي",
      heading: "تنبيه أمني للحساب",
      body: "هذا تنبيه حول تغيير أمني في حسابك في وقتي.",
      button: "",
      ignore: "إذا لم تقم بهذا التغيير، يرجى إعادة تعيين كلمة المرور فورًا.",
    },
  },
};

function copyFor(type: string, lang: Lang): EmailCopy {
  const key = type === "email" ? "email_change" : type;
  const entry = COPY[key] || COPY.notice;
  const base = entry[lang];
  return {
    ...base,
    showCode: key === "reauthentication",
    codeLabel: key === "reauthentication" ? base.heading : "",
  };
}

function renderEmail(copy: EmailCopy, lang: Lang, confirmationUrl: string, otpCode: string): string {
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";

  const buttonBlock = copy.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 4px;">
        <tr><td align="center" bgcolor="#060541" style="background:#060541;background:linear-gradient(135deg,#060541 0%,#3b2f8f 55%,#060541 100%);border-radius:16px;box-shadow:0 10px 30px rgba(6,5,65,0.35);">
          <a href="${confirmationUrl}" style="display:inline-block;padding:18px 48px;font-size:16px;font-weight:700;letter-spacing:0.4px;color:#ffffff;text-decoration:none;">${copy.button}</a>
        </td></tr>
      </table>`
    : "";

  const codeBlock = copy.showCode
    ? `<div dir="ltr" style="font-size:38px;letter-spacing:12px;font-weight:800;color:#060541;background:#f4f4f9;border:1px solid #e6e4f5;border-radius:16px;padding:22px;text-align:center;margin:28px 0 8px;">${otpCode}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0c0f14;font-family:'Segoe UI',Tahoma,'Noto Sans Arabic',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0f14;">
    <tr><td align="center" style="padding:56px 16px 48px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Logo with glow tile -->
        <tr><td align="center" style="padding-bottom:32px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td align="center" bgcolor="#151a23" style="background:#151a23;background:linear-gradient(135deg,#151a23 0%,#1c2333 100%);border-radius:20px;border:1px solid #232c3d;padding:12px;box-shadow:0 0 40px rgba(61,139,255,0.25),0 0 80px rgba(176,106,224,0.12);">
              <img src="${LOGO_URL}" width="56" height="56" alt="WAKTI" style="display:block;border-radius:12px;">
            </td></tr>
          </table>
          <div style="margin-top:14px;font-size:15px;font-weight:800;letter-spacing:6px;color:#f2f2f2;">WAKTI</div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,0.45);">
          <!-- vibrant accent strip -->
          <div style="height:6px;border-radius:24px 24px 0 0;background:#3d8bff;background:linear-gradient(90deg,#3d8bff 0%,#b06ae0 50%,#f98a4b 100%);font-size:0;line-height:0;">&nbsp;</div>
          <div dir="${dir}" style="text-align:${align};padding:44px 40px 40px;">
            <h1 style="font-size:26px;color:#060541;margin:0 0 14px;font-weight:800;line-height:1.35;">${copy.heading}</h1>
            <p style="font-size:15px;color:#46464d;line-height:1.9;margin:0;">${copy.body}</p>
            ${codeBlock}
            ${buttonBlock}
            <p style="font-size:12px;color:#858384;line-height:1.7;margin:32px 0 0;padding-top:22px;border-top:1px solid #f0f0f4;">${copy.ignore}</p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:32px;">
          <p style="font-size:12px;color:#606062;margin:0;line-height:1.7;">
            <span style="font-weight:800;letter-spacing:2px;color:#9a9a9d;">WAKTI</span><span style="color:#3d3d40;"> &nbsp;·&nbsp; </span><a href="https://www.wakti.qa" style="color:#3d8bff;text-decoration:none;">wakti.qa</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
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
    const lang = langFromRedirect(emailData.redirect_to);
    const copy = copyFor(emailData.email_action_type, lang);
    const html = renderEmail(copy, lang, confirmationUrl, emailData.token);
    await sendAuthEmail(recipient, copy.subject, html);
    console.log(`[auth-email-hook] sent ${emailData.email_action_type} (${lang}) email to ${recipient}`);
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
