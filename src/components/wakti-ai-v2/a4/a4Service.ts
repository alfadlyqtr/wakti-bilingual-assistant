// A4 Document Builder — Frontend Service Client
// -----------------------------------------------------------------------------
// Thin wrapper around the a4-generate edge function + a Realtime subscription
// helper for watching user_a4_documents rows stream from queued → completed.
// -----------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import { PDFDocument } from "pdf-lib";

export type A4Orientation = "portrait" | "landscape";
export type A4FontFamily = "modern_sans" | "classic_serif" | "elegant_script" | "bold_display" | "playful_hand";
export type A4BorderStyle = "none" | "thin" | "thick" | "rounded" | "decorative";
export type A4Density = "compact" | "balanced" | "airy";
export type A4Tone = "professional" | "friendly" | "playful" | "formal";

export interface A4DesignSettings {
  orientation?: A4Orientation;
  background_color?: string | null;
  text_color?: string | null;
  accent_color?: string | null;
  font_family?: A4FontFamily;
  border_style?: A4BorderStyle;
  include_decorative_images?: boolean;
  density?: A4Density;
  tone?: A4Tone;
}

// -----------------------------------------------------------------------------
// Creative controls — rich per-document direction that replaces the thin
// include_* toggles. Each value maps to a specific prompt fragment on the
// backend. No AI middleman — what the user clicks is what the image model sees.
// -----------------------------------------------------------------------------
export type A4VisualRecipe =
  | "paper_craft_flatlay"
  | "executive_tech_spec"
  | "comic_triptych"
  | "ministry_exam"
  | "menu_board"
  | "craft_diy_explainer"
  | "minimal_stationery"
  | "bold_poster";

export type A4IllustrationStyle =
  | "none"
  | "icons"
  | "flat_vector"
  | "paper_craft"
  | "watercolor"
  | "comic_bold"
  | "photo_realistic";

export type A4AccentElement =
  | "hand_drawn_arrows"
  | "ribbons"
  | "stars"
  | "corner_ornaments"
  | "callout_badges"
  | "dotted_dividers"
  | "paper_tape"
  | "thread_connectors";

export type A4BackgroundTreatment =
  | "plain_white"
  | "soft_paper_texture"
  | "light_gradient"
  | "subtle_grid"
  | "botanical_motif"
  | "confetti"
  | "photographic_backdrop";

export type A4ContentComponent =
  | "chart_bar"
  | "chart_line"
  | "chart_donut"
  | "chart_radar"
  | "data_table"
  | "timeline"
  | "step_flow"
  | "side_by_side"
  | "vitality_wheel"
  | "info_cards"
  | "grading_circle"
  | "pull_quote"
  | "callout_boxes";

export type A4LayoutPattern =
  | "single_column"
  | "two_column_split"
  | "sidebar_main"
  | "three_panel_grid"
  | "hero_body"
  | "centered_composition";

export interface A4CreativeSettings {
  visual_recipe?: A4VisualRecipe | null;
  illustration_style?: A4IllustrationStyle | null;
  accent_elements?: A4AccentElement[] | null;
  background_treatment?: A4BackgroundTreatment | null;
  content_components?: A4ContentComponent[] | null;
  layout_pattern?: A4LayoutPattern | null;
}

export interface A4GenerateRequest {
  theme_id: string;
  purpose_id?: string | null;
  form_state: Record<string, unknown>;
  logo_data_url?: string | null;
  logo_color_extract?: boolean;
  requested_pages?: "auto" | 1 | 2 | 3;
  language_mode?: "en" | "ar" | "bilingual";
  design_settings?: A4DesignSettings | null;
  creative_settings?: A4CreativeSettings | null;
}

export interface A4FetchUrlResponse {
  success: boolean;
  error?: string;
  title?: string | null;
  detected_language?: "en" | "ar" | "mixed";
  content?: string;
}

export async function fetchUrlContent(url: string): Promise<A4FetchUrlResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { success: false, error: "Not signed in" };

  const resp = await supabase.functions.invoke<A4FetchUrlResponse>("a4-fetch-url", {
    body: { url },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.error) return { success: false, error: resp.error.message };
  return resp.data ?? { success: false, error: "Empty response" };
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

export interface A4HistoryBatch {
  batch_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  total_pages: number;
  completed_pages: number;
  failed_pages: number;
  status: "completed" | "partial" | "failed" | "generating";
  preview_image_url: string | null;
  rows: A4DocumentRow[];
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

export async function fetchA4History(limit = 60): Promise<A4HistoryBatch[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_a4_documents")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 3, 120));

  if (error) {
    console.error("[a4Service] fetchA4History error:", error);
    return [];
  }

  const grouped = new Map<string, A4DocumentRow[]>();
  for (const row of (data ?? []) as A4DocumentRow[]) {
    const rows = grouped.get(row.batch_id);
    if (rows) rows.push(row);
    else grouped.set(row.batch_id, [row]);
  }

  return Array.from(grouped.values())
    .map((rows) => {
      const sortedRows = rows.slice().sort((a, b) => a.page_number - b.page_number);
      const completedRows = sortedRows.filter((row) => row.status === "completed" && row.image_url);
      const failedRows = sortedRows.filter((row) => row.status === "failed");
      const previewRow =
        completedRows.find((row) => row.page_number === 1) ??
        completedRows[0] ??
        sortedRows.find((row) => !!row.image_url) ??
        sortedRows[0];

      const updatedAt = sortedRows.reduce(
        (latest, row) => (new Date(row.updated_at).getTime() > new Date(latest).getTime() ? row.updated_at : latest),
        sortedRows[0]?.updated_at ?? new Date(0).toISOString(),
      );

      let status: A4HistoryBatch["status"] = "generating";
      if (completedRows.length === sortedRows.length && sortedRows.length > 0) status = "completed";
      else if (completedRows.length > 0) status = "partial";
      else if (failedRows.length === sortedRows.length && sortedRows.length > 0) status = "failed";

      return {
        batch_id: sortedRows[0]?.batch_id ?? "",
        title: previewRow?.title ?? sortedRows[0]?.title ?? null,
        created_at: sortedRows[0]?.created_at ?? updatedAt,
        updated_at: updatedAt,
        total_pages: sortedRows[0]?.total_pages ?? sortedRows.length,
        completed_pages: completedRows.length,
        failed_pages: failedRows.length,
        status,
        preview_image_url: previewRow?.image_url ?? null,
        rows: sortedRows,
      };
    })
    .filter((batch) => batch.completed_pages > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit);
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "_")
    .trim();
  return cleaned || "wakti-a4";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getCompletedRows(rows: A4DocumentRow[]) {
  return rows
    .filter((row) => row.status === "completed" && row.image_url)
    .slice()
    .sort((a, b) => a.page_number - b.page_number);
}

export function getA4DownloadBaseName(rows: A4DocumentRow[], fallback = "wakti-a4") {
  return sanitizeFilename(rows[0]?.title ?? fallback);
}

export async function downloadA4RowsAsPdf(rows: A4DocumentRow[], fallbackName = "wakti-a4") {
  const completed = getCompletedRows(rows);
  if (completed.length === 0) throw new Error("No completed A4 pages available");

  const pdfDoc = await PDFDocument.create();
  for (const row of completed) {
    const resp = await fetch(String(row.image_url));
    if (!resp.ok) throw new Error(`Image fetch failed (${resp.status})`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let embedded;
    try {
      embedded = await pdfDoc.embedJpg(bytes);
    } catch {
      embedded = await pdfDoc.embedPng(bytes);
    }
    const page = pdfDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  triggerDownload(blob, `${getA4DownloadBaseName(completed, fallbackName)}.pdf`);
}

export async function downloadA4RowsAsJpgs(rows: A4DocumentRow[], fallbackName = "wakti-a4") {
  const completed = getCompletedRows(rows);
  if (completed.length === 0) throw new Error("No completed A4 pages available");

  const baseName = getA4DownloadBaseName(completed, fallbackName);
  for (const row of completed) {
    const resp = await fetch(String(row.image_url));
    if (!resp.ok) throw new Error(`Image fetch failed (${resp.status})`);
    const blob = await resp.blob();
    const filename = completed.length === 1 ? `${baseName}.jpg` : `${baseName}-page-${row.page_number}.jpg`;
    triggerDownload(blob, filename);
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
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
