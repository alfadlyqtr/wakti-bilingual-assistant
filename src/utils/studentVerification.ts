import { supabase } from "@/integrations/supabase/client";

export type StudentVerificationStatus = "verified" | "unverified" | "skipped";
export type StudentVerificationOutcome = "verified" | "not_verified" | "integration_unavailable";

type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export interface StudentVerificationResult {
  outcome: StudentVerificationOutcome;
  portalUrl: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function verifyStudentAccountWithRealX(email: string): Promise<StudentVerificationResult> {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.functions.invoke("verify-student-realx", {
    body: { email: normalizedEmail },
  });

  const portalUrl = sanitizeUrl(data?.portalUrl);

  if (error) {
    console.error("[studentVerification] realX verification invoke failed:", error);
    return { outcome: "integration_unavailable", portalUrl };
  }

  if (data?.status === "verified") {
    return { outcome: "verified", portalUrl };
  }

  if (data?.status === "not_verified") {
    return { outcome: "not_verified", portalUrl };
  }

  return { outcome: "integration_unavailable", portalUrl };
}

export function buildStudentVerificationMetadata(options: {
  selected: boolean;
  status: StudentVerificationStatus;
}) {
  const { selected, status } = options;
  const verified = selected && status === "verified";

  return {
    student_account_from_realx: selected,
    student_verification_status: status,
    student_partner_source: selected ? "realx" : null,
    student_partner_label: selected ? "realX" : null,
    student_partner_verified: verified,
    student_partner_verified_at: verified ? new Date().toISOString() : null,
  };
}

export function isStudentEligibleForQU(user: UserLike | null | undefined) {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const status = typeof metadata.student_verification_status === "string"
    ? metadata.student_verification_status
    : null;

  if (status === "verified") return true;
  if (status === "unverified" || status === "skipped") return false;

  return !!user?.email?.trim().toLowerCase().endsWith("@qu.edu.qa");
}
