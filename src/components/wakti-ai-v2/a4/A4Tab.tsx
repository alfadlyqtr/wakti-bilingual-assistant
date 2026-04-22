// A4 Document Builder — Main Tab Component
// -----------------------------------------------------------------------------
// Dynamic, theme-driven document generator powered by Nano Banana 2 (via Kie)
// and Gemini 2.5 Flash-Lite (preprocessing).
//
// UX flow:
//   1. User picks a theme (searchable grid).
//   2. If the theme has purpose chips, user picks one.
//   3. Dynamic form renders fields defined by theme+purpose schema.
//   4. User optionally uploads a logo (preserved exactly or extracted for colors).
//   5. User picks page count (Auto / 1 / 2 / 3), clamped by theme max.
//   6. Generate → a4-generate edge function → Realtime row updates stream in.
//   7. User can Download PDF (client-side stitched with pdf-lib) or Start New.
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";
import {
  Search,
  ArrowLeft,
  Loader2,
  Download,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  A4_THEMES,
  findTheme,
  getFormSchema,
  themeRequiresPurpose,
  searchThemes,
  type A4Theme,
  type A4FormField,
} from "./a4Themes";
import {
  generateA4Document,
  subscribeToBatch,
  fetchBatch,
  fileToDataUrl,
  type A4DocumentRow,
} from "./a4Service";

type Stage = "pick" | "form" | "generating" | "done" | "failed";
type PageChoice = "auto" | 1 | 2 | 3;

// Helper: bilingual label
const useTL = () => {
  const { language } = useTheme();
  return {
    lang: language as "en" | "ar",
    t: (en: string, ar: string) => (language === "ar" ? ar : en),
  };
};

// =============================================================================
// THEME PICKER
// =============================================================================
const ThemePicker: React.FC<{ onPick: (themeId: string) => void }> = ({ onPick }) => {
  const { lang, t } = useTL();
  const [query, setQuery] = useState("");
  const themes = useMemo(() => searchThemes(query), [query]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search themes…", "ابحث عن قالب…")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-purple-500/30 bg-background focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-sm"
        />
      </div>

      {themes.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t("No themes match. Try another search.", "لا توجد نتائج. جرّب بحثًا آخر.")}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onPick(theme.id)}
              className="group relative aspect-[4/3] rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 overflow-hidden p-3 text-left active:scale-95"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 transition-opacity" />
              <div className="relative h-full flex flex-col justify-between">
                <div className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold">
                  {theme.aspect_ratio === "3:4" ? t("Portrait", "طولي") : t("Document", "مستند")}
                </div>
                <div className="text-sm font-semibold leading-snug">
                  {lang === "ar" ? theme.name_ar : theme.name_en}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// DYNAMIC FORM FIELD RENDERER
// =============================================================================
const FormFieldRenderer: React.FC<{
  field: A4FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ field, value, onChange }) => {
  const { lang, t } = useTL();
  const label = lang === "ar" ? field.label_ar : field.label_en;
  const accent =
    "border-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500";

  const commonWrapperCls = "mb-3";
  const labelCls = "block text-xs font-medium mb-1.5 text-foreground/80";

  switch (field.type) {
    case "text":
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm ${accent}`}
          />
        </div>
      );
    case "number":
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm ${accent}`}
          />
        </div>
      );
    case "date":
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="date"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm ${accent}`}
          />
        </div>
      );
    case "textarea":
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm resize-y ${accent}`}
          />
        </div>
      );
    case "toggle":
      return (
        <div className={`${commonWrapperCls} flex items-center justify-between`}>
          <label className="text-sm">{label}</label>
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? "bg-purple-600" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );
    case "select":
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>
            {label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={String(value ?? field.default ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              const asNum = Number(raw);
              onChange(Number.isFinite(asNum) && String(asNum) === raw ? asNum : raw);
            }}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm ${accent}`}
          >
            {(field.options ?? []).map((opt) => (
              <option key={String(opt)} value={String(opt)}>
                {String(opt)}
              </option>
            ))}
          </select>
        </div>
      );
    case "image": {
      const v = value as string | null | undefined;
      return (
        <div className={commonWrapperCls}>
          <label className={labelCls}>{label}</label>
          <div className="flex items-center gap-3">
            {v ? (
              <div className="relative">
                <img
                  src={v}
                  alt={label}
                  className="h-16 w-16 rounded-lg border object-contain bg-white"
                />
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label
                className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-xs ${accent}`}
              >
                <ImageIcon className="h-4 w-4" />
                {t("Upload image", "رفع صورة")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(t("Image must be under 5 MB", "الصورة يجب أن تكون أقل من 5 ميجا"));
                      return;
                    }
                    const dataUrl = await fileToDataUrl(file);
                    onChange(dataUrl);
                  }}
                />
              </label>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
};

// =============================================================================
// PAGE CAROUSEL
// =============================================================================
const PageCarousel: React.FC<{
  rows: A4DocumentRow[];
  aspectRatio: "2:3" | "3:4";
}> = ({ rows, aspectRatio }) => {
  const { t } = useTL();
  const [idx, setIdx] = useState(0);
  const total = rows.length;
  useEffect(() => {
    if (idx >= total) setIdx(Math.max(0, total - 1));
  }, [total, idx]);
  if (total === 0) return null;
  const row = rows[idx];
  const aspectCls = aspectRatio === "3:4" ? "aspect-[3/4]" : "aspect-[2/3]";

  return (
    <div>
      <div
        className={`relative w-full max-w-md mx-auto ${aspectCls} rounded-2xl border-2 border-purple-500/20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 overflow-hidden shadow-lg`}
      >
        {row.status === "completed" && row.image_url ? (
          <img src={row.image_url} alt={`Page ${row.page_number}`} className="w-full h-full object-contain" />
        ) : row.status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-2">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="text-sm font-medium">{t("Generation failed", "فشل التوليد")}</div>
            <div className="text-xs text-muted-foreground line-clamp-3">
              {row.error_message || t("Unknown error", "خطأ غير معروف")}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
            <div className="text-sm font-medium">
              {row.status === "queued" ? t("Queued…", "في الانتظار…") : t("Generating page…", "يتم التوليد…")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Page", "صفحة")} {row.page_number} / {row.total_pages}
            </div>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-2 rounded-full border hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {rows.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === idx ? "w-6 bg-purple-600" : "w-2 bg-muted"
                }`}
                aria-label={`Page ${r.page_number}`}
              />
            ))}
          </div>
          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="p-2 rounded-full border hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const A4Tab: React.FC = () => {
  const { lang, t } = useTL();

  const [stage, setStage] = useState<Stage>("pick");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [purposeId, setPurposeId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [pageChoice, setPageChoice] = useState<PageChoice>("auto");
  const [extractColors, setExtractColors] = useState<boolean>(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<A4DocumentRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const theme = themeId ? findTheme(themeId) : null;
  const schema = theme ? getFormSchema(theme, purposeId) : [];
  const needsPurpose = theme ? themeRequiresPurpose(theme) : false;
  const canShowForm = !!theme && (!needsPurpose || !!purposeId);
  const maxPages = theme?.max_pages ?? 3;

  // --- Reset handlers ---------------------------------------------------------
  const resetAll = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setStage("pick");
    setThemeId(null);
    setPurposeId(null);
    setFormState({});
    setPageChoice("auto");
    setExtractColors(false);
    setBatchId(null);
    setRows([]);
    setIsSubmitting(false);
    setFatalError(null);
  }, []);

  // When theme changes, re-init formState with default values from schema
  useEffect(() => {
    if (!theme) return;
    const initial: Record<string, unknown> = {};
    for (const f of schema) {
      if (f.default !== undefined) initial[f.key] = f.default;
    }
    setFormState(initial);
  }, [themeId, purposeId]);

  // Cleanup subscription on unmount
  useEffect(() => () => { unsubRef.current?.(); }, []);

  // --- Validate required fields ----------------------------------------------
  const missingRequired = useMemo(() => {
    if (!theme) return [];
    return schema.filter((f) => {
      if (!f.required) return false;
      const v = formState[f.key];
      return v === undefined || v === null || (typeof v === "string" && !v.trim());
    });
  }, [theme, schema, formState]);

  // --- Submit -----------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!theme) return;
    if (missingRequired.length > 0) {
      toast.error(t(
        `Missing required: ${missingRequired.map((f) => f.label_en).join(", ")}`,
        `حقول مطلوبة: ${missingRequired.map((f) => f.label_ar).join(", ")}`,
      ));
      return;
    }
    setIsSubmitting(true);
    setFatalError(null);

    // Strip logo out of form_state to send it separately
    const logoDataUrl = typeof formState.logo === "string" ? (formState.logo as string) : null;
    const { logo: _logo, ...cleanForm } = formState;

    const languageMode = formState.bilingual === true ? "bilingual" : "en";

    try {
      const res = await generateA4Document({
        theme_id: theme.id,
        purpose_id: purposeId,
        form_state: cleanForm,
        logo_data_url: logoDataUrl,
        logo_color_extract: extractColors && !!logoDataUrl,
        requested_pages: pageChoice,
        language_mode: languageMode,
      });

      if (!res.success || !res.batch_id) {
        setIsSubmitting(false);
        setFatalError(res.error || t("Generation failed", "فشل التوليد"));
        setStage("failed");
        return;
      }

      // Hydrate initial rows + subscribe
      const initial = await fetchBatch(res.batch_id);
      setBatchId(res.batch_id);
      setRows(initial);
      setStage("generating");
      setIsSubmitting(false);

      unsubRef.current = subscribeToBatch(res.batch_id, (row) => {
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.id === row.id);
          if (idx === -1) return [...prev, row].sort((a, b) => a.page_number - b.page_number);
          const next = prev.slice();
          next[idx] = row;
          return next;
        });
      });
    } catch (e) {
      setIsSubmitting(false);
      setFatalError((e as Error).message);
      setStage("failed");
    }
  }, [theme, missingRequired, formState, purposeId, pageChoice, extractColors, t]);

  // Watch rows: when all rows are completed/failed, flip stage
  useEffect(() => {
    if (stage !== "generating" || rows.length === 0) return;
    const allDone = rows.every((r) => r.status === "completed" || r.status === "failed");
    if (!allDone) return;
    const anyOk = rows.some((r) => r.status === "completed");
    setStage(anyOk ? "done" : "failed");
    unsubRef.current?.();
    unsubRef.current = null;
  }, [rows, stage]);

  // --- PDF download -----------------------------------------------------------
  const handleDownloadPdf = useCallback(async () => {
    const completed = rows.filter((r) => r.status === "completed" && r.image_url);
    if (completed.length === 0) return;
    try {
      toast.info(t("Building PDF…", "جاري إنشاء الملف…"));
      const pdfDoc = await PDFDocument.create();
      for (const row of completed) {
        const resp = await fetch(row.image_url!);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        // Nano Banana 2 returns JPG by request
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rows[0]?.title ?? "wakti-a4"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(`${t("PDF build failed", "فشل بناء الملف")}: ${(e as Error).message}`);
    }
  }, [rows, t]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  const aspectRatio = (theme?.aspect_ratio ?? "2:3") as "2:3" | "3:4";

  return (
    <div className="w-full max-w-4xl mx-auto px-1 pb-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* ---------- Header strip: current theme + change button --------------- */}
      {theme && stage !== "pick" && (
        <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold">
              {t("Theme", "القالب")}
            </div>
            <div className="text-sm font-semibold truncate">
              {lang === "ar" ? theme.name_ar : theme.name_en}
              {purposeId && theme.purpose_chips && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ·{" "}
                  {lang === "ar"
                    ? theme.purpose_chips.find((p) => p.id === purposeId)?.label_ar
                    : theme.purpose_chips.find((p) => p.id === purposeId)?.label_en}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border hover:bg-muted transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("Change", "تغيير")}
          </button>
        </div>
      )}

      {/* ---------- STAGE: PICK ----------------------------------------------- */}
      {stage === "pick" && (
        <ThemePicker
          onPick={(id) => {
            setThemeId(id);
            const th = findTheme(id);
            if (!th) return;
            if (themeRequiresPurpose(th) || th.purpose_chips) {
              setPurposeId(null);
            } else {
              setPurposeId(null);
            }
            setStage("form");
          }}
        />
      )}

      {/* ---------- STAGE: FORM ----------------------------------------------- */}
      {stage === "form" && theme && (
        <div>
          {/* Purpose chips */}
          {theme.purpose_chips && (
            <div className="mb-4">
              <div className="text-xs font-medium mb-2 text-foreground/70">
                {t("Purpose", "الغرض")}
              </div>
              <div className="flex flex-wrap gap-2">
                {theme.purpose_chips.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPurposeId(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      purposeId === p.id
                        ? "bg-purple-600 text-white border-purple-600"
                        : "hover:bg-muted"
                    }`}
                  >
                    {lang === "ar" ? p.label_ar : p.label_en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic form */}
          {canShowForm ? (
            <div className="rounded-2xl border border-purple-500/20 bg-background/50 p-4">
              {schema.map((field) => (
                <FormFieldRenderer
                  key={field.key}
                  field={field}
                  value={formState[field.key]}
                  onChange={(v) => setFormState((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}

              {/* Logo color extract toggle, only when a logo is present */}
              {typeof formState.logo === "string" && (formState.logo as string).length > 0 && (
                <div className="mb-3 flex items-center justify-between pt-2 border-t">
                  <label className="text-sm">
                    {t("Extract brand colors from logo", "استخراج ألوان العلامة التجارية من الشعار")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setExtractColors((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      extractColors ? "bg-purple-600" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        extractColors ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Page count chip row */}
              {maxPages > 1 && (
                <div className="pt-3 border-t">
                  <div className="text-xs font-medium mb-2 text-foreground/70">
                    {t("Number of pages", "عدد الصفحات")}
                  </div>
                  <div className="flex gap-2">
                    {(["auto", 1, 2, 3] as PageChoice[])
                      .filter((p) => p === "auto" || (p as number) <= maxPages)
                      .map((p) => (
                        <button
                          key={String(p)}
                          onClick={() => setPageChoice(p)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm border transition ${
                            pageChoice === p
                              ? "bg-purple-600 text-white border-purple-600"
                              : "hover:bg-muted"
                          }`}
                        >
                          {p === "auto" ? t("Auto", "تلقائي") : p}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("Pick a purpose to continue.", "اختر الغرض للمتابعة.")}
            </div>
          )}

          {/* Generate button */}
          {canShowForm && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={isSubmitting || missingRequired.length > 0}
                className={`px-5 py-2.5 rounded-full text-sm font-medium shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl transition-all active:scale-95 ${
                  isSubmitting || missingRequired.length > 0 ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("Submitting…", "جاري الإرسال…")}
                  </span>
                ) : (
                  t("Generate Document", "إنشاء المستند")
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- STAGE: GENERATING ----------------------------------------- */}
      {stage === "generating" && (
        <div className="text-center">
          <div className="mb-4 text-sm text-muted-foreground">
            {t(
              "Your document is being generated. This usually takes 30–60 seconds per page.",
              "يتم إنشاء المستند. عادةً يستغرق 30–60 ثانية لكل صفحة.",
            )}
          </div>
          <PageCarousel rows={rows} aspectRatio={aspectRatio} />
        </div>
      )}

      {/* ---------- STAGE: DONE ----------------------------------------------- */}
      {stage === "done" && (
        <div>
          <PageCarousel rows={rows} aspectRatio={aspectRatio} />
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-xl transition-all active:scale-95"
            >
              <Download className="h-4 w-4" />
              {t("Download PDF", "تنزيل PDF")}
            </button>
            <button
              onClick={resetAll}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border hover:bg-muted transition active:scale-95"
            >
              <RefreshCcw className="h-4 w-4" />
              {t("Start New", "بدء جديد")}
            </button>
          </div>
          {rows.some((r) => r.status === "failed") && (
            <div className="mt-4 text-xs text-amber-600 dark:text-amber-400 text-center">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              {t(
                "One or more pages failed. The PDF includes only the completed pages.",
                "فشل إنشاء صفحة أو أكثر. يشمل الملف الصفحات المكتملة فقط.",
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- STAGE: FAILED --------------------------------------------- */}
      {stage === "failed" && (
        <div className="text-center py-8">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <div className="text-sm font-medium mb-1">{t("Generation failed", "فشل التوليد")}</div>
          <div className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
            {fatalError || t("Something went wrong. Please try again.", "حدث خطأ. يرجى المحاولة مرة أخرى.")}
          </div>
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg active:scale-95"
          >
            <RefreshCcw className="h-4 w-4" />
            {t("Start Over", "البدء من جديد")}
          </button>
        </div>
      )}
    </div>
  );
};

export default A4Tab;
