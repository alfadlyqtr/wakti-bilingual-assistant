import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Bookmark, Clock, CheckCircle, RotateCcw, BookOpen, Star, Trash2 } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StudyTab = "memorize" | "bookmarks" | "history";

export default function DeenStudy() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<StudyTab>("memorize");
  const [memorization, setMemorization] = useState<any[]>([]);
  const [quranBookmarks, setQuranBookmarks] = useState<any[]>([]);
  const [hadithBookmarks, setHadithBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "memorize") {
        const { data } = await (supabase as any)
          .from("deen_memorization")
          .select("*")
          .order("updated_at", { ascending: false });
        setMemorization(data ?? []);
      } else if (activeTab === "bookmarks") {
        const [q, h] = await Promise.all([
          (supabase as any).from("deen_quran_bookmarks").select("*").order("created_at", { ascending: false }),
          (supabase as any).from("deen_hadith_bookmarks").select("*").order("created_at", { ascending: false }),
        ]);
        setQuranBookmarks(q.data ?? []);
        setHadithBookmarks(h.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateMemorizationStatus = async (id: string, status: string) => {
    await (supabase as any).from("deen_memorization").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setMemorization((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
    toast.success(isAr ? "تم التحديث ✓" : "Updated ✓");
  };

  const deleteQuranBookmark = async (id: string) => {
    await (supabase as any).from("deen_quran_bookmarks").delete().eq("id", id);
    setQuranBookmarks((prev) => prev.filter((b) => b.id !== id));
    toast.success(isAr ? "تم الحذف" : "Deleted");
  };

  const deleteHadithBookmark = async (id: string) => {
    await (supabase as any).from("deen_hadith_bookmarks").delete().eq("id", id);
    setHadithBookmarks((prev) => prev.filter((b) => b.id !== id));
    toast.success(isAr ? "تم الحذف" : "Deleted");
  };

  const memorizedCount = memorization.filter((m) => m.status === "memorized").length;
  const learningCount = memorization.filter((m) => m.status === "learning").length;

  const tabs: { id: StudyTab; labelEn: string; labelAr: string }[] = [
    { id: "memorize", labelEn: "Memorize", labelAr: "الحفظ" },
    { id: "bookmarks", labelEn: "Bookmarks", labelAr: "المحفوظات" },
    { id: "history", labelEn: "Plans", labelAr: "الخطط" },
  ];

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: "rgba(12,15,20,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/deen")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="w-4 h-4 text-[#f2f2f2]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <h1 className="text-base font-bold text-[#f2f2f2]">{isAr ? "الدراسة" : "Study"}</h1>
        </div>

        {/* Tab bar */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
              style={
                activeTab === tab.id
                  ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.25)" }
                  : { color: "#858384" }
              }
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2">
        {/* Memorize Tab */}
        {activeTab === "memorize" && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatCard
                value={memorization.length}
                label={isAr ? "المجموع" : "Total"}
                color="#858384"
                bg="rgba(255,255,255,0.04)"
              />
              <StatCard
                value={learningCount}
                label={isAr ? "جار الحفظ" : "Learning"}
                color="#60a5fa"
                bg="hsla(210,100%,65%,0.08)"
              />
              <StatCard
                value={memorizedCount}
                label={isAr ? "تم الحفظ" : "Memorized"}
                color="#4ade80"
                bg="hsla(142,76%,55%,0.08)"
              />
            </div>

            {loading ? (
              <Loader />
            ) : memorization.length === 0 ? (
              <EmptyState
                icon={Brain}
                titleEn="No memorization yet"
                titleAr="لا يوجد حفظ بعد"
                subEn="Start reading Quran and tap an ayah to begin memorizing"
                subAr="ابدأ القراءة واضغط على آية لبدء الحفظ"
                navigate={navigate}
                path="/deen/quran"
                ctaEn="Go to Quran"
                ctaAr="اذهب للقرآن"
                isAr={isAr}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {memorization.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl p-3.5 flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        background: m.status === "memorized" ? "hsla(142,76%,55%,0.12)" : "hsla(210,100%,65%,0.12)",
                        color: m.status === "memorized" ? "#4ade80" : "#60a5fa",
                        border: `1px solid ${m.status === "memorized" ? "hsla(142,76%,55%,0.25)" : "hsla(210,100%,65%,0.25)"}`,
                      }}
                    >
                      {m.surah_number}:{m.ayah_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#f2f2f2]">
                        {isAr ? "سورة" : "Surah"} {m.surah_number} — {isAr ? "آية" : "Ayah"} {m.ayah_number}
                      </p>
                      <p className="text-[10px] text-[#858384] mt-0.5">
                        {m.status === "memorized"
                          ? (isAr ? "✅ تم الحفظ" : "✅ Memorized")
                          : m.status === "needs_revision"
                          ? (isAr ? "🔄 يحتاج مراجعة" : "🔄 Needs revision")
                          : (isAr ? "📖 جار الحفظ" : "📖 Learning")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {m.status !== "memorized" && (
                        <button
                          onClick={() => updateMemorizationStatus(m.id, "memorized")}
                          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                          style={{ background: "hsla(142,76%,55%,0.12)", border: "1px solid hsla(142,76%,55%,0.2)" }}
                          title={isAr ? "تم الحفظ" : "Memorized"}
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                      {m.status === "memorized" && (
                        <button
                          onClick={() => updateMemorizationStatus(m.id, "needs_revision")}
                          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                          style={{ background: "hsla(45,100%,60%,0.12)", border: "1px solid hsla(45,100%,60%,0.2)" }}
                          title={isAr ? "يحتاج مراجعة" : "Needs revision"}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookmarks Tab */}
        {activeTab === "bookmarks" && (
          <div>
            {quranBookmarks.length === 0 && hadithBookmarks.length === 0 && !loading ? (
              <EmptyState
                icon={Bookmark}
                titleEn="No bookmarks yet"
                titleAr="لا توجد محفوظات بعد"
                subEn="Bookmark verses and hadith while reading"
                subAr="احفظ الآيات والأحاديث أثناء القراءة"
                navigate={navigate}
                path="/deen/quran"
                ctaEn="Start reading"
                ctaAr="ابدأ القراءة"
                isAr={isAr}
              />
            ) : loading ? (
              <Loader />
            ) : (
              <>
                {quranBookmarks.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                      <p className="text-xs font-bold text-[#858384] uppercase tracking-wider">
                        {isAr ? "القرآن الكريم" : "Quran"} ({quranBookmarks.length})
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {quranBookmarks.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-xl p-3.5 flex items-center gap-3"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-sky-400"
                            style={{ background: "hsla(210,100%,65%,0.1)", border: "1px solid hsla(210,100%,65%,0.2)" }}
                          >
                            {b.surah_number}:{b.ayah_number}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#f2f2f2]">
                              {isAr ? "سورة" : "Surah"} {b.surah_number} — {isAr ? "آية" : "Ayah"} {b.ayah_number}
                            </p>
                            {b.note && <p className="text-[10px] text-[#858384] mt-0.5">{b.note}</p>}
                          </div>
                          <button
                            onClick={() => deleteQuranBookmark(b.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                            title={isAr ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hadithBookmarks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-3.5 h-3.5 text-emerald-400" />
                      <p className="text-xs font-bold text-[#858384] uppercase tracking-wider">
                        {isAr ? "الحديث الشريف" : "Hadith"} ({hadithBookmarks.length})
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {hadithBookmarks.map((b) => (
                        <div
                          key={b.id}
                          className="rounded-xl p-3.5 flex items-start gap-3"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-emerald-400 mt-0.5"
                            style={{ background: "hsla(142,76%,55%,0.1)", border: "1px solid hsla(142,76%,55%,0.2)" }}
                          >
                            #{b.hadith_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#f2f2f2] mb-0.5">{b.collection}</p>
                            {b.hadith_text && (
                              <p className="text-xs text-[#858384] line-clamp-2 leading-relaxed">{b.hadith_text}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteHadithBookmark(b.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                            title={isAr ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-3">
            <PlanCard
              icon={BookOpen}
              titleEn="Daily Reading"
              titleAr="القراءة اليومية"
              descEn="Read a set number of ayahs each day"
              descAr="اقرأ عدداً محدداً من الآيات يومياً"
              glow="hsla(210,100%,65%,0.3)"
              onClick={() => navigate("/deen/quran")}
              isAr={isAr}
            />
            <PlanCard
              icon={Brain}
              titleEn="Memorization Plan"
              titleAr="خطة الحفظ"
              descEn="Memorize ayahs step by step"
              descAr="احفظ الآيات خطوة بخطوة"
              glow="hsla(142,76%,55%,0.3)"
              onClick={() => setActiveTab("memorize")}
              isAr={isAr}
            />
            <PlanCard
              icon={Star}
              titleEn="Hadith Study"
              titleAr="دراسة الحديث"
              descEn="Read and understand a hadith daily"
              descAr="اقرأ وافهم حديثاً يومياً"
              glow="hsla(45,100%,60%,0.3)"
              onClick={() => navigate("/deen/hadith")}
              isAr={isAr}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[9px] text-[#858384] font-semibold mt-0.5">{label}</p>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, titleEn, titleAr, subEn, subAr, navigate, path, ctaEn, ctaAr, isAr }: {
  icon: React.ElementType; titleEn: string; titleAr: string; subEn: string; subAr: string;
  navigate: (p: string) => void; path: string; ctaEn: string; ctaAr: string; isAr: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon className="w-7 h-7 text-[#606062]" />
      </div>
      <p className="text-sm font-semibold text-[#f2f2f2]">{isAr ? titleAr : titleEn}</p>
      <p className="text-xs text-[#858384] max-w-[220px] leading-relaxed">{isAr ? subAr : subEn}</p>
      <button
        onClick={() => navigate(path)}
        className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-all"
        style={{ background: "hsla(210,100%,65%,0.12)", color: "#7dd3fc", border: "1px solid hsla(210,100%,65%,0.25)" }}
      >
        {isAr ? ctaAr : ctaEn}
      </button>
    </div>
  );
}

function PlanCard({ icon: Icon, titleEn, titleAr, descEn, descAr, glow, onClick, isAr }: {
  icon: React.ElementType; titleEn: string; titleAr: string; descEn: string; descAr: string;
  glow: string; onClick: () => void; isAr: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl p-4 active:scale-95 transition-all text-left"
      style={{ background: glow.replace("0.3", "0.06"), border: `1px solid ${glow.replace("0.3", "0.18")}` }}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: glow.replace("0.3", "0.15") }}>
        <Icon className="w-5 h-5 text-[#f2f2f2]" strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-sm font-bold text-[#f2f2f2]">{isAr ? titleAr : titleEn}</p>
        <p className="text-[11px] text-[#858384] mt-0.5">{isAr ? descAr : descEn}</p>
      </div>
    </button>
  );
}
