// A4 Document Builder — Frontend Service Client
// -----------------------------------------------------------------------------
// Thin wrapper around the a4-generate edge function + a Realtime subscription
// helper for watching user_a4_documents rows stream from queued → completed.
// -----------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";

export interface A4GenerateRequest {
  theme_id: string;
  purpose_id?: string | null;
  form_state: Record<string, unknown>;
  logo_data_url?: string | null;
  logo_color_extract?: boolean;
  requested_pages?: "auto" | 1 | 2 | 3;
  language_mode?: "en" | "ar" | "bilingual";
}

export interface A4GenerateResponse {
  success: boolean;
  error?: string;
  batch_id?: string;
  total_pages?: number;
  suggested_pages?: number;
  detected_language?: "en" | "ar" | "bilingual";
  brand_colors?: { primary?: string; secondary?: string } | null;
  notes?: string;
}

export interface A4DocumentRow {
  id: string;
  user_id: string;
  batch_id: string;
  page_number: number;
  total_pages: number;
  theme_id: string;
  purpose_id: string | null;
  status: "queued" | "generating" | "completed" | "failed";
  error_message: string | null;
  image_url: string | null;
  aspect_ratio: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export async function generateA4Document(
  req: A4GenerateRequest,
): Promise<A4GenerateResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return { success: false, error: "Not signed in" };
  }

  const resp = await supabase.functions.invoke<A4GenerateResponse>("a4-generate", {
    body: req,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resp.error) {
    return { success: false, error: resp.error.message };
  }
  return resp.data ?? { success: false, error: "Empty response" };
}

// -----------------------------------------------------------------------------
// Realtime subscription — pushes every update on rows of a given batch_id.
// -----------------------------------------------------------------------------
export type A4RealtimeCallback = (row: A4DocumentRow) => void;

export function subscribeToBatch(
  batchId: string,
  onUpdate: A4RealtimeCallback,
): () => void {
  const channel = supabase
    .channel(`a4-batch-${batchId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_a4_documents",
        filter: `batch_id=eq.${batchId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as A4DocumentRow | null;
        if (row) onUpdate(row);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// -----------------------------------------------------------------------------
// One-shot fetch of all rows in a batch (used to hydrate initial state).
// -----------------------------------------------------------------------------
export async function fetchBatch(batchId: string): Promise<A4DocumentRow[]> {
  const { data, error } = await supabase
    .from("user_a4_documents")
    .select("*")
    .eq("batch_id", batchId)
    .order("page_number", { ascending: true });
  if (error) {
    console.error("[a4Service] fetchBatch error:", error);
    return [];
  }
  return (data ?? []) as A4DocumentRow[];
}

// -----------------------------------------------------------------------------
// Convert File → data URL (base64) for logo upload in the generate request.
// -----------------------------------------------------------------------------
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("File read error"));
    reader.readAsDataURL(file);
  });
}
