import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Bookmark, MessageCircle, ChevronRight, X, Star } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLLECTIONS = [
  { id: "bukhari", nameEn: "Sahih al-Bukhari", nameAr: "صحيح البخاري", grade: "Sahih" },
  { id: "muslim", nameEn: "Sahih Muslim", nameAr: "صحيح مسلم", grade: "Sahih" },
  { id: "abudawud", nameEn: "Sunan Abu Dawud", nameAr: "سنن أبي داود", grade: "Various" },
  { id: "tirmidhi", nameEn: "Jami at-Tirmidhi", nameAr: "جامع الترمذي", grade: "Various" },
  { id: "ibnmajah", nameEn: "Sunan Ibn Majah", nameAr: "سنن ابن ماجه", grade: "Various" },
  { id: "nasai", nameEn: "Sunan an-Nasa'i", nameAr: "سنن النسائي", grade: "Various" },
];

const HADITH_API_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

interface HadithItem {
  hadithnumber: number;
  text: string;
  grades?: { grade: string; graded_by: string }[];
}

export default function DeenHadith() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const isAr = language === "ar";

  const [view, setView] = useState<"collections" | "reader">("collections");
  const [activeCollection, setActiveCollection] = useState<typeof COLLECTIONS[0] | null>(null);
  const [hadiths, setHadiths] = useState<HadithItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedHadith, setSelectedHadith] = useState<HadithItem | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explLoading, setExplLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const openCollection = async (col: typeof COLLECTIONS[0]) => {
    setActiveCollection(col);
    setView("reader");
    setLoading(true);
    setPage(1);
    try {
      const res = await fetch(`${HADITH_API_BASE}/eng-${col.id}/1-50.json`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const items: HadithItem[] = Object.entries(data?.hadiths ?? {}).map(([num, val]: any) => ({
        hadithnumber: Number(num),
        text: val?.text ?? "",
        grades: val?.grades ?? [],
      }));
      setHadiths(items);
    } catch {
      toast.error(isAr ? "تعذر تحميل الأحاديث" : "Failed to load hadiths");
      setHadiths([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!selectedHadith || !activeCollection) return;
    setExplLoading(true);
    setShowExplanation(true);
    try {
      const { data, error } = await supabase.functions.invoke("deen-ask", {
        body: {
          question: isAr ? "اشرح هذا الحديث بأسلوب بسيط" : "Explain this hadith in simple terms",
          source_type: "hadith",
          source_ref: `${activeCollection.nameEn} — Hadith #${selectedHadith.hadithnumber}`,
          source_text: selectedHadith.text,
          translation: "",
          language: language,
        },
      });
      if (error) throw error;
      setExplanation(data?.answer ?? "");
    } catch {
      setExplanation(isAr ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Please try again.");
    } finally {
      setExplLoading(false);
    }
  };

  const bookmarkHadith = async () => {
    if (!selectedHadith || !activeCollection) return;
    const { error } = await (supabase as any).from("deen_hadith_bookmarks").insert({
      collection: activeCollection.id,
      hadith_number: selectedHadith.hadithnumber,
      hadith_text: selectedHadith.text.slice(0, 500),
    });
    if (!error) toast.success(isAr ? "تم الحفظ ✓" : "Bookmarked ✓");
    setShowActionSheet(false);
  };

  const filtered = hadiths
    .filter((h) => !search || h.text.toLowerCase().includes(search.toLowerCase()))
    .slice(0, page * PAGE_SIZE);

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: "rgba(12,15,20,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => (view === "reader" ? setView("collections") : navigate("/deen"))}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="w-4 h-4 text-[#f2f2f2]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-[#f2f2f2]">
              {view === "reader" && activeCollection
                ? (isAr ? activeCollection.nameAr : activeCollection.nameEn)
                : (isAr ? "الحديث الشريف" : "Hadith")}
            </h1>
          </div>
        </div>
      </div>

      {/* Collections View */}
      {view === "collections" && (
        <div className="px-4 pt-2">
          <p className="text-xs text-[#858384] mb-4">
            {isAr ? "اختر مجموعة للتصفح" : "Select a collection to browse"}
          </p>
          <div className="flex flex-col gap-2">
            {COLLECTIONS.map((col) => (
              <button
                key={col.id}
                onClick={() => openCollection(col)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-4 active:scale-95 transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "hsla(142,76%,55%,0.12)", border: "1px solid hsla(142,76%,55%,0.25)" }}
                >
                  <Star className="w-5 h-5 text-emerald-400" strokeWidth={1.8} />
                </div>
                <div className="flex-1 text-left" style={{ textAlign: isAr ? "right" : "left" }}>
                  <p className="text-sm font-semibold text-[#f2f2f2]">
                    {isAr ? col.nameAr : col.nameEn}
                  </p>
                  <p className="text-[10px] text-[#858384] mt-0.5">
                    {col.grade}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#606062]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reader View */}
      {view === "reader" && (
        <div className="px-4 pt-2">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Search className="w-4 h-4 text-[#858384] flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث في الأحاديث..." : "Search hadiths..."}
              className="flex-1 bg-transparent text-[#f2f2f2] text-sm outline-none placeholder:text-[#606062]"
            />
            {search && (
              <button onClick={() => setSearch("")} title={isAr ? "مسح" : "Clear"}>
                <X className="w-4 h-4 text-[#606062]" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((h) => (
                <button
                  key={h.hadithnumber}
                  onClick={() => { setSelectedHadith(h); setShowActionSheet(true); setShowExplanation(false); setExplanation(""); }}
                  className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-emerald-400"
                      style={{ background: "hsla(142,76%,55%,0.12)", border: "1px solid hsla(142,76%,55%,0.2)" }}
                    >
                      {h.hadithnumber}
                    </div>
                    {h.grades?.[0] && (
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: h.grades[0].grade === "Sahih" ? "hsla(142,76%,55%,0.12)" : "hsla(45,100%,60%,0.12)",
                          color: h.grades[0].grade === "Sahih" ? "#4ade80" : "#fbbf24",
                          border: `1px solid ${h.grades[0].grade === "Sahih" ? "hsla(142,76%,55%,0.25)" : "hsla(45,100%,60%,0.25)"}`,
                        }}
                      >
                        {h.grades[0].grade}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#f2f2f2] leading-relaxed line-clamp-3">
                    {h.text}
                  </p>
                </button>
              ))}

              {filtered.length < hadiths.filter((h) => !search || h.text.toLowerCase().includes(search.toLowerCase())).length && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-emerald-400 active:scale-95 transition-all"
                  style={{ background: "hsla(142,76%,55%,0.08)", border: "1px solid hsla(142,76%,55%,0.2)" }}
                >
                  {isAr ? "تحميل المزيد" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hadith Action Sheet */}
      {showActionSheet && selectedHadith && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => { if (!showExplanation) setShowActionSheet(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full rounded-t-3xl p-5 z-50 max-h-[80vh] overflow-y-auto"
            style={{ background: "linear-gradient(180deg, hsl(235 25% 9%) 0%, #0c0f14 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-[#606062] mx-auto mb-4" />

            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-400"
                style={{ background: "hsla(142,76%,55%,0.12)", border: "1px solid hsla(142,76%,55%,0.2)" }}
              >
                {activeCollection ? (isAr ? activeCollection.nameAr : activeCollection.nameEn) : ""} #{selectedHadith.hadithnumber}
              </span>
              {selectedHadith.grades?.[0] && (
                <span className="text-[10px] text-[#858384]">{selectedHadith.grades[0].grade}</span>
              )}
            </div>

            <div
              className="rounded-xl p-3 mb-4"
              style={{ background: "hsla(142,76%,55%,0.06)", border: "1px solid hsla(142,76%,55%,0.12)" }}
            >
              <p className="text-sm text-[#f2f2f2] leading-relaxed">{selectedHadith.text}</p>
            </div>

            {!showExplanation && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <ActionBtn icon={MessageCircle} label={isAr ? "اشرح" : "Explain"} glow="hsla(280,70%,65%,0.3)" onClick={handleExplain} />
                <ActionBtn icon={Bookmark} label={isAr ? "حفظ" : "Bookmark"} glow="hsla(45,100%,60%,0.3)" onClick={bookmarkHadith} />
              </div>
            )}

            {showExplanation && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-[#858384] uppercase tracking-widest">{isAr ? "الشرح" : "Explanation"}</p>
                  <button onClick={() => { setShowExplanation(false); setExplanation(""); }} title={isAr ? "إغلاق" : "Close"}>
                    <X className="w-4 h-4 text-[#606062]" />
                  </button>
                </div>
                {explLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="w-4 h-4 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-xs text-[#858384]">{isAr ? "جار الشرح..." : "Explaining..."}</span>
                  </div>
                ) : (
                  <div className="rounded-xl p-4" style={{ background: "hsla(280,70%,65%,0.07)", border: "1px solid hsla(280,70%,65%,0.15)" }}>
                    <p className="text-sm text-[#f2f2f2] leading-relaxed whitespace-pre-wrap">{explanation}</p>
                  </div>
                )}
                <button
                  onClick={bookmarkHadith}
                  className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-amber-400 active:scale-95 transition-all"
                  style={{ background: "hsla(45,100%,60%,0.08)", border: "1px solid hsla(45,100%,60%,0.2)" }}
                >
                  {isAr ? "حفظ في المكتبة" : "Save to Library"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, glow, onClick }: { icon: React.ElementType; label: string; glow: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 active:scale-95 transition-all duration-150 w-full justify-center"
      style={{ background: glow.replace("0.3", "0.08"), border: `1px solid ${glow}` }}
    >
      <Icon className="w-4 h-4 text-[#f2f2f2]" />
      <span className="text-xs font-semibold text-[#f2f2f2]">{label}</span>
    </button>
  );
}
