/**
 * Welcome Email — sends Wakti's own branded welcome + email-confirmation
 * message through SMTP2GO's HTTP API.
 *
 * Why this exists: Supabase "Confirm email" is OFF (we don't wall new users
 * out of the app), so Supabase sends nothing at signup. This function is our
 * soft-confirmation layer: it mints a confirm token on the profile and emails
 * the user a link to /confirm-email. The Account page nags + locks sensitive
 * changes until the profile flag flips to confirmed.
 *
 * Called by the app right after email signup (and from the Account page
 * "Resend" button). Requires the caller's JWT — identity comes from the token,
 * never from the request body.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hxauxozopvpzpdygoqwf.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SMTP2GO_API_KEY = Deno.env.get("SMTP2GO_API_KEY") || "";
const FROM_HEADER = "Wakti AI <noreply@wakti.ai>";
const LOGO_URL = "https://www.wakti.qa/apple-touch-icon.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Only allow our own surfaces as link origins. */
function safeOrigin(raw: unknown): string {
  const fallback = "https://www.wakti.qa";
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host === "wakti.qa" || host === "www.wakti.qa" || host === "localhost" || host === "127.0.0.1") {
      return raw.replace(/\/$/, "");
    }
  } catch { /* fall through */ }
  return fallback;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": SMTP2GO_API_KEY,
    },
    body: JSON.stringify({ sender: FROM_HEADER, to: [to], subject, html_body: html }),
  });
  const result = await res.json().catch(() => ({}));
  const failures = result?.data?.failures;
  if (!res.ok || (Array.isArray(failures) && failures.length > 0)) {
    throw new Error(`SMTP2GO send failed: HTTP ${res.status} ${JSON.stringify(result).slice(0, 300)}`);
  }
}

function renderWelcome(lang: "en" | "ar", confirmUrl: string): { subject: string; html: string } {
  const isAr = lang === "ar";
  const copy = isAr
    ? {
        subject: "أهلاً بك في وقتي — أكد بريدك الإلكتروني",
        heading: "أهلاً بك في وقتي!",
        body: "أصبحت معنا. ضغطة واحدة أدناه تؤكد بريدك الإلكتروني وتفتح لك كل شيء — بما فيها إعدادات كلمة المرور والحساب.",
        button: "تأكيد بريدي الإلكتروني",
        ignore: "إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذا البريد بأمان.",
        tagline: "تطبيقك الذكي الشامل",
      }
    : {
        subject: "Welcome to Wakti — confirm your email",
        heading: "Welcome to Wakti!",
        body: "You're in. One quick click below confirms your email and unlocks everything — including password and account settings.",
        button: "Confirm My Email",
        ignore: "If you didn't create this account, you can safely ignore this email.",
        tagline: "ALL IN ONE AI APP",
      };

  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0c0f14;font-family:'Segoe UI',Tahoma,'Noto Sans Arabic',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0f14;">
    <tr><td align="center" bgcolor="#0c0f14" style="padding:64px 16px 48px;background-color:#0c0f14;background-image:linear-gradient(rgba(140,160,200,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(140,160,200,0.08) 1px,transparent 1px);background-size:44px 44px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Hero: logo with warm glow + wordmark -->
        <tr><td align="center" style="padding-bottom:40px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="background:#0c0f14;background:radial-gradient(closest-side,rgba(233,206,176,0.22),rgba(233,206,176,0) 72%);padding:20px 36px;">
              <img src="${LOGO_URL}" width="72" height="72" alt="WAKTI" style="display:block;border-radius:18px;">
            </td></tr>
          </table>
          <div dir="ltr" style="margin-top:16px;font-size:22px;font-weight:300;letter-spacing:10px;color:#f2f2f2;">WAKTI</div>
          <div style="margin-top:8px;font-size:10px;font-weight:600;letter-spacing:${isAr ? "0" : "3"}px;color:#858384;">${copy.tagline}</div>
        </td></tr>

        <!-- Glass card -->
        <tr><td bgcolor="#11151d" style="background:#11151d;border:1px solid #1f2632;border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,0.5);">
          <div dir="${dir}" style="text-align:${align};padding:44px 40px 40px;">
            <h1 style="font-size:22px;color:#f2f2f2;margin:0 0 14px;font-weight:700;line-height:1.4;">${copy.heading}</h1>
            <p style="font-size:15px;color:#a4a4ab;line-height:1.9;margin:0;">${copy.body}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:34px 0 6px;">
              <tr><td align="center" bgcolor="#060541" style="background:#060541;border:1px solid #33336b;border-radius:999px;box-shadow:0 0 28px rgba(61,139,255,0.28);">
                <a href="${confirmUrl}" style="display:inline-block;padding:16px 46px;font-size:15px;font-weight:700;letter-spacing:0.6px;color:#ffffff;text-decoration:none;">${copy.button}</a>
              </td></tr>
            </table>
            <p style="font-size:12px;color:#606062;line-height:1.7;margin:34px 0 0;padding-top:22px;border-top:1px solid #1f2632;">${copy.ignore}</p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:34px;">
          <p style="font-size:11px;color:#4a4a4e;margin:0;line-height:1.8;letter-spacing:1px;">
            <span style="font-weight:800;color:#858384;">WAKTI</span> &nbsp;·&nbsp; <a href="https://www.wakti.qa" style="color:#606062;text-decoration:none;">wakti.qa</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "not allowed" }, 400);
  if (!SMTP2GO_API_KEY) {
    console.error("[welcome-email] SMTP2GO_API_KEY secret is not set");
    return json({ error: "Email sender not configured" }, 500);
  }

  // Identity always from the caller's JWT — never trust the body.
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.email) {
    return json({ error: "unauthorized" }, 401);
  }

  // OAuth users arrive provider-verified — nothing to confirm.
  const provider = user.app_metadata?.provider;
  if (provider && provider !== "email") {
    return json({ ok: true, skipped: "oauth" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile } = await admin
    .from("profiles")
    .select("email_confirmed, email_confirm_token")
    .eq("id", user.id)
    .single();

  if (profile?.email_confirmed) {
    return json({ ok: true, alreadyConfirmed: true });
  }

  const token = profile?.email_confirm_token || crypto.randomUUID();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ email_confirm_token: token, email_confirmed: false })
    .eq("id", user.id);
  if (updateError) {
    console.error("[welcome-email] profile update failed:", updateError.message);
    return json({ error: "profile update failed" }, 500);
  }

  let body: { lang?: string; origin?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const lang = body.lang === "ar" ? "ar" : "en";
  const confirmUrl = `${safeOrigin(body.origin)}/confirm-email?token=${token}`;

  try {
    const { subject, html } = renderWelcome(lang, confirmUrl);
    await sendEmail(user.email, subject, html);
    console.log(`[welcome-email] sent (${lang}) to ${user.email}`);
    return json({ ok: true });
  } catch (err) {
    console.error("[welcome-email] send failed:", err instanceof Error ? err.message : err);
    return json({ error: "send failed" }, 500);
  }
});
