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
  GraduationCap,
  BookOpen,
  Briefcase,
  Award,
  Megaphone,
  Palette,
  BookMarked,
  FileText,
  Sliders,
  Sparkles,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Type,
  Square as SquareIcon,
  type LucideIcon,
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
  downloadA4RowsAsJpgs,
  downloadA4RowsAsPdf,
  fileToDataUrl,
  fetchUrlContent,
  expandIdea,
  A4_UNIVERSAL_DECOR_CHIPS,
  A4_MAX_CHIPS_PER_SIDE,
  type A4DocumentRow,
  type A4DesignSettings,
  type A4CreativeSettings,
  type A4VisualRecipe,
  type A4IllustrationStyle,
  type A4AccentElement,
  type A4BackgroundTreatment,
  type A4ContentComponent,
  type A4LayoutPattern,
  type A4InputMode,
} from "./a4Service";
import { supabase } from "@/integrations/supabase/client";

type Stage = "pick" | "form" | "generating" | "done" | "failed";
type PageChoice = "auto" | 1 | 2 | 3;

type AssetPickerMode = "photos" | "qrs";

interface SavedPhotoAsset {
  id: string;
  image_url: string;
  prompt: string | null;
  created_at: string;
}

interface SavedQrAsset {
  id: string;
  label: string;
  qr_type: string;
  data_url: string;
  created_at: string;
}

// Helper: bilingual label
const useTL = () => {
  const { language } = useTheme();
  return {
    lang: language as "en" | "ar",
    t: (en: string, ar: string) => (language === "ar" ? ar : en),
  };
};

async function imageUrlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Image fetch failed (${resp.status})`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

// =============================================================================
// THEME PICKER — per-theme accent visuals (WAKTI-approved accents only)
// =============================================================================
interface ThemeVisual {
  icon: LucideIcon;
  // Tailwind utility strings — all brand-approved accents (no purple/indigo).
  bg: string;      // gradient background tint
  text: string;    // icon + badge text color
  border: string;  // hover border color
  ring: string;    // subtle inner glow on hover
}

interface ThemeBadgeLabel {
  en: string;
  ar: string;
}

const THEME_VISUALS: Record<string, ThemeVisual> = {
  official_exam: {
    icon: GraduationCap,
    bg: "from-amber-500/10 via-orange-500/5 to-transparent",
    text: "text-amber-600 dark:text-amber-400",
    border: "hover:border-amber-500/50",
    ring: "group-hover:shadow-amber-500/20",
  },
  school_project: {
    icon: BookOpen,
    bg: "from-emerald-500/10 via-green-500/5 to-transparent",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/50",
    ring: "group-hover:shadow-emerald-500/20",
  },
  corporate_brief: {
    icon: Briefcase,
    bg: "from-blue-500/10 via-sky-500/5 to-transparent",
    text: "text-blue-600 dark:text-blue-400",
    border: "hover:border-blue-500/50",
    ring: "group-hover:shadow-blue-500/20",
  },
  certificate: {
    icon: Award,
    bg: "from-amber-500/15 via-yellow-500/5 to-transparent",
    text: "text-amber-600 dark:text-amber-400",
    border: "hover:border-amber-500/60",
    ring: "group-hover:shadow-amber-500/25",
  },
  event_flyer: {
    icon: Megaphone,
    bg: "from-orange-500/10 via-pink-500/5 to-transparent",
    text: "text-orange-600 dark:text-orange-400",
    border: "hover:border-orange-500/50",
    ring: "group-hover:shadow-orange-500/20",
  },
  craft_infographic: {
    icon: Palette,
    bg: "from-pink-500/10 via-rose-500/5 to-transparent",
    text: "text-pink-600 dark:text-pink-400",
    border: "hover:border-pink-500/50",
    ring: "group-hover:shadow-pink-500/20",
  },
  comic_explainer: {
    icon: BookMarked,
    bg: "from-cyan-500/10 via-teal-500/5 to-transparent",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "hover:border-cyan-500/50",
    ring: "group-hover:shadow-cyan-500/20",
  },
  clean_minimal: {
    icon: FileText,
    bg: "from-slate-500/10 via-zinc-500/5 to-transparent",
    text: "text-slate-600 dark:text-slate-300",
    border: "hover:border-slate-500/50",
    ring: "group-hover:shadow-slate-500/20",
  },
  invoice_receipt: {
    icon: FileText,
    bg: "from-emerald-500/10 via-teal-500/5 to-transparent",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/50",
    ring: "group-hover:shadow-emerald-500/20",
  },
  menu_price_list: {
    icon: BookOpen,
    bg: "from-orange-500/10 via-amber-500/5 to-transparent",
    text: "text-orange-600 dark:text-orange-400",
    border: "hover:border-orange-500/50",
    ring: "group-hover:shadow-orange-500/20",
  },
  thank_you_invitation_card: {
    icon: Award,
    bg: "from-pink-500/10 via-rose-500/5 to-transparent",
    text: "text-pink-600 dark:text-pink-400",
    border: "hover:border-pink-500/50",
    ring: "group-hover:shadow-pink-500/20",
  },
  resume_cv: {
    icon: Briefcase,
    bg: "from-blue-500/10 via-sky-500/5 to-transparent",
    text: "text-blue-600 dark:text-blue-400",
    border: "hover:border-blue-500/50",
    ring: "group-hover:shadow-blue-500/20",
  },
};

const DEFAULT_VISUAL: ThemeVisual = {
  icon: FileText,
  bg: "from-muted via-muted/50 to-transparent",
  text: "text-muted-foreground",
  border: "hover:border-primary/40",
  ring: "group-hover:shadow-primary/10",
};

const THEME_BADGES: Record<string, ThemeBadgeLabel> = {
  official_exam: { en: "School Exam", ar: "اختبار مدرسي" },
  school_project: { en: "School Project", ar: "مشروع مدرسي" },
  corporate_brief: { en: "Corporate Report", ar: "تقرير مؤسسي" },
  certificate: { en: "Certificate", ar: "شهادة" },
  event_flyer: { en: "Event Flyer", ar: "ملصق فعالية" },
  craft_infographic: { en: "Infographic", ar: "إنفوجرافيك" },
  comic_explainer: { en: "Comic Explainer", ar: "شرح كوميكس" },
  clean_minimal: { en: "Minimal", ar: "بسيط" },
  invoice_receipt: { en: "Invoice", ar: "فاتورة" },
  menu_price_list: { en: "Price Menu", ar: "قائمة أسعار" },
  thank_you_invitation_card: { en: "Invitation Card", ar: "بطاقة دعوة" },
  resume_cv: { en: "Resume CV", ar: "سيرة ذاتية" },
};

const ThemePicker: React.FC<{ onPick: (themeId: string) => void }> = ({ onPick }) => {
  const { lang, t } = useTL();
  const [query, setQuery] = useState("");
  const themes = useMemo(() => searchThemes(query), [query]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none ${lang === "ar" ? "right-3" : "left-3"}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search themes…", "ابحث عن قالب…")}
          dir={lang === "ar" ? "rtl" : "ltr"}
          className={`w-full py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm ${lang === "ar" ? "pr-9 pl-3 text-right" : "pl-9 pr-3"}`}
        />
      </div>

      {themes.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t("No themes match. Try another search.", "لا توجد نتائج. جرّب بحثًا آخر.")}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {themes.map((theme) => {
            const v = THEME_VISUALS[theme.id] ?? DEFAULT_VISUAL;
            const Icon = v.icon;
            const badge = THEME_BADGES[theme.id];
            return (
              <button
                key={theme.id}
                onClick={() => onPick(theme.id)}
                className={`group relative rounded-xl border border-border bg-card ${v.border} hover:shadow-lg ${v.ring} transition-all duration-200 overflow-hidden p-3 active:scale-95 flex flex-col gap-2.5 min-h-[115px]`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${v.bg} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <Icon className={`pointer-events-none absolute -right-1 -bottom-1 h-14 w-14 ${v.text} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <span className={`relative flex items-center justify-center w-9 h-9 rounded-lg bg-background/60 border border-border/60 shrink-0`}>
                  <Icon className={`h-4.5 w-4.5 ${v.text}`} style={{width:"18px",height:"18px"}} />
                </span>
                <div className={`relative flex-1 flex flex-col justify-end ${lang === "ar" ? "text-right" : "text-left"}`}>
                  <div className="text-xs font-semibold leading-snug line-clamp-2 text-foreground">
                    {lang === "ar" ? theme.name_ar : theme.name_en}
                  </div>
                  {badge && (
                    <div className={`text-[10px] font-medium mt-0.5 leading-tight ${v.text} line-clamp-1`}>
                      {lang === "ar" ? badge.ar : badge.en}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// URL → CONTENT HELPER (cheap Gemini)
// =============================================================================
const UrlFetchHelper: React.FC<{
  onContent: (content: string) => void;
  currentValue: string;
}> = ({ onContent, currentValue }) => {
  const { t } = useTL();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t("Please paste a URL first", "يرجى لصق رابط أولاً"));
      return;
    }
    try {
      setLoading(true);
      const res = await fetchUrlContent(trimmed);
      if (!res.success || !res.content) {
        setError(res.error || t("Failed to fetch URL", "فشل جلب الرابط"));
        return;
      }
      const merged = currentValue.trim()
        ? `${currentValue.trim()}\n\n${res.content}`
        : res.content;
      onContent(merged);
      toast.success(
        t(
          "Content fetched and added",
          "تم جلب المحتوى وإضافته",
        ),
      );
      setOpen(false);
      setUrl("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background text-[11px] font-medium hover:border-primary/40 hover:text-primary transition sm:w-auto sm:justify-start"
      >
        <LinkIcon className="h-3 w-3" />
        {t("Fetch from URL", "جلب من رابط")}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-border bg-card shadow-lg p-3 sm:left-auto sm:right-0 sm:w-[28rem]">
          <div className="text-xs font-medium mb-1.5">
            {t("Paste a page URL", "الصق رابط صفحة")}
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={loading}
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            {t(
              "We'll extract and clean the page text using a cheap model, then add it to the content field.",
              "سنستخرج نص الصفحة وننظفه باستخدام نموذج اقتصادي، ثم نضيفه إلى حقل المحتوى.",
            )}
          </div>
          {error && <div className="text-[11px] text-red-500 mt-2">{error}</div>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleFetch}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60 hover:opacity-90 transition"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LinkIcon className="h-3 w-3" />}
              {loading ? t("Fetching…", "جاري الجلب…") : t("Fetch", "جلب")}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition"
            >
              {t("Cancel", "إلغاء")}
            </button>
          </div>
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
    "border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const commonWrapperCls = "mb-3";
  const labelCls = "block text-xs font-medium mb-1.5 text-foreground/80";
  const [assetPicker, setAssetPicker] = useState<AssetPickerMode | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoAsset[]>([]);
  const [savedQrs, setSavedQrs] = useState<SavedQrAsset[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [applyingAssetId, setApplyingAssetId] = useState<string | null>(null);

  const loadSavedPhotos = useCallback(async () => {
    try {
      setAssetLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) {
        setSavedPhotos([]);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("user_generated_images")
        .select("id, image_url, prompt, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      setSavedPhotos(data ?? []);
    } catch (e) {
      toast.error(`${t("Failed to load saved photos", "فشل تحميل الصور المحفوظة")}: ${(e as Error).message}`);
    } finally {
      setAssetLoading(false);
    }
  }, [t]);

  const loadSavedQrs = useCallback(async () => {
    try {
      setAssetLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) {
        setSavedQrs([]);
        return;
      }
      const { data, error } = await supabase
        .from("saved_qr_codes")
        .select("id, label, qr_type, data_url, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      setSavedQrs(data ?? []);
    } catch (e) {
      toast.error(`${t("Failed to load saved QR codes", "فشل تحميل رموز QR المحفوظة")}: ${(e as Error).message}`);
    } finally {
      setAssetLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (field.type !== "image" || !assetPicker) return;
    if (assetPicker === "photos" && savedPhotos.length === 0) {
      void loadSavedPhotos();
    }
    if (assetPicker === "qrs" && savedQrs.length === 0) {
      void loadSavedQrs();
    }
  }, [field.type, assetPicker, savedPhotos.length, savedQrs.length, loadSavedPhotos, loadSavedQrs]);

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
          <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className={labelCls + " mb-0"}>
              {label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.key === "raw_content" && (
              <UrlFetchHelper onContent={(content) => onChange(content)} currentValue={String(value ?? "")} />
            )}
          </div>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className={`w-full px-3 py-2 rounded-lg border bg-background text-sm resize-y ${accent}`}
            placeholder={field.key === "raw_content"
              ? t(
                  "Type or paste your content here. Or use 'Fetch from URL' to auto-fill from a web page.",
                  "اكتب أو الصق المحتوى هنا. أو استخدم \"جلب من رابط\" لملء المحتوى من صفحة ويب.",
                )
              : undefined}
          />
        </div>
      );
    case "toggle": {
      const isRtl = lang === "ar";
      const onPos = isRtl ? "-translate-x-6" : "translate-x-6";
      const offPos = isRtl ? "-translate-x-1" : "translate-x-1";
      return (
        <div className={`${commonWrapperCls} flex items-center justify-between gap-3`}>
          <label className="text-sm flex-1">{label}</label>
          <button
            type="button"
            onClick={() => onChange(!value)}
            aria-pressed={!!value}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              value ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                value ? onPos : offPos
              }`}
            />
          </button>
        </div>
      );
    }
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {v && (
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
              )}

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

              <button
                type="button"
                onClick={() => setAssetPicker((prev) => prev === "photos" ? null : "photos")}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${assetPicker === "photos" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                <ImageIcon className="h-4 w-4" />
                {t("Saved Photos", "الصور المحفوظة")}
              </button>

              <button
                type="button"
                onClick={() => setAssetPicker((prev) => prev === "qrs" ? null : "qrs")}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${assetPicker === "qrs" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                <FileText className="h-4 w-4" />
                {t("Saved QR Codes", "رموز QR المحفوظة")}
              </button>
            </div>

            {assetPicker && (
              <div className="rounded-xl border border-border bg-background/70 p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {assetPicker === "photos"
                    ? t("Choose from your saved photos", "اختر من صورك المحفوظة")
                    : t("Choose from your saved QR codes", "اختر من رموز QR المحفوظة")}
                </div>

                {assetLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("Loading…", "جاري التحميل…")}
                  </div>
                ) : assetPicker === "photos" ? (
                  savedPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {savedPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={async () => {
                            try {
                              setApplyingAssetId(photo.id);
                              const dataUrl = await imageUrlToDataUrl(photo.image_url);
                              onChange(dataUrl);
                              setAssetPicker(null);
                            } catch (e) {
                              toast.error(`${t("Failed to use saved photo", "فشل استخدام الصورة المحفوظة")}: ${(e as Error).message}`);
                            } finally {
                              setApplyingAssetId(null);
                            }
                          }}
                          className="rounded-lg overflow-hidden border border-border bg-card hover:border-primary/40 transition text-left"
                          disabled={applyingAssetId === photo.id}
                        >
                          <div className="aspect-square bg-muted/40">
                            <img src={photo.image_url} alt={photo.prompt || "Saved photo"} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-2 text-[10px] text-muted-foreground line-clamp-2">
                            {applyingAssetId === photo.id
                              ? t("Using photo…", "جاري استخدام الصورة…")
                              : (photo.prompt || t("Saved photo", "صورة محفوظة"))}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground py-2">
                      {t("No saved photos found.", "لا توجد صور محفوظة.")}
                    </div>
                  )
                ) : savedQrs.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {savedQrs.map((qr) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => {
                          onChange(qr.data_url);
                          setAssetPicker(null);
                        }}
                        className="rounded-lg border border-border bg-card hover:border-primary/40 transition p-2 text-left"
                      >
                        <div className="aspect-square rounded-md bg-white overflow-hidden mb-2">
                          <img src={qr.data_url} alt={qr.label || "QR code"} className="w-full h-full object-contain" />
                        </div>
                        <div className="text-xs font-medium line-clamp-1 text-foreground">
                          {qr.label || t("QR Code", "رمز QR")}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                          {qr.qr_type}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-2">
                    {t("No saved QR codes found.", "لا توجد رموز QR محفوظة.")}
                  </div>
                )}
              </div>
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
  aspectRatio: "2:3" | "3:4" | "3:2" | "4:3";
}> = ({ rows, aspectRatio }) => {
  const { t } = useTL();
  const [idx, setIdx] = useState(0);
  const total = rows.length;
  useEffect(() => {
    if (idx >= total) setIdx(Math.max(0, total - 1));
  }, [total, idx]);
  if (total === 0) return null;
  const row = rows[idx];
  const aspectCls =
    aspectRatio === "4:3"
      ? "aspect-[4/3]"
      : aspectRatio === "3:2"
      ? "aspect-[3/2]"
      : aspectRatio === "3:4"
      ? "aspect-[3/4]"
      : "aspect-[2/3]";

  return (
    <div>
      <div
        className={`relative w-full max-w-md mx-auto ${aspectCls} rounded-2xl border border-border bg-card overflow-hidden shadow-md`}
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
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
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
                  i === idx ? "w-6 bg-primary" : "w-2 bg-muted"
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
// =============================================================================
// DESIGN SETTINGS PANEL — global look & feel controls applied to every theme
// =============================================================================
const COLOR_PALETTES: Array<{
  id: string;
  name_en: string;
  name_ar: string;
  bg: string;
  text: string;
  accent: string;
}> = [
  { id: "clean_white", name_en: "Clean White", name_ar: "أبيض نظيف", bg: "#FFFFFF", text: "#0B0D12", accent: "#2563EB" },
  { id: "soft_cream", name_en: "Soft Cream", name_ar: "كريمي ناعم", bg: "#FAF7F0", text: "#1F2937", accent: "#C08457" },
  { id: "midnight", name_en: "Midnight", name_ar: "منتصف الليل", bg: "#0C0F14", text: "#F2F2F2", accent: "#60A5FA" },
  { id: "emerald_light", name_en: "Emerald Light", name_ar: "زمرد فاتح", bg: "#F0FDF4", text: "#064E3B", accent: "#059669" },
  { id: "royal_blue", name_en: "Royal", name_ar: "ملكي", bg: "#F8FAFC", text: "#060541", accent: "#1E3A8A" },
  { id: "warm_sunset", name_en: "Warm Sunset", name_ar: "غروب دافئ", bg: "#FFF7ED", text: "#7C2D12", accent: "#EA580C" },
  { id: "rose_blush", name_en: "Rose Blush", name_ar: "وردي خجول", bg: "#FFF1F2", text: "#881337", accent: "#E11D48" },
  { id: "graphite", name_en: "Graphite", name_ar: "جرافيت", bg: "#F3F4F6", text: "#111827", accent: "#4B5563" },
];

type LocalizedChipOption<T extends string = string> = {
  id: T;
  en: string;
  ar: string;
  hint_en?: string;
  hint_ar?: string;
};

const FONT_OPTIONS: LocalizedChipOption<NonNullable<A4DesignSettings["font_family"]>>[] = [
  { id: "modern_sans", en: "Modern Sans", ar: "عصري", hint_en: "Clean and contemporary", hint_ar: "نظيف وعصري" },
  { id: "rounded_sans", en: "Rounded Sans", ar: "مستدير", hint_en: "Soft and friendly", hint_ar: "ناعم وودود" },
  { id: "classic_serif", en: "Classic Serif", ar: "كلاسيكي", hint_en: "Traditional and academic", hint_ar: "تقليدي وأكاديمي" },
  { id: "editorial_serif", en: "Editorial Serif", ar: "تحريري", hint_en: "Magazine-like premium serif", hint_ar: "سيرف فاخر يشبه المجلات" },
  { id: "elegant_script", en: "Elegant Script", ar: "سكريبت أنيق", hint_en: "Polished script for headings", hint_ar: "خط أنيق للعناوين" },
  { id: "luxury_script", en: "Luxury Script", ar: "سكريبت فاخر", hint_en: "Premium calligraphy feel", hint_ar: "إحساس فاخر يشبه الكاليغرافي" },
  { id: "bold_display", en: "Bold Display", ar: "عريض جريء", hint_en: "Strong headline energy", hint_ar: "طاقة قوية للعناوين" },
  { id: "playful_hand", en: "Playful Hand", ar: "مرح يدوي", hint_en: "Casual handwritten warmth", hint_ar: "دفء خط يدوي مرح" },
  { id: "notebook_hand", en: "Notebook Hand", ar: "دفتر ملاحظات", hint_en: "Neat student notes feel", hint_ar: "إحساس ملاحظات طالب مرتبة" },
  { id: "marker_hand", en: "Marker Hand", ar: "ماركر يدوي", hint_en: "Bold handwritten marker look", hint_ar: "شكل خط يدوي بالماركر" },
  { id: "monoline_hand", en: "Monoline Hand", ar: "أحادي الخط", hint_en: "Stylish clean handwriting", hint_ar: "خط يدوي أنيق ونظيف" },
];

const BORDER_OPTIONS: LocalizedChipOption<NonNullable<A4DesignSettings["border_style"]>>[] = [
  { id: "none", en: "None", ar: "بدون" },
  { id: "thin", en: "Thin", ar: "رفيع" },
  { id: "thick", en: "Thick", ar: "سميك" },
  { id: "rounded", en: "Rounded", ar: "مدوّر" },
  { id: "decorative", en: "Decorative", ar: "زخرفي" },
  { id: "double_line", en: "Double Line", ar: "خطّان" },
  { id: "dashed", en: "Dashed", ar: "متقطّع" },
  { id: "corner_frame", en: "Corner Frame", ar: "إطار الزوايا" },
];

const ORIENTATION_OPTIONS: Array<{ id: NonNullable<A4DesignSettings["orientation"]>; en: string; ar: string }> = [
  { id: "portrait", en: "Portrait", ar: "طولي" },
  { id: "landscape", en: "Landscape", ar: "عرضي" },
];

const DENSITY_OPTIONS: LocalizedChipOption<NonNullable<A4DesignSettings["density"]>>[] = [
  { id: "ultra_compact", en: "Ultra Compact", ar: "مكثف جدًا" },
  { id: "compact", en: "Compact", ar: "مكثف" },
  { id: "balanced", en: "Balanced", ar: "متوازن" },
  { id: "airy", en: "Airy", ar: "فسيح" },
  { id: "spacious", en: "Spacious", ar: "واسع جدًا" },
];

const TONE_OPTIONS: LocalizedChipOption<NonNullable<A4DesignSettings["tone"]>>[] = [
  { id: "professional", en: "Professional", ar: "احترافي" },
  { id: "friendly", en: "Friendly", ar: "ودود" },
  { id: "playful", en: "Playful", ar: "مرح" },
  { id: "formal", en: "Formal", ar: "رسمي" },
  { id: "elegant", en: "Elegant", ar: "أنيق" },
  { id: "bold", en: "Bold", ar: "جريء" },
  { id: "romantic", en: "Romantic", ar: "رومانسي" },
];

function getLocalizedOptionLabel<T extends string>(
  options: LocalizedChipOption<T>[],
  id: T | null | undefined,
  lang: "en" | "ar",
  fallback = "",
): string {
  const match = options.find((option) => option.id === id);
  if (!match) return fallback;
  return lang === "ar" ? match.ar : match.en;
}

function getLocalizedOptionHint<T extends string>(
  options: LocalizedChipOption<T>[],
  id: T | null | undefined,
  lang: "en" | "ar",
): string {
  const match = options.find((option) => option.id === id);
  if (!match) return "";
  return lang === "ar" ? match.hint_ar ?? "" : match.hint_en ?? "";
}

function summarizeSelectedOptions<T extends string>(
  options: LocalizedChipOption<T>[],
  selected: T[] | null | undefined,
  lang: "en" | "ar",
  emptyLabel: string,
): string {
  if (!selected || selected.length === 0) return emptyLabel;
  const labels = selected
    .map((id) => getLocalizedOptionLabel(options, id, lang))
    .filter(Boolean);
  if (labels.length === 0) return emptyLabel;
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}`;
}

const SettingsDropdownSection: React.FC<{
  titleEn: string;
  titleAr: string;
  summary?: string;
  helperEn?: string;
  helperAr?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ titleEn, titleAr, summary, helperEn, helperAr, defaultOpen = false, children }) => {
  const { lang, t } = useTL();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="self-start h-fit rounded-xl border border-border/60 bg-background/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 transition"
      >
        <div className={`min-w-0 ${lang === "ar" ? "text-right" : "text-left"}`}>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t(titleEn, titleAr)}
          </div>
          {(summary || helperEn || helperAr) && (
            <div className="mt-0.5 text-xs font-medium text-foreground/85 truncate">
              {summary || t(helperEn ?? "", helperAr ?? "")}
            </div>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
};

const DesignSettingsPanel: React.FC<{
  settings: A4DesignSettings;
  onChange: (next: A4DesignSettings) => void;
}> = ({ settings, onChange }) => {
  const { lang, t } = useTL();
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<A4DesignSettings>) => onChange({ ...settings, ...patch });
  const isRtl = lang === "ar";

  const segBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-background border-border hover:border-primary/40 text-foreground/80"
    }`;

  const swatchBtn = (active: boolean) =>
    `relative w-10 h-10 rounded-lg border-2 transition overflow-hidden shadow-sm hover:scale-105 ${
      active ? "border-primary ring-2 ring-primary/30" : "border-border"
    }`;

  const richChipBtn = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-left transition ${
      active
        ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
        : "border-border bg-background hover:border-primary/40 text-foreground/85"
    }`;

  const onPos = isRtl ? "-translate-x-6" : "translate-x-6";
  const offPos = isRtl ? "-translate-x-1" : "translate-x-1";
  const fontSummary = getLocalizedOptionLabel(FONT_OPTIONS, settings.font_family, lang, t("Modern Sans", "عصري"));
  const fontHint = getLocalizedOptionHint(FONT_OPTIONS, settings.font_family, lang);
  const borderSummary = getLocalizedOptionLabel(BORDER_OPTIONS, settings.border_style, lang, t("Thin", "رفيع"));
  const densitySummary = getLocalizedOptionLabel(DENSITY_OPTIONS, settings.density, lang, t("Balanced", "متوازن"));
  const toneSummary = getLocalizedOptionLabel(TONE_OPTIONS, settings.tone, lang, t("Professional", "احترافي"));

  return (
    <div className="mb-4 rounded-xl border border-border bg-gradient-to-br from-card to-background/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("Design Settings", "إعدادات التصميم")}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {t("orientation · colors · fonts · style", "الاتجاه · الألوان · الخطوط · النمط")}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("Orientation", "الاتجاه")}
            </div>
            <div className="flex flex-wrap gap-2">
              {ORIENTATION_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => set({ orientation: o.id })}
                  className={segBtn(settings.orientation === o.id)}
                >
                  {lang === "ar" ? o.ar : o.en}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("Color Palette", "لوحة الألوان")}
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTES.map((p) => {
                const active =
                  settings.background_color === p.bg &&
                  settings.text_color === p.text &&
                  settings.accent_color === p.accent;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={lang === "ar" ? p.name_ar : p.name_en}
                    onClick={() =>
                      set({
                        background_color: p.bg,
                        text_color: p.text,
                        accent_color: p.accent,
                      })
                    }
                    className={swatchBtn(active)}
                  >
                    <div style={{ background: p.bg }} className="absolute inset-0" />
                    <div style={{ background: p.accent }} className="absolute bottom-0 left-0 right-0 h-3" />
                    <div style={{ background: p.text }} className="absolute top-1 left-1 w-2 h-2 rounded-full" />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span>{t("Background", "الخلفية")}</span>
                <input
                  type="color"
                  value={settings.background_color || "#FFFFFF"}
                  onChange={(e) => set({ background_color: e.target.value.toUpperCase() })}
                  className="h-8 w-full rounded border border-border bg-transparent cursor-pointer"
                  aria-label={t("Background color", "لون الخلفية")}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span>{t("Text", "النص")}</span>
                <input
                  type="color"
                  value={settings.text_color || "#0B0D12"}
                  onChange={(e) => set({ text_color: e.target.value.toUpperCase() })}
                  className="h-8 w-full rounded border border-border bg-transparent cursor-pointer"
                  aria-label={t("Text color", "لون النص")}
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span>{t("Accent", "التمييز")}</span>
                <input
                  type="color"
                  value={settings.accent_color || "#2563EB"}
                  onChange={(e) => set({ accent_color: e.target.value.toUpperCase() })}
                  className="h-8 w-full rounded border border-border bg-transparent cursor-pointer"
                  aria-label={t("Accent color", "لون التمييز")}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-start">
            <SettingsDropdownSection
              titleEn="Font Style"
              titleAr="نمط الخط"
              summary={fontHint ? `${fontSummary} · ${fontHint}` : fontSummary}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 gap-2">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => set({ font_family: f.id })}
                    className={richChipBtn(settings.font_family === f.id)}
                    title={lang === "ar" ? f.ar : f.en}
                  >
                    <div className="text-xs font-semibold">{lang === "ar" ? f.ar : f.en}</div>
                    {(f.hint_en || f.hint_ar) && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                        {lang === "ar" ? f.hint_ar : f.hint_en}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Border Style"
              titleAr="نمط الحدود"
              summary={borderSummary}
            >
              <div className="flex flex-wrap gap-2">
                {BORDER_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => set({ border_style: b.id })}
                    className={segBtn(settings.border_style === b.id)}
                  >
                    {lang === "ar" ? b.ar : b.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Page Density"
              titleAr="كثافة الصفحة"
              summary={densitySummary}
            >
              <div className="flex flex-wrap gap-2">
                {DENSITY_OPTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => set({ density: d.id })}
                    className={segBtn(settings.density === d.id)}
                  >
                    {lang === "ar" ? d.ar : d.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Tone"
              titleAr="النبرة"
              summary={toneSummary}
            >
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t2) => (
                  <button
                    key={t2.id}
                    type="button"
                    onClick={() => set({ tone: t2.id })}
                    className={segBtn(settings.tone === t2.id)}
                  >
                    {lang === "ar" ? t2.ar : t2.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <div>
              <div className="text-sm font-medium">{t("Include Decorative Images", "إدراج صور زخرفية")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("Icons and illustrations that match the subject", "أيقونات ورسومات تناسب الموضوع")}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!settings.include_decorative_images}
              onClick={() => set({ include_decorative_images: !settings.include_decorative_images })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.include_decorative_images ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.include_decorative_images ? onPos : offPos
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// CREATIVE SETTINGS PANEL — rich per-document direction for Nano Banana 2.
// Every control here maps to a specific prompt fragment on the backend. No AI
// in the middle. What the user clicks is exactly what the image model sees.
// =============================================================================

const VISUAL_RECIPE_OPTIONS: LocalizedChipOption<A4VisualRecipe>[] = [
  { id: "paper_craft_flatlay", en: "Paper-Craft Flat-Lay", ar: "قصاصات ورقية", hint_en: "Top-down paper cut-outs on textured paper", hint_ar: "قصاصات ورقية على خلفية ورقية" },
  { id: "executive_tech_spec", en: "Executive Tech Spec", ar: "مواصفات تقنية", hint_en: "Consultancy-grade panels, wheel & data table", hint_ar: "لوحات فخمة وجدول بيانات" },
  { id: "comic_triptych", en: "Comic Triptych", ar: "ثلاثية الكوميكس", hint_en: "3 vibrant panels with bold comic lettering", hint_ar: "٣ لوحات كوميكس بألوان قوية" },
  { id: "ministry_exam", en: "Ministry Exam Paper", ar: "ورقة اختبار رسمية", hint_en: "Official ink-on-white exam layout", hint_ar: "ورقة اختبار رسمية بيضاء" },
  { id: "menu_board", en: "Menu Board", ar: "قائمة طعام", hint_en: "Elegant menu with dotted leaders", hint_ar: "قائمة أنيقة بخطوط منقطة" },
  { id: "craft_diy_explainer", en: "Craft DIY Explainer", ar: "شرح حرفي", hint_en: "Hand-cut shapes linked by ink arrows", hint_ar: "أشكال مقصوصة وأسهم رسم يدوي" },
  { id: "minimal_stationery", en: "Minimal Stationery", ar: "بسيط أنيق", hint_en: "Ultra-clean premium whitespace", hint_ar: "تصميم بسيط فاخر" },
  { id: "bold_poster", en: "Bold Poster", ar: "ملصق جريء", hint_en: "Hero headline, full-bleed background", hint_ar: "عنوان ضخم وخلفية كاملة" },
  { id: "luxury_editorial", en: "Luxury Editorial", ar: "تحريري فاخر", hint_en: "Magazine elegance with premium spacing", hint_ar: "أناقة مجلة مع مساحات فاخرة" },
  { id: "study_notes", en: "Study Notes", ar: "ملاحظات دراسية", hint_en: "Highlighter-style structured notes", hint_ar: "ملاحظات منظمة بأسلوب التحديد" },
  { id: "scrapbook_story", en: "Scrapbook Story", ar: "سكراب بوك", hint_en: "Layered collage paper story feel", hint_ar: "إحساس قصة ورقية متعددة الطبقات" },
  { id: "museum_catalog", en: "Museum Catalog", ar: "كتالوج متحف", hint_en: "Curated archival premium layout", hint_ar: "تخطيط أرشيفي فاخر ومنسق" },
];

const ILLUSTRATION_STYLE_OPTIONS: LocalizedChipOption<A4IllustrationStyle>[] = [
  { id: "none", en: "None", ar: "بدون" },
  { id: "icons", en: "Icons Only", ar: "أيقونات فقط" },
  { id: "flat_vector", en: "Flat Vector", ar: "فيكتور مسطح" },
  { id: "paper_craft", en: "Paper Craft", ar: "ورقي" },
  { id: "watercolor", en: "Watercolor", ar: "ألوان مائية" },
  { id: "comic_bold", en: "Comic Bold", ar: "كوميكس" },
  { id: "photo_realistic", en: "Photo-Realistic", ar: "واقعي" },
  { id: "line_art", en: "Line Art", ar: "خطّي" },
  { id: "sketch_handdrawn", en: "Sketch Hand", ar: "سكتش يدوي" },
  { id: "collage_cutout", en: "Collage Cutout", ar: "كولاج قصاصات" },
  { id: "pastel_gouache", en: "Pastel Gouache", ar: "غواش باستيل" },
];

const ACCENT_ELEMENT_OPTIONS: LocalizedChipOption<A4AccentElement>[] = [
  { id: "hand_drawn_arrows", en: "Hand-drawn Arrows", ar: "أسهم يدوية" },
  { id: "ribbons", en: "Ribbons", ar: "شرائط" },
  { id: "stars", en: "Stars", ar: "نجوم" },
  { id: "corner_ornaments", en: "Corner Ornaments", ar: "زخارف الزوايا" },
  { id: "callout_badges", en: "Callout Badges", ar: "شارات" },
  { id: "dotted_dividers", en: "Dotted Dividers", ar: "فواصل منقطة" },
  { id: "paper_tape", en: "Paper Tape", ar: "شريط ورقي" },
  { id: "thread_connectors", en: "Thread Connectors", ar: "خيوط رابطة" },
  { id: "underlines", en: "Underlines", ar: "تسطير" },
  { id: "sticky_notes", en: "Sticky Notes", ar: "ملاحظات لاصقة" },
  { id: "spark_lines", en: "Spark Lines", ar: "خطوط إبراز" },
  { id: "ink_stamps", en: "Ink Stamps", ar: "أختام حبر" },
  { id: "washi_corners", en: "Washi Corners", ar: "زوايا واشي" },
];

const BACKGROUND_TREATMENT_OPTIONS: LocalizedChipOption<A4BackgroundTreatment>[] = [
  { id: "plain_white", en: "Plain White", ar: "أبيض نقي" },
  { id: "soft_paper_texture", en: "Soft Paper", ar: "ورقي ناعم" },
  { id: "light_gradient", en: "Light Gradient", ar: "تدرّج خفيف" },
  { id: "subtle_grid", en: "Subtle Grid", ar: "شبكة خفيفة" },
  { id: "botanical_motif", en: "Botanical", ar: "نباتي" },
  { id: "confetti", en: "Confetti", ar: "قصاصات ملوّنة" },
  { id: "photographic_backdrop", en: "Photo Backdrop", ar: "خلفية صورة" },
  { id: "dark_solid", en: "Dark Solid", ar: "داكن صلب" },
  { id: "linen_texture", en: "Linen Texture", ar: "ملمس قماش" },
  { id: "marble_surface", en: "Marble Surface", ar: "سطح رخامي" },
  { id: "chalkboard", en: "Chalkboard", ar: "سبورة" },
];

const CONTENT_COMPONENT_OPTIONS: LocalizedChipOption<A4ContentComponent>[] = [
  { id: "chart_bar", en: "Bar Chart", ar: "رسم أعمدة" },
  { id: "chart_line", en: "Line Chart", ar: "رسم خطي" },
  { id: "chart_donut", en: "Donut Chart", ar: "رسم دائري" },
  { id: "chart_radar", en: "Radar Chart", ar: "رسم شبكي" },
  { id: "data_table", en: "Data Table", ar: "جدول بيانات" },
  { id: "timeline", en: "Timeline", ar: "خط زمني" },
  { id: "step_flow", en: "Step Flow", ar: "خطوات متسلسلة" },
  { id: "side_by_side", en: "Side-by-Side", ar: "جنباً إلى جنب" },
  { id: "vitality_wheel", en: "Vitality Wheel", ar: "عجلة القدرات" },
  { id: "info_cards", en: "Info Cards", ar: "بطاقات معلومات" },
  { id: "grading_circle", en: "Grading Circle", ar: "دائرة الدرجة" },
  { id: "pull_quote", en: "Pull Quote", ar: "اقتباس بارز" },
  { id: "callout_boxes", en: "Callout Boxes", ar: "صناديق تنبيه" },
  { id: "metric_tiles", en: "Metric Tiles", ar: "بطاقات أرقام" },
  { id: "faq_block", en: "FAQ Block", ar: "قسم أسئلة" },
  { id: "numbered_steps", en: "Numbered Steps", ar: "خطوات مرقمة" },
  { id: "process_chevrons", en: "Process Chevrons", ar: "شيفرونات عملية" },
];

const LAYOUT_PATTERN_OPTIONS: LocalizedChipOption<A4LayoutPattern>[] = [
  { id: "single_column", en: "Single Column", ar: "عمود واحد" },
  { id: "two_column_split", en: "Two-Column Split", ar: "عمودان" },
  { id: "sidebar_main", en: "Sidebar + Main", ar: "شريط جانبي + محتوى" },
  { id: "three_panel_grid", en: "Three-Panel Grid", ar: "ثلاث لوحات" },
  { id: "hero_body", en: "Hero + Body", ar: "رأس ضخم + نص" },
  { id: "centered_composition", en: "Centered", ar: "توسيط كامل" },
  { id: "top_bottom_split", en: "Top / Bottom Split", ar: "تقسيم علوي سفلي" },
  { id: "magazine_editorial", en: "Magazine Editorial", ar: "تحريري مجلة" },
  { id: "zigzag_story", en: "Zigzag Story", ar: "قصة متعرجة" },
  { id: "card_mosaic", en: "Card Mosaic", ar: "فسيفساء بطاقات" },
];

const CreativeSettingsPanel: React.FC<{
  settings: A4CreativeSettings;
  onChange: (next: A4CreativeSettings) => void;
}> = ({ settings, onChange }) => {
  const { lang, t } = useTL();
  const [open, setOpen] = useState(false);

  const set = (patch: Partial<A4CreativeSettings>) => onChange({ ...settings, ...patch });

  const toggleInArray = <T extends string>(current: T[] | null | undefined, value: T): T[] => {
    const list = Array.isArray(current) ? current : [];
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  };

  const singleBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-background border-border hover:border-primary/40 text-foreground/80"
    }`;

  const multiBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
      active
        ? "bg-accent text-accent-foreground border-primary/60 shadow-sm ring-1 ring-primary/30"
        : "bg-background border-border hover:border-primary/40 text-foreground/80"
    }`;

  const recipeCard = (active: boolean) =>
    `text-left rounded-xl border p-3 transition ${
      active
        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
        : "border-border bg-background hover:border-primary/40"
    }`;

  const visualRecipeSummary = settings.visual_recipe
    ? getLocalizedOptionLabel(VISUAL_RECIPE_OPTIONS, settings.visual_recipe, lang)
    : t("Auto", "تلقائي");
  const illustrationSummary = getLocalizedOptionLabel(ILLUSTRATION_STYLE_OPTIONS, settings.illustration_style ?? "none", lang, t("None", "بدون"));
  const accentSummary = summarizeSelectedOptions(ACCENT_ELEMENT_OPTIONS, settings.accent_elements, lang, t("None selected", "لا شيء محدد"));
  const backgroundSummary = settings.background_treatment
    ? getLocalizedOptionLabel(BACKGROUND_TREATMENT_OPTIONS, settings.background_treatment, lang)
    : t("Auto", "تلقائي");
  const contentSummary = summarizeSelectedOptions(CONTENT_COMPONENT_OPTIONS, settings.content_components, lang, t("Auto", "تلقائي"));
  const layoutSummary = settings.layout_pattern
    ? getLocalizedOptionLabel(LAYOUT_PATTERN_OPTIONS, settings.layout_pattern, lang)
    : t("Auto", "تلقائي");

  return (
    <div className="mb-4 rounded-xl border border-border bg-gradient-to-br from-card to-background/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("Creative Controls", "اللمسات الإبداعية")}</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {t("recipe · illustration · accents · components", "وصفة · رسومات · لمسات · مكوّنات")}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 items-start">
            <SettingsDropdownSection
              titleEn="Visual Recipe"
              titleAr="الوصفة البصرية"
              summary={visualRecipeSummary}
              helperEn="Pick a starter vibe"
              helperAr="اختر بداية جاهزة"
            >
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => set({ visual_recipe: null })}
                  className={recipeCard(!settings.visual_recipe)}
                >
                  <div className="text-xs font-semibold">{t("Auto", "تلقائي")}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {t("use the theme's own style", "استخدم نمط القالب")}
                  </div>
                </button>
                {VISUAL_RECIPE_OPTIONS.map((r) => {
                  const active = settings.visual_recipe === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => set({ visual_recipe: active ? null : r.id })}
                      className={recipeCard(active)}
                    >
                      <div className="text-xs font-semibold">{lang === "ar" ? r.ar : r.en}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {lang === "ar" ? r.hint_ar : r.hint_en}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Illustration Style"
              titleAr="نمط الرسومات"
              summary={illustrationSummary}
            >
              <div className="flex flex-wrap gap-2">
                {ILLUSTRATION_STYLE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set({ illustration_style: o.id })}
                    className={singleBtn((settings.illustration_style ?? "none") === o.id)}
                  >
                    {lang === "ar" ? o.ar : o.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Accent Elements"
              titleAr="لمسات زخرفية"
              summary={accentSummary}
              helperEn="Pick any you like"
              helperAr="اختر ما يعجبك"
            >
              <div className="flex flex-wrap gap-2">
                {ACCENT_ELEMENT_OPTIONS.map((o) => {
                  const active = (settings.accent_elements ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set({ accent_elements: toggleInArray(settings.accent_elements, o.id) })}
                      className={multiBtn(active)}
                    >
                      {lang === "ar" ? o.ar : o.en}
                    </button>
                  );
                })}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Background Treatment"
              titleAr="معالجة الخلفية"
              summary={backgroundSummary}
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set({ background_treatment: null })}
                  className={singleBtn(!settings.background_treatment)}
                >
                  {t("Auto", "تلقائي")}
                </button>
                {BACKGROUND_TREATMENT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set({ background_treatment: o.id })}
                    className={singleBtn(settings.background_treatment === o.id)}
                  >
                    {lang === "ar" ? o.ar : o.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Content Components"
              titleAr="مكوّنات المحتوى"
              summary={contentSummary}
              helperEn="Pick any you want on the page"
              helperAr="اختر ما تريد ظهوره في الصفحة"
            >
              <div className="flex flex-wrap gap-2">
                {CONTENT_COMPONENT_OPTIONS.map((o) => {
                  const active = (settings.content_components ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set({ content_components: toggleInArray(settings.content_components, o.id) })}
                      className={multiBtn(active)}
                    >
                      {lang === "ar" ? o.ar : o.en}
                    </button>
                  );
                })}
              </div>
            </SettingsDropdownSection>

            <SettingsDropdownSection
              titleEn="Layout Pattern"
              titleAr="نمط التخطيط"
              summary={layoutSummary}
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set({ layout_pattern: null })}
                  className={singleBtn(!settings.layout_pattern)}
                >
                  {t("Auto", "تلقائي")}
                </button>
                {LAYOUT_PATTERN_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set({ layout_pattern: o.id })}
                    className={singleBtn(settings.layout_pattern === o.id)}
                  >
                    {lang === "ar" ? o.ar : o.en}
                  </button>
                ))}
              </div>
            </SettingsDropdownSection>
          </div>
        </div>
      )}
    </div>
  );
};

const A4Tab: React.FC = () => {
  const { lang, t } = useTL();

  const [stage, setStage] = useState<Stage>("pick");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [purposeId, setPurposeId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [pageChoice, setPageChoice] = useState<PageChoice>("auto");
  const [extractColors, setExtractColors] = useState<boolean>(false);
  const [creativeSettings, setCreativeSettings] = useState<A4CreativeSettings>({
    visual_recipe: null,
    illustration_style: "none",
    accent_elements: [],
    background_treatment: null,
    content_components: [],
    layout_pattern: null,
  });
  const [designSettings, setDesignSettings] = useState<A4DesignSettings>({
    orientation: "portrait",
    background_color: "#FFFFFF",
    text_color: "#0B0D12",
    accent_color: "#2563EB",
    font_family: "modern_sans",
    border_style: "thin",
    include_decorative_images: true,
    density: "balanced",
    tone: "professional",
  });
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<A4DocumentRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // --- Prompt Engineer UI state ---------------------------------------------
  const [inputMode, setInputMode] = useState<A4InputMode>("content_ready");
  const [ideaText, setIdeaText] = useState("");
  const [expandedContent, setExpandedContent] = useState("");
  const [isExpanding, setIsExpanding] = useState(false);
  const [decorWanted, setDecorWanted] = useState<string[]>([]);
  const [customWanted, setCustomWanted] = useState("");

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
    setInputMode("content_ready");
    setIdeaText("");
    setExpandedContent("");
    setIsExpanding(false);
    setDecorWanted([]);
    setCustomWanted("");
  }, []);

  // When theme changes, re-init formState with default values from schema
  useEffect(() => {
    if (!theme) return;
    const initial: Record<string, unknown> = {};
    for (const f of schema) {
      if (f.default !== undefined) initial[f.key] = f.default;
    }
    setFormState(initial);
    setDesignSettings((prev) => ({
      ...prev,
      orientation: prev.orientation === "landscape" ? "landscape" : "portrait",
    }));
  }, [themeId, purposeId]);

  // Cleanup subscription on unmount
  useEffect(() => () => { unsubRef.current?.(); }, []);

  // --- Validate required fields ----------------------------------------------
  const missingRequired = useMemo(() => {
    if (!theme) return [];
    return schema.filter((f) => {
      if (!f.required) return false;
      // In idea mode, raw_content is supplied by the expanded preview, not the form.
      if (inputMode === "idea" && f.key === "raw_content" && expandedContent.trim()) {
        return false;
      }
      const v = formState[f.key];
      return v === undefined || v === null || (typeof v === "string" && !v.trim());
    });
  }, [theme, schema, formState, inputMode, expandedContent]);

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

    // If user is in idea mode and has approved an expanded preview, use that
    // as the raw_content override. If they're in idea mode but haven't expanded
    // yet, block and prompt them.
    let finalForm: Record<string, unknown> = cleanForm;
    if (inputMode === "idea") {
      const approved = expandedContent.trim();
      if (!approved) {
        setIsSubmitting(false);
        toast.error(t(
          "Please expand your idea and review the preview first.",
          "يرجى توسيع الفكرة ومراجعة المعاينة أولاً.",
        ));
        return;
      }
      finalForm = { ...cleanForm, raw_content: approved };
    }

    try {
      const res = await generateA4Document({
        theme_id: theme.id,
        purpose_id: purposeId,
        form_state: finalForm,
        logo_data_url: logoDataUrl,
        logo_color_extract: extractColors && !!logoDataUrl,
        requested_pages: pageChoice,
        language_mode: languageMode,
        design_settings: designSettings,
        creative_settings: creativeSettings,
        input_mode: inputMode,
        decorations_wanted: decorWanted,
        decorations_unwanted: [],
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
  }, [theme, missingRequired, formState, purposeId, pageChoice, extractColors, designSettings, creativeSettings, inputMode, expandedContent, decorWanted, t]);

  // --- Expand idea -----------------------------------------------------------
  const handleExpandIdea = useCallback(async () => {
    if (!theme) return;
    const idea = ideaText.trim();
    if (!idea) {
      toast.error(t("Type your idea first.", "اكتب فكرتك أولاً."));
      return;
    }
    setIsExpanding(true);
    try {
      const languageMode = formState.bilingual === true ? "bilingual" : "en";
      const res = await expandIdea({
        theme_id: theme.id,
        purpose_id: purposeId,
        idea_text: idea,
        language_mode: languageMode,
      });
      if (!res.success || !res.content) {
        toast.error(res.error || t("Expansion failed", "فشل التوسيع"));
        return;
      }
      setExpandedContent(res.content);
      toast.success(t("Draft ready — review and edit below.", "المسودة جاهزة — راجعها وحررها بالأسفل."));
    } catch (e) {
      toast.error(`${t("Expansion failed", "فشل التوسيع")}: ${(e as Error).message}`);
    } finally {
      setIsExpanding(false);
    }
  }, [theme, ideaText, purposeId, formState.bilingual, t]);

  // --- Chip helpers ----------------------------------------------------------
  const toggleChip = useCallback((value: string) => {
    const v = value.trim();
    if (!v) return;
    const current = decorWanted;
    const already = current.some((c) => c.toLowerCase() === v.toLowerCase());
    if (already) {
      setDecorWanted(current.filter((c) => c.toLowerCase() !== v.toLowerCase()));
      return;
    }
    if (current.length >= A4_MAX_CHIPS_PER_SIDE) {
      toast.error(t(
        `You can pick up to ${A4_MAX_CHIPS_PER_SIDE} chips per side.`,
        `يمكنك اختيار حتى ${A4_MAX_CHIPS_PER_SIDE} عناصر لكل جانب.`,
      ));
      return;
    }
    setDecorWanted([...current, v]);
  }, [decorWanted, t]);

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
    try {
      toast.info(t("Building PDF…", "جاري إنشاء الملف…"));
      await downloadA4RowsAsPdf(rows);
    } catch (e) {
      toast.error(`${t("PDF build failed", "فشل بناء الملف")}: ${(e as Error).message}`);
    }
  }, [rows, t]);

  const handleDownloadPhoto = useCallback(async () => {
    try {
      toast.info(t("Preparing photo download…", "جاري تجهيز الصور…"));
      await downloadA4RowsAsJpgs(rows);
    } catch (e) {
      toast.error(`${t("Photo download failed", "فشل تنزيل الصور")}: ${(e as Error).message}`);
    }
  }, [rows, t]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  const aspectRatio = useMemo(() => {
    const base = (theme?.aspect_ratio ?? "2:3") as "2:3" | "3:4";
    if (designSettings.orientation === "landscape") {
      return base === "3:4" ? "4:3" : "3:2";
    }
    return base;
  }, [theme?.aspect_ratio, designSettings.orientation]);
  const currentThemeVisual = theme ? (THEME_VISUALS[theme.id] ?? DEFAULT_VISUAL) : DEFAULT_VISUAL;
  const CurrentThemeIcon = currentThemeVisual.icon;
  const currentThemeBadge = theme ? THEME_BADGES[theme.id] : null;

  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-1 md:px-2 pb-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* ---------- Header strip: current theme + change button --------------- */}
      {theme && stage !== "pick" && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${currentThemeVisual.bg} opacity-90`} />
          <CurrentThemeIcon className={`pointer-events-none absolute -right-3 -bottom-3 h-20 w-20 ${currentThemeVisual.text} opacity-10`} />
          <div className="relative flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/85 shadow-sm ${currentThemeVisual.text}`}>
                <CurrentThemeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${currentThemeVisual.text}`}>
                  {currentThemeBadge ? (lang === "ar" ? currentThemeBadge.ar : currentThemeBadge.en) : t("Theme", "القالب")}
                </div>
                <div className="text-sm font-semibold truncate text-foreground">
                  {lang === "ar" ? theme.name_ar : theme.name_en}
                </div>
                {purposeId && theme.purpose_chips && (
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {lang === "ar"
                      ? theme.purpose_chips.find((p) => p.id === purposeId)?.label_ar
                      : theme.purpose_chips.find((p) => p.id === purposeId)?.label_en}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={resetAll}
              className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-sm hover:border-primary/30 hover:bg-background hover:shadow transition-all active:scale-95"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
              {t("Back", "رجوع")}
            </button>
          </div>
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
                        ? "bg-primary text-primary-foreground border-primary"
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
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95 p-3 sm:p-4 md:p-6 shadow-sm">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${currentThemeVisual.bg} opacity-70`} />
              <CurrentThemeIcon className={`pointer-events-none absolute -right-4 bottom-3 h-24 w-24 ${currentThemeVisual.text} opacity-[0.06]`} />
              <div className="relative">
                <div className="mb-3 text-[10px] leading-4 text-muted-foreground/85">
                  {t(
                    "This form helps guide the design — fill only the parts that matter to you.",
                    "هذا النموذج يساعد في توجيه التصميم — املأ فقط الأجزاء التي تهمك."
                  )}
                </div>
                <DesignSettingsPanel
                  settings={designSettings}
                  onChange={setDesignSettings}
                />
                <CreativeSettingsPanel
                  settings={creativeSettings}
                  onChange={setCreativeSettings}
                />
                {schema.map((field) => {
                  // In idea mode we replace the raw_content textarea with the
                  // idea + expand + editable preview UI below.
                  if (inputMode === "idea" && field.key === "raw_content") return null;
                  return (
                    <FormFieldRenderer
                      key={field.key}
                      field={field}
                      value={formState[field.key]}
                      onChange={(v) => setFormState((prev) => ({ ...prev, [field.key]: v }))}
                    />
                  );
                })}

                {/* --- Input Mode toggle (bottom of content area) ---------- */}
                <div className="mb-3 pt-3 border-t border-border/60">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                    {t("Input mode", "طريقة الإدخال")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode("content_ready")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${
                        inputMode === "content_ready"
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="font-semibold">{t("I have content ready", "لدي المحتوى جاهز")}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {t("Use your content exactly as written.", "سيُستخدم نصك كما هو دون تعديل.")}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("idea")}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${
                        inputMode === "idea"
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="font-semibold">{t("I have just an idea", "لدي مجرد فكرة")}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {t("AI expands it — you review and edit before generation.", "يوسّعها الذكاء الاصطناعي — راجعها وحررها قبل التوليد.")}
                      </div>
                    </button>
                  </div>
                </div>

                {/* --- Idea mode panel ------------------------------------ */}
                {inputMode === "idea" && (
                  <div className="mb-3 rounded-xl border border-border bg-background/60 p-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-foreground/80">
                        {t("Your idea", "فكرتك")}
                      </label>
                      <textarea
                        value={ideaText}
                        onChange={(e) => setIdeaText(e.target.value)}
                        rows={3}
                        placeholder={t(
                          "e.g. A poster for our annual teacher appreciation day with a quote.",
                          "مثال: ملصق ليوم تكريم المعلم السنوي مع اقتباس.",
                        )}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] text-muted-foreground">
                          {t(
                            "We'll expand this into a full draft you can edit before generation.",
                            "سنوسّعها إلى مسودة كاملة يمكنك تحريرها قبل التوليد.",
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleExpandIdea}
                          disabled={isExpanding || !ideaText.trim()}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition ${
                            isExpanding || !ideaText.trim()
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:opacity-90"
                          }`}
                        >
                          {isExpanding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {isExpanding ? t("Expanding…", "جاري التوسيع…") : t("Expand with AI", "وسّع بالذكاء")}
                        </button>
                      </div>
                    </div>

                    {expandedContent && (
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-foreground/80">
                          {t("Draft preview (editable)", "معاينة المسودة (قابلة للتحرير)")}
                        </label>
                        <textarea
                          value={expandedContent}
                          onChange={(e) => setExpandedContent(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 rounded-lg border border-primary/40 bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {t(
                            "Edit freely. This exact text will be used when you click Generate.",
                            "حرر النص بحرية. سيتم استخدام هذا النص عند الضغط على إنشاء.",
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* --- Decorations I want ---------------------------------- */}
                <div className="mb-3 rounded-xl border border-border bg-background/60 p-3 space-y-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("Decorations", "الزخارف")}
                    <span className="ml-2 normal-case text-[10px] text-muted-foreground/70">
                      {t(`pick up to ${A4_MAX_CHIPS_PER_SIDE}`, `اختر حتى ${A4_MAX_CHIPS_PER_SIDE}`)}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold text-foreground/85">{t("Decorations I want", "زخارف أريدها")}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {decorWanted.length}/{A4_MAX_CHIPS_PER_SIDE}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {A4_UNIVERSAL_DECOR_CHIPS.map((chip) => {
                        const label = lang === "ar" ? chip.label_ar : chip.label_en;
                        const key = chip.label_en;
                        const isSelected = decorWanted.some((c) => c.toLowerCase() === key.toLowerCase());
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => toggleChip(key)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition text-left ${
                              isSelected
                                ? "bg-primary/15 text-primary border-primary/60 ring-1 ring-primary/30"
                                : "border-border bg-background hover:border-primary/40"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {decorWanted.filter((v) => !A4_UNIVERSAL_DECOR_CHIPS.some((c) => c.label_en.toLowerCase() === v.toLowerCase())).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {decorWanted
                          .filter((v) => !A4_UNIVERSAL_DECOR_CHIPS.some((c) => c.label_en.toLowerCase() === v.toLowerCase()))
                          .map((v) => (
                            <button
                              key={`custom-want-${v}`}
                              type="button"
                              onClick={() => toggleChip(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] bg-primary/15 text-primary border-primary/60 ring-1 ring-primary/30"
                            >
                              {v}
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={customWanted}
                        onChange={(e) => setCustomWanted(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (customWanted.trim()) {
                              toggleChip(customWanted.trim());
                              setCustomWanted("");
                            }
                          }
                        }}
                        placeholder={t("Add your own…", "أضف عنصرك الخاص…")}
                        className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customWanted.trim()) {
                            toggleChip(customWanted.trim());
                            setCustomWanted("");
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition"
                      >
                        {t("Add", "أضف")}
                      </button>
                    </div>
                  </div>
                </div>

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
                        extractColors ? "bg-primary" : "bg-muted"
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
                              ? "bg-primary text-primary-foreground border-primary"
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
                className={`px-5 py-2.5 rounded-full text-sm font-medium shadow-md bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95 ${
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
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium shadow-md bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-95"
            >
              <Download className="h-4 w-4" />
              {t("Download PDF", "تنزيل PDF")}
            </button>
            <button
              onClick={handleDownloadPhoto}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-all active:scale-95"
            >
              <ImageIcon className="h-4 w-4" />
              {t("Download Photo", "تنزيل الصورة")}
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground shadow-md active:scale-95"
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
