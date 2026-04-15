import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Copy, Check, ScrollText, Send, Sparkles, BookText } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";

interface EvidenceResult {
  source_type: "quran" | "hadith";
  title: string;
  reference: string;
  text: string;
  translation?: string;
  arabic_text?: string;
  english_text?: string;
  grade?: string;
  surah_number?: number;
  ayah_number?: number;
}

interface SearchResponse {
  query: string;
  quran_results: EvidenceResult[];
  hadith_results: EvidenceResult[];
  meta?: {
    found: boolean;
    quran_count: number;
    hadith_count: number;
    search_query?: string;
  };
}

interface ExplanationResponse {
  summary: string;
  quran_summary?: string;
  hadith_summary?: string;
}

interface ChatTurn {
  id: number;
  query: string;
  results: SearchResponse | null;
  explanation: ExplanationResponse | null;
  explaining: boolean;
}

const TRUNCATE_CHARS = 220;

const TAFSIR_EDITION = "en-tafisr-ibn-kathir";
const TAFSIR_BASE = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir";
const TAFSIR_EDITION_AR = "ar-tafsir-muyassar";
const TAFSIR_EDITION_AR_FALLBACK = "ar-tafsir-ibn-kathir";

function CopyButton({ text, isDark, isAr }: { text: string; isDark: boolean; isAr: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title={isAr ? "نسخ" : "Copy"}
      className={`flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-90 ${
        copied
          ? (isDark ? "text-emerald-400" : "text-emerald-600")
          : (isDark ? "text-[#858384] hover:text-[#c4c8d4]" : "text-[#9ca3b0] hover:text-[#606062]")
      }`}
    >
      {copied
        ? <><Check className="w-3 h-3" />{isAr ? "تم النسخ" : "Copied"}</>
        : <><Copy className="w-3 h-3" />{isAr ? "نسخ" : "Copy"}</>}
    </button>
  );
}

function SourceCard({
  item,
  isAr,
  accent,
  isDark,
}: {
  item: EvidenceResult;
  isAr: boolean;
  accent: "blue" | "green";
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsir, setTafsir] = useState<string | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);

  const mainText = isAr
    ? (item.arabic_text || item.text || "")
    : (item.english_text || item.text || "");

  const needsTruncation = mainText.length > TRUNCATE_CHARS;
  const displayText = needsTruncation && !expanded
    ? mainText.slice(0, TRUNCATE_CHARS).trimEnd() + "…"
    : mainText;

  const isBlue = accent === "blue";
  const isQuran = item.source_type === "quran";

  const bg = isDark
    ? (isBlue ? "hsla(210,100%,65%,0.08)" : "hsla(142,76%,55%,0.08)")
    : (isBlue ? "hsla(210,100%,40%,0.06)" : "hsla(142,76%,35%,0.06)");
  const border = isDark
    ? (isBlue ? "1px solid hsla(210,100%,65%,0.2)" : "1px solid hsla(142,76%,55%,0.2)")
    : (isBlue ? "1px solid hsla(210,100%,40%,0.2)" : "1px solid hsla(142,76%,35%,0.2)");
  const refColor = isDark
    ? (isBlue ? "text-sky-300" : "text-emerald-400")
    : (isBlue ? "text-sky-600" : "text-emerald-700");
  const gradeColor = isDark
    ? (isBlue ? "text-sky-400" : "text-emerald-400")
    : (isBlue ? "text-sky-500" : "text-emerald-600");
  const textColor = isDark ? "text-[#e8eaf0]" : "text-[#1a1f2e]";
  const tafsirBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const tafsirBorder = isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)";

  const loadTafsir = async () => {
    if (tafsir !== null) { setTafsirOpen((v) => !v); return; }
    if (!item.surah_number || !item.ayah_number) return;
    setTafsirOpen(true);
    setTafsirLoading(true);
    try {
      const editions = isAr
        ? [TAFSIR_EDITION_AR, TAFSIR_EDITION_AR_FALLBACK]
        : [TAFSIR_EDITION];
      let text: string | null = null;
      for (const edition of editions) {
        const res = await fetch(`${TAFSIR_BASE}/${edition}/${item.surah_number}/${item.ayah_number}.json`);
        if (res.ok) {
          const data = await res.json();
          text = data?.text || data?.tafsir || null;
          if (text) break;
        }
      }
      setTafsir(text ?? (isAr ? "لا يوجد تفسير متاح لهذه الآية." : "No tafsir available for this verse."));
    } catch {
      setTafsir(isAr ? "لا يوجد تفسير متاح لهذه الآية." : "No tafsir available for this verse.");
    } finally {
      setTafsirLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: bg, border }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${refColor}`}>{item.reference}</p>
        {item.grade && <span className={`text-[10px] font-medium shrink-0 ${gradeColor}`}>{item.grade}</span>}
      </div>
      <p className={`text-sm leading-relaxed ${textColor}`}>{displayText}</p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {needsTruncation && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`flex items-center gap-1 text-[11px] font-semibold ${refColor} active:opacity-70 transition-opacity`}
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />{isAr ? "أقل" : "Show less"}</>
              : <><ChevronDown className="w-3 h-3" />{isAr ? "اقرأ المزيد" : "Read more"}</>}
          </button>
        )}
        <CopyButton text={`${item.reference}\n${mainText}`} isDark={isDark} isAr={isAr} />
        {isQuran && item.surah_number && item.ayah_number && (
          <button
            onClick={loadTafsir}
            className={`flex items-center gap-1 text-[11px] font-semibold ${isDark ? "text-amber-400" : "text-amber-600"} active:opacity-70 transition-opacity`}
          >
            <BookText className="w-3 h-3" />
            {isAr ? "التفسير" : "View Tafsir"}
          </button>
        )}
      </div>
      {tafsirOpen && (
        <div className="mt-3 rounded-xl p-3" style={{ background: tafsirBg, border: tafsirBorder }}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-600"}`}>
              {isAr ? "تفسير" : "Tafsir"}
            </p>
            <button onClick={() => setTafsirOpen(false)} className={`text-[10px] ${isDark ? "text-[#858384]" : "text-[#9ca3b0]"}`}>
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
          {tafsirLoading
            ? <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /><span className={`text-xs ${isDark ? "text-[#858384]" : "text-[#9ca3b0]"}`}>{isAr ? "جار التحميل..." : "Loading tafsir..."}</span></div>
            : <p className={`text-xs leading-relaxed ${textColor}`}>{tafsir}</p>
          }
        </div>
      )}
    </div>
  );
}

export default function DeenAsk() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState("");
  const [searching, setSearching] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const turnCounter = useRef(0);

  useEffect(() => {
    document.body.classList.add("deen-ask-page");
    return () => { document.body.classList.remove("deen-ask-page"); };
  }, []);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    if (turns.length > 0 || searching) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 80);
    }
  }, [turns, searching]);

  const updateTurn = (id: number, patch: Partial<ChatTurn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const autoExplain = async (turnId: number, q: string, quranResults: SearchResponse["quran_results"], hadithResults: SearchResponse["hadith_results"], currentTurns: ChatTurn[]) => {
    updateTurn(turnId, { explaining: true });

    const priorContext = currentTurns
      .filter((t) => t.id !== turnId && t.explanation?.summary)
      .slice(-2)
      .map((t) => `Q: ${t.query}\nA: ${t.explanation!.summary.slice(0, 200)}`)
      .join("\n\n");

    try {
      const { data, error } = await supabase.functions.invoke("deen-explain", {
        body: {
          question: q,
          language,
          quran_results: quranResults,
          hadith_results: hadithResults,
          prior_context: priorContext || undefined,
        },
      });
      if (error) throw error;
      updateTurn(turnId, {
        explaining: false,
        explanation: {
          summary: data?.summary ?? "",
          quran_summary: data?.quran_summary ?? "",
          hadith_summary: data?.hadith_summary ?? "",
        },
      });
    } catch {
      updateTurn(turnId, {
        explaining: false,
        explanation: {
          summary: isAr ? "تعذر شرح النتائج الآن." : "Could not explain these results right now.",
          quran_summary: "",
          hadith_summary: "",
        },
      });
    }
  };

  const handleSend = async () => {
    const q = question.trim();
    if (!q) return;

    const id = ++turnCounter.current;
    const newTurn: ChatTurn = { id, query: q, results: null, explanation: null, explaining: false };
    setTurns((prev) => [...prev, newTurn]);
    setQuestion("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSearching(true);

    let quranResults: SearchResponse["quran_results"] = [];
    let hadithResults: SearchResponse["hadith_results"] = [];
    let hasAnyResults = false;

    try {
      const { data, error } = await supabase.functions.invoke("deen-search", {
        body: { query: q, language, limit: 5 },
      });
      if (error) throw error;
      quranResults = Array.isArray(data?.quran_results) ? data.quran_results : [];
      hadithResults = Array.isArray(data?.hadith_results) ? data.hadith_results : [];
      hasAnyResults = quranResults.length > 0 || hadithResults.length > 0;
      updateTurn(id, {
        results: {
          query: data?.query ?? q,
          quran_results: quranResults,
          hadith_results: hadithResults,
          meta: data?.meta,
        },
      });
    } catch {
      updateTurn(id, {
        results: { query: q, quran_results: [], hadith_results: [], meta: { found: false, quran_count: 0, hadith_count: 0 } },
      });
    } finally {
      setSearching(false);
    }

    setTurns((currentTurns) => {
      const hasPrior = currentTurns.some((t) => t.id !== id && t.explanation?.summary);
      if (hasAnyResults || hasPrior) {
        autoExplain(id, q, quranResults, hadithResults, currentTurns);
      }
      return currentTurns;
    });
  };

  const bg = isDark
    ? "linear-gradient(160deg, #0c0f14 0%, hsl(235 25% 7%) 100%)"
    : "linear-gradient(160deg, #f4f6f9 0%, #eef1f7 100%)";
  const headerBg = isDark ? "rgba(12,15,20,0.92)" : "rgba(244,246,249,0.92)";
  const composerBg = isDark ? "rgba(12,15,20,0.96)" : "rgba(244,246,249,0.96)";
  const composerInner = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const composerBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const titleColor = isDark ? "text-[#f2f2f2]" : "text-[#060541]";
  const subtitleColor = isDark ? "text-[#858384]" : "text-[#606062]";
  const textColor = isDark ? "text-[#e8eaf0]" : "text-[#1a1f2e]";
  const placeholderColor = isDark ? "placeholder:text-[#606062]" : "placeholder:text-[#9ca3b0]";
  const sendBtnBg = isDark
    ? "linear-gradient(135deg, hsl(210 100% 62%) 0%, hsl(200 90% 55%) 100%)"
    : "linear-gradient(135deg, hsl(210 100% 50%) 0%, hsl(200 90% 45%) 100%)";

  const userBubbleBg = isDark
    ? { background: "hsla(215,25%,22%,0.95)", border: "1px solid hsla(215,20%,35%,0.5)" }
    : { background: "hsla(215,30%,25%,0.92)", border: "none" };

  const emptyCardBg = isDark
    ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }
    : { background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" };


  return (
    <div
      className="flex flex-col"
      style={{ background: bg, height: "calc(100dvh - var(--app-header-h, 64px))", overflow: "hidden" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header — sticks to top inside the flex column */}
      <div
        className={`shrink-0 px-4 flex items-center justify-between gap-3 ${isAr ? "flex-row-reverse" : "flex-row"}`}
        style={{
          height: "56px",
          background: headerBg,
          backdropFilter: "blur(20px)",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className={isAr ? "text-right" : "text-left"}>
          <h1 className={`text-base font-bold ${titleColor}`}>{isAr ? "اسأل" : "Ask"}</h1>
          <p className={`text-[11px] ${subtitleColor}`}>{isAr ? "مصادر القرآن والحديث فقط" : "Quran & Hadith sources only"}</p>
        </div>
        <button
          onClick={() => navigate("/deen")}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all shrink-0"
          style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}
          title={isAr ? "رجوع" : "Back"}
        >
          <ArrowLeft className={`w-4 h-4 ${titleColor}`} />
        </button>
      </div>

      {/* Chat area — fills all remaining space, scrolls */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
        style={{ minHeight: 0 }}
      >

        {/* Empty / intro */}
        {!searching && turns.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}>
              <BookOpen className={`w-7 h-7 ${isDark ? "text-sky-300" : "text-sky-600"}`} />
            </div>
            <p className={`text-sm font-semibold ${titleColor}`}>{isAr ? "اسأل عن القرآن والحديث" : "Ask about Quran & Hadith"}</p>
            <p className={`text-xs leading-relaxed ${subtitleColor}`}>
              {isAr ? "اكتب سؤالك أو مرجعاً مباشراً في الأسفل. النتائج من المصادر الأصلية فقط." : "Type your question or a direct reference below. Results come only from authentic sources."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {(isAr
                ? ["آية الكرسي","صلاة السفر","بر الوالدين","الصبر","الصدقة","كيف أعامل والديّ؟","حقوق الزوجة","آداب الطعام","الدعاء عند الكرب","فضل قراءة القرآن","التوبة والاستغفار"]
                : ["Ayatul Kursi","Travel prayer","Parents in Islam","Patience in Islam","Virtues of charity","How to treat parents","Rights of a wife","Etiquette of eating","Dua in times of distress","Virtues of reading Quran","Repentance and forgiveness"]
              ).map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setQuestion(ex); setTimeout(() => textareaRef.current?.focus(), 50); }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95 ${isDark ? "bg-white/8 text-[#c4c8d4] border border-white/10" : "bg-black/5 text-[#3a3f5c] border border-black/10"}`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rendered turns */}
        {turns.map((turn) => {
          const turnHasResults = !!turn.results && ((turn.results.quran_results?.length ?? 0) > 0 || (turn.results.hadith_results?.length ?? 0) > 0);
          const isLastTurn = turn.id === turns[turns.length - 1]?.id;
          return (
            <div key={turn.id} className="flex flex-col gap-3">
              {/* User bubble */}
              <div className={`flex ${isAr ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[80%] rounded-2xl px-4 py-3" style={userBubbleBg}>
                  <p className="text-sm font-medium text-white leading-relaxed">{turn.query}</p>
                </div>
              </div>

              {/* Searching dots — shown while fetching sources for this turn */}
              {!turn.results && isLastTurn && searching && (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {/* No results */}
              {turn.results && !turnHasResults && (
                <div className="rounded-2xl p-4" style={emptyCardBg}>
                  <p className={`text-sm leading-relaxed ${textColor}`}>
                    {isAr
                      ? "لم أجد آية أو حديثاً مرتبطاً بهذا بالتحديد. جرّب سؤالاً مختلفاً أو كلمات أبسط."
                      : "I couldn't find a Quran verse or Hadith specifically for this. Try rephrasing or a simpler keyword."}
                  </p>
                </div>
              )}

              {/* Sources */}
              {turnHasResults && (
                <div className="flex flex-col gap-2">
                  {!!turn.results!.quran_results.length && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 px-1">
                        <BookOpen className={`w-3.5 h-3.5 ${isDark ? "text-sky-300" : "text-sky-600"}`} />
                        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-sky-300" : "text-sky-700"}`}>
                          {isAr ? "من القرآن الكريم" : "From the Quran"}
                        </p>
                      </div>
                      {turn.results!.quran_results.map((item, index) => (
                        <SourceCard key={`q-${turn.id}-${item.reference}-${index}`} item={item} isAr={isAr} accent="blue" isDark={isDark} />
                      ))}
                    </div>
                  )}
                  {!!turn.results!.hadith_results.length && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 px-1">
                        <ScrollText className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`} />
                        <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                          {isAr ? "من الحديث الشريف" : "From the Hadith"}
                        </p>
                      </div>
                      {turn.results!.hadith_results.map((item, index) => (
                        <SourceCard key={`h-${turn.id}-${item.reference}-${index}`} item={item} isAr={isAr} accent="green" isDark={isDark} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI reply — typing dots while generating, then conversational bubble */}
              {(turnHasResults || turn.explaining || turn.explanation) && (
                <>
                  {turn.explaining && (
                    <div className="flex items-center gap-2 px-1">
                      <Sparkles className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
                      <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                  {turn.explanation && (
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className={`flex items-center gap-1.5 mb-2 ${isAr ? "flex-row-reverse" : ""}`}>
                        <Sparkles className={`w-3 h-3 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-sky-400" : "text-sky-600"}`}>
                          Wakti
                        </p>
                        <div className="flex-1" />
                        <CopyButton text={turn.explanation.summary} isDark={isDark} isAr={isAr} />
                      </div>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>{turn.explanation.summary}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Searching dots for the very first load before any turn renders */}
        {searching && turns.length === 0 && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full animate-bounce bg-sky-400" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      {/* Composer — sticks to bottom inside the flex column */}
      <div
        className="shrink-0"
        style={{
          background: composerBg,
          backdropFilter: "blur(20px)",
          borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
          padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px)) 16px",
        }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl"
          style={{
            background: composerInner,
            border: `1px solid ${composerBorder}`,
            padding: "10px 12px",
            minHeight: "48px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={question}
            rows={1}
            onChange={(e) => {
              setQuestion(e.target.value);
              requestAnimationFrame(resizeTextarea);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isAr ? "اسأل عن القرآن والحديث..." : "Ask about Quran or Hadith…"}
            className={`flex-1 resize-none bg-transparent text-sm leading-[1.6] outline-none ${textColor} ${placeholderColor}`}
            style={{ minHeight: "24px", maxHeight: "120px", overflowY: "auto", paddingTop: "2px" }}
            dir={isAr ? "rtl" : "ltr"}
          />
          <button
            onClick={handleSend}
            disabled={searching || !question.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 shrink-0"
            style={{ background: sendBtnBg, boxShadow: "0 0 10px hsla(280,70%,65%,0.35)", marginBottom: "0px" }}
            title={isAr ? "إرسال" : "Send"}
          >
            <Send className="w-4 h-4 text-white" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
        </div>
      </div>
    </div>
  );
}
