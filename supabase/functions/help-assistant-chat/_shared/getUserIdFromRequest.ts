/**
 * Fast user ID extraction from JWT token (no network call).
 * Used for logging purposes only - not for security verification.
 * If token is missing/invalid, returns null (logs as "Unknown user").
 */
export function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return null;
    }

    // Extract Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return null;
    }

    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64url)
    const payloadB64 = parts[1];
    // Convert base64url to base64
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    // Decode
    const payloadJson = atob(base64);
    const payload = JSON.parse(payloadJson);

    // Supabase JWT uses "sub" for user ID
    const userId = payload.sub;
    if (typeof userId === "string" && userId.length > 0) {
      return userId;
    }

    return null;
  } catch {
    return null;
  }
}
