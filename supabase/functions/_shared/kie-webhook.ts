/**
 * KIE.ai webhook signature verification (HMAC-SHA256).
 *
 * KIE signs every callback with a webhook HMAC key that is generated on the
 * KIE settings page (https://kie.ai/settings). Once the key is stored here as
 * the KIE_WEBHOOK_HMAC_KEY secret, every callback carries:
 *   X-Webhook-Timestamp: unix seconds when the callback was sent
 *   X-Webhook-Signature: base64(HMAC-SHA256(taskId + "." + timestamp, key))
 *
 * Behavior:
 *  - Key configured  → signature is REQUIRED and must match (rejects with 401).
 *  - Key missing     → request is allowed but a warning is logged. This keeps
 *                      music working during rollout; set the secret to enforce.
 */

const KIE_WEBHOOK_HMAC_KEY = () => Deno.env.get("KIE_WEBHOOK_HMAC_KEY") ?? "";

// Tolerate 10 minutes of clock skew / delivery delay; blocks replay of old requests.
const MAX_TIMESTAMP_SKEW_SECONDS = 600;

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface KieWebhookVerification {
  ok: boolean;
  enforced: boolean;
  reason?: string;
}

export async function verifyKieWebhookSignature(
  req: Request,
  taskId: string | null | undefined,
  logTag: string,
): Promise<KieWebhookVerification> {
  const secret = KIE_WEBHOOK_HMAC_KEY();

  if (!secret) {
    console.warn(`[${logTag}] KIE_WEBHOOK_HMAC_KEY not configured — callback accepted WITHOUT signature check`);
    return { ok: true, enforced: false };
  }

  if (!taskId) {
    return { ok: false, enforced: true, reason: "Missing taskId" };
  }

  const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
  const receivedSignature = req.headers.get("x-webhook-signature") ?? "";
  if (!timestamp || !receivedSignature) {
    return { ok: false, enforced: true, reason: "Missing signature headers" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, enforced: true, reason: "Invalid timestamp" };
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, enforced: true, reason: "Stale timestamp (possible replay)" };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${taskId}.${timestamp}`)),
  );
  const expectedSignature = base64FromBytes(signatureBytes);

  if (!timingSafeEqual(expectedSignature, receivedSignature)) {
    return { ok: false, enforced: true, reason: "Signature mismatch" };
  }

  return { ok: true, enforced: true };
}
