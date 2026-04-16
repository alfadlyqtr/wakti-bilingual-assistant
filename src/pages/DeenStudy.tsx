import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Bookmark, CheckCircle, RotateCcw, BookOpen, Play, Pause, Eye, EyeOff, ChevronRight, X, Target, Search, Trash2 } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StudyTab = "today" | "review" | "plans";
type PlanType = "beginner" | "juzamma" | "custom";
type ReviewFilter = "needs_revision" | "learning" | "memorized";

interface StudyPlan {
  id: string;
  type: PlanType;
  dailyGoal: number;
  currentSurah: number;
  currentAyah: number;
  startSurah?: number;
  startAyah?: number;
}

interface StudyPlanStore {
  activePlanId: string | null;
  plans: StudyPlan[];
}

interface AyahData {
  surah_number: number;
  ayah_number: number;
  arabic: string;
  translation: string;
  audioUrl?: string;
}

const STUDY_PLAN_KEY = "deen_study_plan_v2";

const SURAH_LIST: { n: number; en: string; ar: string; ayahs: number }[] = [
  { n:1,en:"Al-Fatiha",ar:"الفاتحة",ayahs:7 },{ n:2,en:"Al-Baqara",ar:"البقرة",ayahs:286 },
  { n:3,en:"Ali 'Imran",ar:"آل عمران",ayahs:200 },{ n:4,en:"An-Nisa",ar:"النساء",ayahs:176 },
  { n:5,en:"Al-Ma'ida",ar:"المائدة",ayahs:120 },{ n:6,en:"Al-An'am",ar:"الأنعام",ayahs:165 },
  { n:7,en:"Al-A'raf",ar:"الأعراف",ayahs:206 },{ n:8,en:"Al-Anfal",ar:"الأنفال",ayahs:75 },
  { n:9,en:"At-Tawba",ar:"التوبة",ayahs:129 },{ n:10,en:"Yunus",ar:"يونس",ayahs:109 },
  { n:11,en:"Hud",ar:"هود",ayahs:123 },{ n:12,en:"Yusuf",ar:"يوسف",ayahs:111 },
  { n:13,en:"Ar-Ra'd",ar:"الرعد",ayahs:43 },{ n:14,en:"Ibrahim",ar:"إبراهيم",ayahs:52 },
  { n:15,en:"Al-Hijr",ar:"الحجر",ayahs:99 },{ n:16,en:"An-Nahl",ar:"النحل",ayahs:128 },
  { n:17,en:"Al-Isra",ar:"الإسراء",ayahs:111 },{ n:18,en:"Al-Kahf",ar:"الكهف",ayahs:110 },
  { n:19,en:"Maryam",ar:"مريم",ayahs:98 },{ n:20,en:"Ta-Ha",ar:"طه",ayahs:135 },
  { n:21,en:"Al-Anbiya",ar:"الأنبياء",ayahs:112 },{ n:22,en:"Al-Hajj",ar:"الحج",ayahs:78 },
  { n:23,en:"Al-Mu'minun",ar:"المؤمنون",ayahs:118 },{ n:24,en:"An-Nur",ar:"النور",ayahs:64 },
  { n:25,en:"Al-Furqan",ar:"الفرقان",ayahs:77 },{ n:26,en:"Ash-Shu'ara",ar:"الشعراء",ayahs:227 },
  { n:27,en:"An-Naml",ar:"النمل",ayahs:93 },{ n:28,en:"Al-Qasas",ar:"القصص",ayahs:88 },
  { n:29,en:"Al-'Ankabut",ar:"العنكبوت",ayahs:69 },{ n:30,en:"Ar-Rum",ar:"الروم",ayahs:60 },
  { n:31,en:"Luqman",ar:"لقمان",ayahs:34 },{ n:32,en:"As-Sajda",ar:"السجدة",ayahs:30 },
  { n:33,en:"Al-Ahzab",ar:"الأحزاب",ayahs:73 },{ n:34,en:"Saba",ar:"سبأ",ayahs:54 },
  { n:35,en:"Fatir",ar:"فاطر",ayahs:45 },{ n:36,en:"Ya-Sin",ar:"يس",ayahs:83 },
  { n:37,en:"As-Saffat",ar:"الصافات",ayahs:182 },{ n:38,en:"Sad",ar:"ص",ayahs:88 },
  { n:39,en:"Az-Zumar",ar:"الزمر",ayahs:75 },{ n:40,en:"Ghafir",ar:"غافر",ayahs:85 },
  { n:41,en:"Fussilat",ar:"فصلت",ayahs:54 },{ n:42,en:"Ash-Shura",ar:"الشورى",ayahs:53 },
  { n:43,en:"Az-Zukhruf",ar:"الزخرف",ayahs:89 },{ n:44,en:"Ad-Dukhan",ar:"الدخان",ayahs:59 },
  { n:45,en:"Al-Jathiya",ar:"الجاثية",ayahs:37 },{ n:46,en:"Al-Ahqaf",ar:"الأحقاف",ayahs:35 },
  { n:47,en:"Muhammad",ar:"محمد",ayahs:38 },{ n:48,en:"Al-Fath",ar:"الفتح",ayahs:29 },
  { n:49,en:"Al-Hujurat",ar:"الحجرات",ayahs:18 },{ n:50,en:"Qaf",ar:"ق",ayahs:45 },
  { n:51,en:"Adh-Dhariyat",ar:"الذاريات",ayahs:60 },{ n:52,en:"At-Tur",ar:"الطور",ayahs:49 },
  { n:53,en:"An-Najm",ar:"النجم",ayahs:62 },{ n:54,en:"Al-Qamar",ar:"القمر",ayahs:55 },
  { n:55,en:"Ar-Rahman",ar:"الرحمن",ayahs:78 },{ n:56,en:"Al-Waqi'a",ar:"الواقعة",ayahs:96 },
  { n:57,en:"Al-Hadid",ar:"الحديد",ayahs:29 },{ n:58,en:"Al-Mujadila",ar:"المجادلة",ayahs:22 },
  { n:59,en:"Al-Hashr",ar:"الحشر",ayahs:24 },{ n:60,en:"Al-Mumtahana",ar:"الممتحنة",ayahs:13 },
  { n:61,en:"As-Saf",ar:"الصف",ayahs:14 },{ n:62,en:"Al-Jumu'a",ar:"الجمعة",ayahs:11 },
  { n:63,en:"Al-Munafiqun",ar:"المنافقون",ayahs:11 },{ n:64,en:"At-Taghabun",ar:"التغابن",ayahs:18 },
  { n:65,en:"At-Talaq",ar:"الطلاق",ayahs:12 },{ n:66,en:"At-Tahrim",ar:"التحريم",ayahs:12 },
  { n:67,en:"Al-Mulk",ar:"الملك",ayahs:30 },{ n:68,en:"Al-Qalam",ar:"القلم",ayahs:52 },
  { n:69,en:"Al-Haqqah",ar:"الحاقة",ayahs:52 },{ n:70,en:"Al-Ma'arij",ar:"المعارج",ayahs:44 },
  { n:71,en:"Nuh",ar:"نوح",ayahs:28 },{ n:72,en:"Al-Jinn",ar:"الجن",ayahs:28 },
  { n:73,en:"Al-Muzzammil",ar:"المزمل",ayahs:20 },{ n:74,en:"Al-Muddaththir",ar:"المدثر",ayahs:56 },
  { n:75,en:"Al-Qiyama",ar:"القيامة",ayahs:40 },{ n:76,en:"Al-Insan",ar:"الإنسان",ayahs:31 },
  { n:77,en:"Al-Mursalat",ar:"المرسلات",ayahs:50 },{ n:78,en:"An-Naba",ar:"النبأ",ayahs:40 },
  { n:79,en:"An-Nazi'at",ar:"النازعات",ayahs:46 },{ n:80,en:"Abasa",ar:"عبس",ayahs:42 },
  { n:81,en:"At-Takwir",ar:"التكوير",ayahs:29 },{ n:82,en:"Al-Infitar",ar:"الانفطار",ayahs:19 },
  { n:83,en:"Al-Mutaffifin",ar:"المطففين",ayahs:36 },{ n:84,en:"Al-Inshiqaq",ar:"الانشقاق",ayahs:25 },
  { n:85,en:"Al-Buruj",ar:"البروج",ayahs:22 },{ n:86,en:"At-Tariq",ar:"الطارق",ayahs:17 },
  { n:87,en:"Al-A'la",ar:"الأعلى",ayahs:19 },{ n:88,en:"Al-Ghashiya",ar:"الغاشية",ayahs:26 },
  { n:89,en:"Al-Fajr",ar:"الفجر",ayahs:30 },{ n:90,en:"Al-Balad",ar:"البلد",ayahs:20 },
  { n:91,en:"Ash-Shams",ar:"الشمس",ayahs:15 },{ n:92,en:"Al-Layl",ar:"الليل",ayahs:21 },
  { n:93,en:"Ad-Duha",ar:"الضحى",ayahs:11 },{ n:94,en:"Ash-Sharh",ar:"الشرح",ayahs:8 },
  { n:95,en:"At-Tin",ar:"التين",ayahs:8 },{ n:96,en:"Al-'Alaq",ar:"العلق",ayahs:19 },
  { n:97,en:"Al-Qadr",ar:"القدر",ayahs:5 },{ n:98,en:"Al-Bayyina",ar:"البينة",ayahs:8 },
  { n:99,en:"Az-Zalzala",ar:"الزلزلة",ayahs:8 },{ n:100,en:"Al-'Adiyat",ar:"العاديات",ayahs:11 },
  { n:101,en:"Al-Qari'a",ar:"القارعة",ayahs:11 },{ n:102,en:"At-Takathur",ar:"التكاثر",ayahs:8 },
  { n:103,en:"Al-'Asr",ar:"العصر",ayahs:3 },{ n:104,en:"Al-Humaza",ar:"الهمزة",ayahs:9 },
  { n:105,en:"Al-Fil",ar:"الفيل",ayahs:5 },{ n:106,en:"Quraysh",ar:"قريش",ayahs:4 },
  { n:107,en:"Al-Ma'un",ar:"الماعون",ayahs:7 },{ n:108,en:"Al-Kawthar",ar:"الكوثر",ayahs:3 },
  { n:109,en:"Al-Kafirun",ar:"الكافرون",ayahs:6 },{ n:110,en:"An-Nasr",ar:"النصر",ayahs:3 },
  { n:111,en:"Al-Masad",ar:"المسد",ayahs:5 },{ n:112,en:"Al-Ikhlas",ar:"الإخلاص",ayahs:4 },
  { n:113,en:"Al-Falaq",ar:"الفلق",ayahs:5 },{ n:114,en:"An-Nas",ar:"الناس",ayahs:6 },
];

function stripBasmala(text: string): string {
  // quran-uthmani always prepends Basmala (4 words) to ayah 1 of every surah.
  // Drop the first 4 whitespace-separated tokens unconditionally.
  const words = text.trim().split(/\s+/);
  return words.slice(4).join(" ");
}

function readPlanStore(): StudyPlanStore {
  try {
    const raw = localStorage.getItem(STUDY_PLAN_KEY);
    if (!raw) return { activePlanId: null, plans: [] };
    const parsed = JSON.parse(raw) as StudyPlanStore | StudyPlan;

    if (parsed && typeof parsed === "object" && "plans" in parsed) {
      const store = parsed as StudyPlanStore;
      return {
        activePlanId: store.activePlanId ?? store.plans?.[0]?.id ?? null,
        plans: Array.isArray(store.plans) ? store.plans : [],
      };
    }

    const legacy = parsed as StudyPlan;
    const migrated: StudyPlan = {
      ...legacy,
      id: `plan_${legacy.type}_${legacy.startSurah ?? legacy.currentSurah}_${legacy.startAyah ?? legacy.currentAyah}`,
    };
    return { activePlanId: migrated.id, plans: [migrated] };
  } catch { return { activePlanId: null, plans: [] }; }
}

function savePlanStore(store: StudyPlanStore) {
  try { localStorage.setItem(STUDY_PLAN_KEY, JSON.stringify(store)); } catch {}
}

async function fetchAyah(surahNumber: number, ayahNumber: number): Promise<AyahData | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? anonKey;
    const headers = { Authorization: `Bearer ${token}`, apikey: anonKey };
    const buildUrl = (edition: string) => {
      const u = new URL(`${supabaseUrl}/functions/v1/deen-quran-proxy`);
      u.searchParams.set("path", `surah/${surahNumber}`);
      u.searchParams.set("edition", edition);
      return u.toString();
    };
    const [arRes, enRes, auRes] = await Promise.all([
      fetch(buildUrl("quran-uthmani"), { headers }),
      fetch(buildUrl("en.sahih"), { headers }),
      fetch(buildUrl("ar.alafasy"), { headers }),
    ]);
    const arJson = await arRes.json();
    const enJson = await enRes.json();
    const auJson = await auRes.json();
    const arAyahs: { numberInSurah: number; text: string }[] = arJson?.data?.ayahs ?? [];
    const enAyahs: { numberInSurah: number; text: string }[] = enJson?.data?.ayahs ?? [];
    const auAyahs: { numberInSurah: number; audio: string }[] = auJson?.data?.ayahs ?? [];
    const arAyah = arAyahs.find((a) => a.numberInSurah === ayahNumber);
    const enAyah = enAyahs.find((a) => a.numberInSurah === ayahNumber);
    const auAyah = auAyahs.find((a) => a.numberInSurah === ayahNumber);
    if (!arAyah?.text) return null;
    return { surah_number: surahNumber, ayah_number: ayahNumber, arabic: arAyah.text, translation: enAyah?.text ?? "", audioUrl: auAyah?.audio ?? "" };
  } catch { return null; }
}

export default function DeenStudy() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const dark = theme === "dark";
  const bg      = dark ? "#0c0f14" : "#fcfefd";
  const hdrBg   = dark ? "rgba(12,15,20,0.95)" : "rgba(252,254,253,0.97)";
  const surface = dark ? "rgba(255,255,255,0.04)" : "rgba(6,5,65,0.04)";
  const bdr     = dark ? "rgba(255,255,255,0.07)" : "rgba(6,5,65,0.09)";
  const textPri = dark ? "#f2f2f2" : "#060541";
  const textSec = dark ? "#858384" : "#606062";
  const accentText = dark ? "hsl(25,95%,60%)" : "#c2410c";
  const accentBg = dark ? "hsla(25,95%,60%,0.12)" : "hsla(25,85%,45%,0.14)";
  const accentBorder = dark ? "hsla(25,95%,60%,0.24)" : "hsla(25,85%,45%,0.28)";

  const [activeTab, setActiveTab] = useState<StudyTab>("today");
  const [planStore, setPlanStore] = useState<StudyPlanStore>(() => readPlanStore());
  const [memorization, setMemorization] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionAyah, setSessionAyah] = useState<AyahData | null>(null);
  const [playerMode, setPlayerMode] = useState<"learn" | "review">("learn");
  const [fetchingAyah, setFetchingAyah] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("needs_revision");
  const plan = planStore.plans.find((p) => p.id === planStore.activePlanId) ?? planStore.plans[0] ?? null;

  const reloadMemorization = useCallback(() => {
    setLoading(true);
    (supabase as any)
      .from("deen_memorization")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }: any) => { setMemorization(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (activeTab === "today" || activeTab === "review") reloadMemorization();
  }, [activeTab, reloadMemorization]);

  const updateMemorizationStatus = useCallback(async (id: string, status: string) => {
    await (supabase as any).from("deen_memorization").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setMemorization((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  }, []);

  const upsertMemorization = useCallback(async (surahNum: number, ayahNum: number, status: string) => {
    const { data: sd } = await supabase.auth.getSession();
    const uid = sd.session?.user?.id;
    if (!uid) return;
    await (supabase as any).from("deen_memorization").upsert(
      { user_id: uid, surah_number: surahNum, ayah_number: ayahNum, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,surah_number,ayah_number" }
    );
  }, []);

  const openLearnSession = async (surahNum: number, ayahNum: number) => {
    setFetchingAyah(true);
    const data = await fetchAyah(surahNum, ayahNum);
    setFetchingAyah(false);
    if (!data) { toast.error(isAr ? "تعذر تحميل الآية" : "Could not load ayah"); return; }
    setSessionAyah(data);
    setPlayerMode("learn");
  };

  const openReviewSession = async (item: any) => {
    setFetchingAyah(true);
    const data = await fetchAyah(item.surah_number, item.ayah_number);
    setFetchingAyah(false);
    if (!data) { toast.error(isAr ? "تعذر تحميل الآية" : "Could not load ayah"); return; }
    setSessionAyah(data);
    setPlayerMode("review");
  };

  const onPlayerComplete = useCallback(async (result: "memorized" | "learning" | "needs_revision") => {
    if (!sessionAyah) return;
    await upsertMemorization(sessionAyah.surah_number, sessionAyah.ayah_number, result);
    if (result !== "needs_revision" && plan && playerMode === "learn") {
      const updated: StudyPlan = { ...plan, currentSurah: sessionAyah.surah_number, currentAyah: sessionAyah.ayah_number + 1 };
      setPlanStore((prev) => {
        const next: StudyPlanStore = {
          ...prev,
          plans: prev.plans.map((p) => p.id === updated.id ? updated : p),
        };
        savePlanStore(next);
        return next;
      });
    }
    setSessionAyah(null);
    reloadMemorization();
    toast.success(isAr ? "أحسنت 🌟" : "Well done 🌟");
  }, [sessionAyah, plan, playerMode, upsertMemorization, reloadMemorization, isAr]);

  const activatePlan = (type: PlanType, dailyGoal: number, startSurah: number, startAyah: number) => {
    const newPlan: StudyPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      dailyGoal,
      currentSurah: startSurah,
      currentAyah: startAyah,
      startSurah,
      startAyah,
    };
    setPlanStore((prev) => {
      const next: StudyPlanStore = {
        activePlanId: newPlan.id,
        plans: [newPlan, ...prev.plans],
      };
      savePlanStore(next);
      return next;
    });
    setActiveTab("today");
    toast.success(isAr ? "تم حفظ الخطة ✓" : "Plan saved ✓");
  };

  const setActivePlan = (planId: string) => {
    setPlanStore((prev) => {
      const next = { ...prev, activePlanId: planId };
      savePlanStore(next);
      return next;
    });
  };

  const deletePlan = (planId: string) => {
    setPlanStore((prev) => {
      const remaining = prev.plans.filter((p) => p.id !== planId);
      const next: StudyPlanStore = {
        activePlanId: prev.activePlanId === planId ? (remaining[0]?.id ?? null) : prev.activePlanId,
        plans: remaining,
      };
      savePlanStore(next);
      return next;
    });
    toast.success(isAr ? "تم حذف الخطة" : "Plan deleted");
  };

  const reviewItems = memorization.filter((m) => m.status === "needs_revision");
  const learningItems = memorization.filter((m) => m.status === "learning");
  const memorizedCount = memorization.filter((m) => m.status === "memorized").length;

  const tabs: { id: StudyTab; labelEn: string; labelAr: string }[] = [
    { id: "today", labelEn: "Today", labelAr: "اليوم" },
    { id: "review", labelEn: "Review", labelAr: "المراجعة" },
    { id: "plans", labelEn: "Plans", labelAr: "الخطط" },
  ];

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: bg }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Session Player overlay */}
      {sessionAyah && (
        <SessionPlayer
          ayah={sessionAyah}
          mode={playerMode}
          isAr={isAr}
          onComplete={onPlayerComplete}
          onClose={() => setSessionAyah(null)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: hdrBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${bdr}` }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/deen")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: surface, border: `1px solid ${bdr}` }}
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: textPri, transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <h1 className="text-base font-bold" style={{ color: textPri }}>{isAr ? "الدراسة" : "Study"}</h1>
          {plan && (
            <div className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }}>
              {plan.type === "juzamma" ? (isAr ? "جزء عمّ" : "Juz Amma") : plan.type === "beginner" ? (isAr ? "مبتدئ" : "Beginner") : (isAr ? "مخصص" : "Custom")}
            </div>
          )}
        </div>
        <div className="flex rounded-xl p-1 gap-1" style={{ background: surface, border: `1px solid ${bdr}` }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
              style={activeTab === tab.id
                ? { background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }
                : { color: textSec }}>
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        {/* ── TODAY TAB ── */}
        {activeTab === "today" && (
          <div className="flex flex-col gap-3">
            {!plan ? (
              <NoPlanState isAr={isAr} dark={dark} onSetupPlan={() => setActiveTab("plans")} />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard value={learningItems.length} label={isAr ? "تتعلمه" : "Learning"} color="#60a5fa" bg="hsla(210,100%,65%,0.08)" dark={dark} onClick={() => { setReviewFilter("learning"); setActiveTab("review"); }} />
                  <StatCard value={reviewItems.length} label={isAr ? "للمراجعة" : "Review due"} color="#f97316" bg="hsla(25,95%,60%,0.08)" dark={dark} onClick={() => { setReviewFilter("needs_revision"); setActiveTab("review"); }} />
                  <StatCard value={memorizedCount} label={isAr ? "ثابت" : "Strong"} color="#4ade80" bg="hsla(142,76%,55%,0.08)" dark={dark} onClick={() => { setReviewFilter("memorized"); setActiveTab("review"); }} />
                </div>

                <button
                  onClick={() => openLearnSession(plan.currentSurah, plan.currentAyah)}
                  disabled={fetchingAyah}
                  className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all disabled:opacity-60"
                  style={{ background: dark ? "hsla(25,95%,60%,0.10)" : "hsla(25,85%,45%,0.14)", border: "1px solid hsla(25,95%,60%,0.28)" }}
                  dir={isAr ? "rtl" : "ltr"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.18)", border: "1px solid hsla(25,95%,60%,0.30)" }}>
                        {fetchingAyah
                          ? <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: dark ? "rgba(249,115,22,0.35)" : "rgba(194,65,12,0.35)", borderTopColor: accentText }} />
                          : <Play className="w-5 h-5" style={{ color: accentText }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: textPri }}>{isAr ? "ابدأ جلسة اليوم" : "Start today's session"}</p>
                        <p className="text-xs mt-0.5" style={{ color: accentText }}>
                          {isAr ? "سورة" : "Surah"} {plan.currentSurah} — {isAr ? "آية" : "Ayah"} {plan.currentAyah}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: accentText, transform: isAr ? "rotate(180deg)" : undefined }} />
                  </div>
                </button>

                {reviewItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold" style={{ color: textPri }}>{isAr ? "تحتاج مراجعة" : "Due for review"}</p>
                      <button onClick={() => setActiveTab("review")} className="text-[11px] font-semibold" style={{ color: accentText }}>
                        {isAr ? "عرض الكل" : "See all"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {reviewItems.slice(0, 2).map((m) => (
                        <MemorizationRow key={m.id} item={m} isAr={isAr} dark={dark}
                          onUpdate={updateMemorizationStatus}
                          onTap={() => openReviewSession(m)}
                          emphasizeReview />
                      ))}
                    </div>
                  </div>
                )}

                {learningItems.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2" style={{ color: textPri }}>{isAr ? "تتعلمه الآن" : "Learning now"}</p>
                    <div className="flex flex-col gap-2">
                      {learningItems.slice(0, 3).map((m) => (
                        <MemorizationRow key={m.id} item={m} isAr={isAr} dark={dark}
                          onUpdate={updateMemorizationStatus}
                          onTap={() => openReviewSession(m)} />
                      ))}
                    </div>
                  </div>
                )}

                {memorizedCount > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2" style={{ color: textPri }}>{isAr ? "المحفوظ بقوة" : "Strong now"}</p>
                    <div className="flex flex-col gap-2">
                      {memorization.filter((m) => m.status === "memorized").slice(0, 3).map((m) => (
                        <MemorizationRow key={m.id} item={m} isAr={isAr} dark={dark}
                          onUpdate={updateMemorizationStatus}
                          onTap={() => openReviewSession(m)} />
                      ))}
                    </div>
                  </div>
                )}

                {loading && <Loader />}
              </>
            )}
          </div>
        )}

        {/* ── REVIEW TAB ── */}
        {activeTab === "review" && (
          <div className="flex flex-col gap-2">
            <div className="flex rounded-xl p-1 gap-1 mb-2" style={{ background: surface, border: `1px solid ${bdr}` }}>
              {([
                { id: "needs_revision", ar: "للمراجعة", en: "Review due" },
                { id: "learning", ar: "تتعلمه", en: "Learning" },
                { id: "memorized", ar: "ثابت", en: "Strong" },
              ] as { id: ReviewFilter; ar: string; en: string }[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setReviewFilter(item.id)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                  style={reviewFilter === item.id
                    ? { background: accentBg, color: accentText, border: `1px solid ${accentBorder}` }
                    : { color: textSec }}
                >
                  {isAr ? item.ar : item.en}
                </button>
              ))}
            </div>
            {loading ? <Loader /> : (reviewFilter === "needs_revision" ? reviewItems : reviewFilter === "learning" ? learningItems : memorization.filter((m) => m.status === "memorized")).length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: surface, border: `1px solid ${bdr}` }}>
                  <RotateCcw className="w-7 h-7" style={{ color: textSec }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: textPri }}>
                  {reviewFilter === "needs_revision"
                    ? (isAr ? "لا شيء للمراجعة" : "Nothing to review")
                    : reviewFilter === "learning"
                      ? (isAr ? "لا يوجد قيد التعلّم" : "Nothing in learning")
                      : (isAr ? "لا يوجد محفوظ حتى الآن" : "Nothing strong yet")}
                </p>
                <p className="text-xs max-w-[220px] leading-relaxed" style={{ color: textSec }}>
                  {reviewFilter === "needs_revision"
                    ? (isAr ? "حين تحفظ آيات ستظهر هنا للمراجعة الدورية." : "Once you memorize ayahs they will appear here for periodic revision.")
                    : reviewFilter === "learning"
                      ? (isAr ? "الآيات التي ما زلت تتعلمها ستظهر هنا." : "Ayahs you are still learning will appear here.")
                      : (isAr ? "الآيات التي أتقنتها ستظهر هنا." : "Ayahs you have mastered will appear here.")}
                </p>
              </div>
            ) : (
              (reviewFilter === "needs_revision" ? reviewItems : reviewFilter === "learning" ? learningItems : memorization.filter((m) => m.status === "memorized")).map((m) => (
                <MemorizationRow key={m.id} item={m} isAr={isAr} dark={dark}
                  onUpdate={updateMemorizationStatus}
                  onTap={() => openReviewSession(m)}
                  emphasizeReview={reviewFilter === "needs_revision"} />
              ))
            )}
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === "plans" && (
          <PlansSetup isAr={isAr} dark={dark} activePlan={plan} savedPlans={planStore.plans} onActivate={activatePlan} onSetActive={setActivePlan} onDeletePlan={deletePlan} />
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label, color, bg, dark, onClick }: { value: number; label: string; color: string; bg: string; dark: boolean; onClick?: () => void }) {
  const textSec = dark ? "#858384" : "#606062";
  return (
    <button className="rounded-xl p-3 text-center active:scale-95 transition-all" style={{ background: bg, border: `1px solid ${color}33` }} onClick={onClick}>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[9px] font-semibold mt-0.5" style={{ color: textSec }}>{label}</p>
    </button>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(249,115,22,0.35)", borderTopColor: "#f97316" }} />
    </div>
  );
}

function MemorizationRow({ item: m, isAr, dark, onUpdate, onTap, emphasizeReview = false }: {
  item: any; isAr: boolean; dark: boolean;
  onUpdate: (id: string, status: string) => Promise<void>;
  onTap?: () => void;
  emphasizeReview?: boolean;
}) {
  const isMemorized = m.status === "memorized";
  const isReview = m.status === "needs_revision";
  const textPri = dark ? "#f2f2f2" : "#060541";
  const textSec = dark ? "#858384" : "#606062";
  const rowBg  = emphasizeReview
    ? (dark ? "hsla(25,95%,60%,0.10)" : "hsla(25,85%,45%,0.12)")
    : dark ? "rgba(255,255,255,0.03)" : "rgba(6,5,65,0.03)";
  const rowBdr = emphasizeReview
    ? (dark ? "hsla(25,95%,60%,0.25)" : "hsla(25,85%,45%,0.24)")
    : dark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.08)";
  return (
    <div
      className="rounded-xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-all cursor-pointer"
      style={{ background: rowBg, border: `1px solid ${rowBdr}` }}
      onClick={onTap}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{
          background: isMemorized ? "hsla(142,76%,55%,0.12)" : isReview ? "hsla(25,95%,60%,0.12)" : "hsla(210,100%,65%,0.12)",
          color: isMemorized ? "#4ade80" : isReview ? (dark ? "#f97316" : "#c2410c") : "#60a5fa",
          border: `1px solid ${isMemorized ? "hsla(142,76%,55%,0.25)" : isReview ? "hsla(25,95%,60%,0.22)" : "hsla(210,100%,65%,0.25)"}`,
        }}>
        {m.surah_number}:{m.ayah_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: textPri }}>
          {isAr ? "سورة" : "Surah"} {m.surah_number} — {isAr ? "آية" : "Ayah"} {m.ayah_number}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: textSec }}>
          {isMemorized ? (isAr ? "✅ ثابت" : "✅ Strong") : isReview ? (isAr ? "🔄 راجع اليوم" : "🔄 Review today") : (isAr ? "📖 تتعلمها" : "📖 Learning")}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: textSec, transform: isAr ? "rotate(180deg)" : undefined }} />
    </div>
  );
}

function NoPlanState({ isAr, dark, onSetupPlan }: { isAr: boolean; dark: boolean; onSetupPlan: () => void }) {
  const textPri = dark ? "#f2f2f2" : "#060541";
  const textSec = dark ? "#858384" : "#606062";
  return (
    <div className="flex flex-col items-center py-14 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: dark ? "hsla(25,95%,60%,0.08)" : "hsla(25,85%,45%,0.12)", border: "1px solid hsla(25,95%,60%,0.22)" }}>
        <Target className="w-8 h-8" style={{ color: dark ? "#f97316" : "#c2410c" }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: textPri }}>{isAr ? "اختر خطة للبداية" : "Choose a plan to begin"}</p>
        <p className="text-xs mt-1.5 max-w-[230px] mx-auto leading-relaxed" style={{ color: textSec }}>
          {isAr
            ? "اختر مساراً مناسباً وسنوجهك آية بآية حتى تحفظ بثبات."
            : "Pick a path and we will guide you ayah by ayah to build a consistent memorization habit."}
        </p>
      </div>
      <button
        onClick={onSetupPlan}
        className="px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
        style={{ background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: dark ? "#f97316" : "#c2410c", border: "1px solid hsla(25,95%,60%,0.30)" }}
      >
        {isAr ? "اختر خطتك" : "Choose your plan"}
      </button>
    </div>
  );
}

function PlansSetup({ isAr, dark, activePlan, savedPlans, onActivate, onSetActive, onDeletePlan }: {
  isAr: boolean;
  dark: boolean;
  activePlan: StudyPlan | null;
  savedPlans: StudyPlan[];
  onActivate: (type: PlanType, dailyGoal: number, startSurah: number, startAyah: number) => void;
  onSetActive: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
}) {
  const accentText = dark ? "hsl(25,95%,60%)" : "#c2410c";
  const textPri   = dark ? "#f2f2f2" : "#060541";
  const textSec   = dark ? "#858384" : "#606062";
  const surfBg    = dark ? "rgba(255,255,255,0.04)" : "rgba(6,5,65,0.04)";
  const surfBdr   = dark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.10)";
  const inputBg   = dark ? "rgba(255,255,255,0.06)" : "rgba(6,5,65,0.05)";
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [selectedType, setSelectedType] = useState<PlanType | null>(activePlan?.type ?? null);
  const [dailyGoal, setDailyGoal] = useState(activePlan?.dailyGoal ?? 1);
  const [surahSearch, setSurahSearch] = useState("");
  const [pickedSurah, setPickedSurah] = useState<typeof SURAH_LIST[0] | null>(
    activePlan?.startSurah ? (SURAH_LIST.find((s) => s.n === activePlan.startSurah) ?? null) : null
  );
  const [ayahMode, setAyahMode] = useState<"beginning" | "custom">("beginning");
  const [customAyah, setCustomAyah] = useState(activePlan?.startAyah ?? 1);

  const filteredSurahs = surahSearch.trim()
    ? SURAH_LIST.filter((s) =>
        s.en.toLowerCase().includes(surahSearch.toLowerCase()) ||
        s.ar.includes(surahSearch) ||
        String(s.n).includes(surahSearch)
      )
    : SURAH_LIST;

  const plans: { type: PlanType; icon: React.ElementType; titleEn: string; titleAr: string; descEn: string; descAr: string; glow: string }[] = [
    { type: "beginner", icon: BookOpen, titleEn: "Beginner Essentials", titleAr: "أساسيات المبتدئ", descEn: "Start from Al-Fatiha (Surah 1, Ayah 1)", descAr: "ابدأ من سورة الفاتحة", glow: "hsla(210,100%,65%" },
    { type: "juzamma", icon: Brain, titleEn: "Juz Amma Journey", titleAr: "رحلة جزء عمّ", descEn: "Start from An-Naba (Surah 78, Ayah 1)", descAr: "ابدأ من سورة النبأ (78)", glow: "hsla(142,76%,55%" },
    { type: "custom", icon: Bookmark, titleEn: "Custom Plan", titleAr: "خطة مخصصة", descEn: "Pick any surah and ayah to start from", descAr: "اختر أي سورة وآية تبدأ منها", glow: "hsla(25,95%,60%" },
  ];

  const resolvedAyah = ayahMode === "beginning" ? 1 : customAyah;
  const canStart = selectedType === "custom" ? !!pickedSurah : !!selectedType;

  useEffect(() => {
    setSelectedType(activePlan?.type ?? null);
    setDailyGoal(activePlan?.dailyGoal ?? 1);
    setPickedSurah(activePlan?.startSurah ? (SURAH_LIST.find((s) => s.n === activePlan.startSurah) ?? null) : null);
    setCustomAyah(activePlan?.startAyah ?? 1);
    setAyahMode((activePlan?.startAyah ?? 1) > 1 ? "custom" : "beginning");
    setShowCustomEditor(false);
  }, [activePlan]);

  const handleStart = () => {
    if (!selectedType) return;
    if (selectedType === "custom") {
      if (!pickedSurah) return;
      onActivate(selectedType, dailyGoal, pickedSurah.n, resolvedAyah);
    } else {
      const defaults: Record<PlanType, { surah: number; ayah: number }> = {
        beginner: { surah: 1, ayah: 1 },
        juzamma: { surah: 78, ayah: 1 },
        custom: { surah: 1, ayah: 1 },
      };
      onActivate(selectedType, dailyGoal, defaults[selectedType].surah, defaults[selectedType].ayah);
    }
  };

  return (
    <div className="flex flex-col gap-4" dir={isAr ? "rtl" : "ltr"}>
      {savedPlans.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold" style={{ color: textSec }}>{isAr ? "خططك المحفوظة" : "Your saved plans"}</p>
          {savedPlans.map((p) => {
            const isActive = activePlan?.id === p.id;
            return (
              <div
                key={p.id}
                className="w-full flex items-center justify-between gap-3 rounded-xl p-3 text-left active:scale-[0.99] transition-all"
                style={{
                  background: isActive ? (dark ? "hsla(25,95%,60%,0.10)" : "hsla(25,85%,45%,0.12)") : surfBg,
                  border: `1px solid ${isActive ? (dark ? "hsla(25,95%,60%,0.28)" : "hsla(25,85%,45%,0.24)") : surfBdr}`,
                }}
                dir={isAr ? "rtl" : "ltr"}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: textPri }}>
                    {p.type === "juzamma" ? (isAr ? "جزء عمّ" : "Juz Amma") : p.type === "beginner" ? (isAr ? "مبتدئ" : "Beginner") : (isAr ? "مخصص" : "Custom")}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: textSec }}>
                    {isAr ? `سورة ${p.currentSurah} — آية ${p.currentAyah}` : `Surah ${p.currentSurah} — Ayah ${p.currentAyah}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onDeletePlan(p.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                    style={{ background: dark ? "hsla(0,80%,60%,0.10)" : "hsla(0,80%,60%,0.08)", color: "#ef4444", border: "1px solid hsla(0,80%,60%,0.18)" }}
                    aria-label={isAr ? "حذف الخطة" : "Delete plan"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSetActive(p.id)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold active:scale-95 transition-all"
                    style={{ background: isActive ? (dark ? "hsla(142,76%,55%,0.14)" : "hsla(142,76%,45%,0.12)") : surfBg, color: isActive ? "#22c55e" : textSec, border: `1px solid ${isActive ? "hsla(142,76%,55%,0.28)" : surfBdr}` }}
                  >
                    {isActive ? (isAr ? "نشطة" : "Active") : (isAr ? "استخدمها" : "Use")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs font-semibold" style={{ color: textSec }}>{isAr ? "اختر مسار الحفظ" : "Choose your memorization path"}</p>
      <div className="flex flex-col gap-3">
        {plans.map(({ type, icon: Icon, titleEn, titleAr, descEn, descAr, glow }) => {
          const active = selectedType === type;
          return (
            <button key={type} onClick={() => {
              setSelectedType(type);
              setShowCustomEditor(type === "custom" ? !showCustomEditor || selectedType !== "custom" : false);
            }}
              className="w-full flex items-center gap-3 rounded-xl p-4 text-left active:scale-[0.99] transition-all"
              style={{
                background: active ? `${glow},0.10)` : `${glow},0.03)`,
                border: `1px solid ${active ? `${glow},0.30)` : `${glow},0.10)`}`,
              }}
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: type === "custom" ? (active ? (dark ? "hsla(25,95%,60%,0.18)" : "hsla(25,85%,45%,0.14)") : surfBg) : `${glow},${active ? "0.18)" : "0.08)"}` }}>
                <Icon className="w-5 h-5" style={{ color: type === "custom" ? accentText : active ? "#f2f2f2" : "#858384" }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: active ? textPri : textSec }}>{isAr ? titleAr : titleEn}</p>
                <p className="text-[11px] mt-0.5" style={{ color: textSec }}>{isAr ? descAr : descEn}</p>
              </div>
              {active && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* ── Custom Plan: surah picker + ayah choice ── */}
      {selectedType === "custom" && showCustomEditor && (
        <div className="rounded-xl flex flex-col gap-3" style={{ background: dark ? "hsla(25,95%,60%,0.06)" : "hsla(25,85%,45%,0.08)", border: "1px solid hsla(25,95%,60%,0.22)" }}>
          {/* Step 1: pick surah */}
          <div className="p-3.5 pb-0">
            <p className="text-xs font-semibold mb-2" style={{ color: textSec }}>
              {isAr ? "1. اختر السورة" : "1. Choose a surah"}
            </p>
            {/* Search box */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
              style={{ background: inputBg, border: `1px solid ${surfBdr}` }}>
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: textSec }} />
              <input
                type="text"
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                placeholder={isAr ? "ابحث عن سورة…" : "Search surah…"}
                aria-label={isAr ? "بحث السورة" : "Search surah"}
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: textPri }}
              />
              {surahSearch && (
                <button onClick={() => setSurahSearch("")} aria-label="Clear search" className="flex-shrink-0 text-[#606062] hover:text-[#858384]">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Surah list */}
            <div className="overflow-y-auto rounded-xl" style={{ maxHeight: "180px" }}>
              {filteredSurahs.map((s) => {
                const picked = pickedSurah?.n === s.n;
                return (
                  <button key={s.n} onClick={() => { setPickedSurah(s); setCustomAyah(1); setAyahMode("beginning"); setSurahSearch(""); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left active:scale-[0.99] transition-all"
                    style={{ background: picked ? (dark ? "hsla(25,95%,60%,0.12)" : "hsla(25,85%,45%,0.12)") : "transparent" }}
                    dir={isAr ? "rtl" : "ltr"}
                  >
                    <span className="text-[10px] font-bold w-6 text-center flex-shrink-0"
                      style={{ color: picked ? accentText : textSec }}>{s.n}</span>
                    <span className="flex-1 text-xs font-semibold truncate"
                      style={{ color: picked ? textPri : textSec }}>
                      {isAr ? s.ar : s.en}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: picked ? accentText : textSec }}>
                      {s.ayahs} {isAr ? "آية" : "ayahs"}
                    </span>
                    {picked && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentText }} />}
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <p className="text-center text-xs py-4" style={{ color: textSec }}>{isAr ? "لا نتائج" : "No results"}</p>
              )}
            </div>
          </div>

          {/* Step 2: ayah choice — only visible after surah picked */}
          {pickedSurah && (
            <div className="px-3.5 pb-3.5 flex flex-col gap-2 border-t" style={{ borderColor: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.18)" }}>
              <p className="text-xs font-semibold pt-3" style={{ color: textSec }}>
                {isAr ? "2. ابدأ من" : "2. Start from"}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setAyahMode("beginning")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  style={ayahMode === "beginning"
                    ? { background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }
                    : { background: surfBg, color: textSec, border: `1px solid ${surfBdr}` }}>
                  {isAr ? "البداية (آية 1)" : "Beginning (Ayah 1)"}
                </button>
                <button onClick={() => setAyahMode("custom")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  style={ayahMode === "custom"
                    ? { background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }
                    : { background: surfBg, color: textSec, border: `1px solid ${surfBdr}` }}>
                  {isAr ? "آية محددة" : "Custom ayah"}
                </button>
              </div>
              {ayahMode === "custom" && (
                <input
                  type="number"
                  min={1} max={pickedSurah.ayahs}
                  value={customAyah}
                  aria-label={isAr ? "رقم الآية" : "Ayah number"}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= pickedSurah.ayahs) setCustomAyah(v);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-sm font-bold text-center outline-none"
                  style={{ background: inputBg, color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }}
                  placeholder={`1 – ${pickedSurah.ayahs}`}
                />
              )}
              <p className="text-[10px]" style={{ color: accentText }}>
                {isAr
                  ? `ستبدأ من ${pickedSurah.ar} — آية ${resolvedAyah}`
                  : `Starting from ${pickedSurah.en}, Ayah ${resolvedAyah}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Daily goal */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: textSec }}>{isAr ? "كم آية يومياً؟" : "How many ayahs per day?"}</p>
        <div className="flex gap-2">
          {[1, 3, 5].map((n) => (
            <button key={n} onClick={() => setDailyGoal(n)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
              style={dailyGoal === n
                ? { background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }
                : { background: surfBg, color: textSec, border: `1px solid ${surfBdr}` }}>
              {n}
            </button>
          ))}
          <input
            type="number" min={1} max={50}
            value={![1, 3, 5].includes(dailyGoal) ? dailyGoal : ""}
            placeholder={isAr ? "عدد" : "Other"}
            aria-label={isAr ? "عدد مخصص" : "Custom daily goal"}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 50) setDailyGoal(v);
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-all outline-none"
            style={
              ![1, 3, 5].includes(dailyGoal)
                ? { background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }
                : { background: surfBg, color: textSec, border: `1px solid ${surfBdr}` }
            }
          />
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: textSec }}>
          {isAr ? `الهدف: ${dailyGoal} آية يومياً` : `Goal: ${dailyGoal} ayah${dailyGoal !== 1 ? "s" : ""} / day`}
        </p>
      </div>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
        style={{ background: dark ? "hsla(25,95%,60%,0.15)" : "hsla(25,85%,45%,0.14)", color: accentText, border: "1px solid hsla(25,95%,60%,0.28)" }}
      >
        {isAr ? "احفظ هذه الخطة" : "Save this plan"}
      </button>
    </div>
  );
}

function SessionPlayer({ ayah, mode, isAr, onComplete, onClose }: {
  ayah: AyahData;
  mode: "learn" | "review";
  isAr: boolean;
  onComplete: (result: "memorized" | "learning" | "needs_revision") => Promise<void>;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [phase, setPhase] = useState<"listen" | "recall">("listen");
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [targetLoops, setTargetLoops] = useState(3);
  const targetLoopsRef = useRef(3);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completing, setCompleting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const surahInfo = SURAH_LIST.find((s) => s.n === ayah.surah_number);
  const audioUrl = ayah.audioUrl ?? "";

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setLoopCount((c) => {
        const next = c + 1;
        if (next < targetLoopsRef.current) {
          setTimeout(() => {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            setPlaying(true);
          }, 700);
        } else {
          setPhase("recall");
        }
        return next;
      });
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().catch(() => {}); setPlaying(true); }
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setLoopCount(0);
    setPhase("listen");
    setHidden(false);
    audio.play().catch(() => {});
    setPlaying(true);
  };

  const skipToRecall = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setPhase("recall");
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = t;
    setProgress(t);
  };

  const handleComplete = async (result: "memorized" | "learning" | "needs_revision") => {
    audioRef.current?.pause();
    setCompleting(true);
    await onComplete(result);
    setCompleting(false);
  };

  const progressPct = duration ? Math.round((progress / duration) * 100) : 0;

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const isListen = phase === "listen";

  // ── Wakti brand tokens (no purple) ──
  const bg        = dark ? "#0c0f14" : "#fcfefd";
  const surface   = dark ? "rgba(255,255,255,0.05)" : "rgba(6,5,65,0.04)";
  const border    = dark ? "rgba(255,255,255,0.08)" : "rgba(6,5,65,0.10)";
  const textPri   = dark ? "#f2f2f2" : "#060541";
  const textSec   = dark ? "#858384" : "#606062";
  const blue      = "hsl(210,100%,65%)";
  const blueAlpha = (a: number) => `hsla(210,100%,65%,${a})`;
  const green     = "hsl(142,76%,55%)";
  const greenAlpha = (a: number) => `hsla(142,76%,55%,${a})`;
  const amber     = "hsl(45,100%,60%)";
  const amberAlpha = (a: number) => `hsla(45,100%,60%,${a})`;
  const amberText = dark ? "#fbbf24" : "#b45309";
  const red       = "hsl(0,80%,60%)";
  const redAlpha  = (a: number) => `hsla(0,80%,60%,${a})`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      dir={isAr ? "rtl" : "ltr"}
      style={{ background: bg }}
    >
      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pb-3"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px) + 56px, 72px)",
          background: dark ? "rgba(12,15,20,0.96)" : "rgba(252,254,253,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${border}`,
        }}
      >
        {/* Back */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all flex-shrink-0"
          style={{ background: surface, border: `1px solid ${border}` }}
          aria-label={isAr ? "رجوع" : "Back"}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: textPri, transform: isAr ? "rotate(180deg)" : undefined }} />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-bold truncate" style={{ color: textPri }}>
            {isAr ? (surahInfo?.ar ?? `سورة ${ayah.surah_number}`) : (surahInfo?.en ?? `Surah ${ayah.surah_number}`)}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: textSec }}>
            {isAr ? `آية ${ayah.ayah_number}` : `Ayah ${ayah.ayah_number}`}
            {surahInfo && ` · ${surahInfo.ayahs} ${isAr ? "آية" : "ayahs"}`}
          </p>
        </div>

        {/* Phase tag */}
        <div className="flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold"
          style={isListen
            ? { background: blueAlpha(0.14), color: blue, border: `1px solid ${blueAlpha(0.30)}` }
            : { background: greenAlpha(0.14), color: green, border: `1px solid ${greenAlpha(0.30)}` }}>
          {isListen ? (isAr ? "استماع" : "Listen") : (isAr ? "اختبار" : "Recall")}
        </div>
      </div>

      {/* ── AYAH ZONE ── */}
      <div className="flex-1 flex flex-col justify-center px-5 py-5 overflow-y-auto gap-4">

        {/* Basmala */}
        {ayah.ayah_number === 1 && ayah.surah_number !== 9 && !hidden && (
          <p className="text-center font-serif text-base leading-loose" dir="rtl"
            style={{ color: amberText }}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
        )}

        {/* Ayah card */}
        <div
          className="w-full rounded-2xl px-5 py-7 text-center"
          style={{
            background: surface,
            border: `1px solid ${isListen ? blueAlpha(0.18) : greenAlpha(0.18)}`,
            boxShadow: hidden ? "none"
              : isListen
                ? `0 4px 32px ${blueAlpha(0.10)}`
                : `0 4px 32px ${greenAlpha(0.10)}`,
          }}
        >
          {hidden ? (
            <div className="py-5 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: greenAlpha(0.10), border: `1px solid ${greenAlpha(0.22)}` }}>
                <EyeOff className="w-6 h-6" style={{ color: green }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: textSec }}>
                {isAr ? "حاول أن تتذكرها من ذاكرتك" : "Try to recall it from memory"}
              </p>
            </div>
          ) : (
            <p className="text-[1.6rem] leading-[2.2] font-serif" style={{ color: textPri }} dir="rtl">
              {ayah.ayah_number === 1 && ayah.surah_number !== 9
                ? stripBasmala(ayah.arabic)
                : ayah.arabic}
            </p>
          )}
        </div>

        {/* Translation */}
        {!hidden && !isAr && ayah.translation && (
          <p className="text-[13px] text-center leading-relaxed px-2" style={{ color: textSec }}>
            {ayah.translation}
          </p>
        )}
      </div>

      {/* ── BOTTOM PANEL ── */}
      <div
        className="flex-shrink-0 flex flex-col gap-3 px-5 pt-4"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 16px, 28px)",
          background: dark ? "rgba(12,15,20,0.96)" : "rgba(252,254,253,0.96)",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${border}`,
        }}
      >
        {/* Guidance */}
        <p className="text-center text-xs leading-snug" style={{ color: textSec }}>
          {isListen
            ? (loopCount === 0
              ? (isAr ? "اضغط تشغيل واستمع بتركيز — حاول حفظها" : "Tap play · listen carefully · try to memorize it")
              : loopCount < targetLoops
                ? (isAr ? "ردد الآية بصوت عالٍ مع كل تكرار" : "Repeat it aloud with every loop")
                : (isAr ? "أحسنت! انتقل الآن إلى الاختبار" : "Well done! Now move on to recall"))
            : (isAr ? "أخفِ الآية وحاول تذكرها، ثم قيّم نفسك" : "Hide the ayah · try to recall · then rate yourself")}
        </p>

        {/* ── LISTEN controls ── */}
        {isListen && (
          <div className="w-full flex flex-col items-center gap-3">
            {/* Repeat row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const v = Math.max(1, targetLoops - 1); setTargetLoops(v); targetLoopsRef.current = v; }}
                aria-label="Fewer repeats"
                className="w-9 h-9 rounded-xl text-lg font-bold flex items-center justify-center active:scale-90 transition-all"
                style={{ background: surface, color: textSec, border: `1px solid ${border}` }}
              >−</button>
              <div className="px-4 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: dark ? "hsla(45,100%,60%,0.12)" : "hsla(45,90%,45%,0.18)", color: amberText, border: `1px solid ${dark ? "hsla(45,100%,60%,0.28)" : "hsla(45,90%,45%,0.35)"}`, minWidth: "88px", textAlign: "center" }}>
                {loopCount}/{targetLoops}× {isAr ? "تكرار" : "repeats"}
              </div>
              <button
                onClick={() => { const v = Math.min(10, targetLoops + 1); setTargetLoops(v); targetLoopsRef.current = v; }}
                aria-label="More repeats"
                className="w-9 h-9 rounded-xl text-lg font-bold flex items-center justify-center active:scale-90 transition-all"
                style={{ background: surface, color: textSec, border: `1px solid ${border}` }}
              >+</button>
              <button
                onClick={replay}
                className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                style={{ background: surface, color: textSec, border: `1px solid ${border}` }}
                aria-label={isAr ? "إعادة" : "Replay"}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{
                width: "72px", height: "72px",
                background: playing
                  ? `linear-gradient(135deg, hsl(210,100%,58%) 0%, hsl(210,100%,48%) 100%)`
                  : blueAlpha(0.14),
                border: `2px solid ${blueAlpha(playing ? 0.8 : 0.35)}`,
                boxShadow: playing
                  ? `0 0 28px ${blueAlpha(0.45)}, 0 4px 16px ${blueAlpha(0.25)}`
                  : `0 0 12px ${blueAlpha(0.12)}`,
              }}
              aria-label={playing ? (isAr ? "إيقاف" : "Pause") : (isAr ? "تشغيل" : "Play")}
            >
              {playing
                ? <Pause className="w-7 h-7 text-white" />
                : <Play className="w-7 h-7" style={{ color: blue, marginLeft: "4px" }} />}
            </button>

            {/* Progress */}
            {duration > 0 && (
              <div className="w-full flex items-center gap-2">
                <span className="text-[10px] w-8 text-center flex-shrink-0" style={{ color: textSec }}>{fmt(progress)}</span>
                <input
                  type="range" min={0} max={100} value={progressPct}
                  onChange={seek}
                  aria-label={isAr ? "شريط التقدم" : "Progress"}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: blue }}
                />
                <span className="text-[10px] w-8 text-center flex-shrink-0" style={{ color: textSec }}>{fmt(duration)}</span>
              </div>
            )}

            <button
              onClick={skipToRecall}
              className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all"
              style={{ background: greenAlpha(0.12), color: green, border: `1px solid ${greenAlpha(0.28)}` }}
            >
              {isAr ? "ابدأ الاختبار الآن" : "Start test now"}
            </button>
          </div>
        )}

        {/* ── RECALL controls ── */}
        {!isListen && (
          <div className="w-full flex flex-col gap-3">
            {/* Hide / Reveal */}
            <button
              onClick={() => setHidden((h) => !h)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl active:scale-95 transition-all text-sm font-bold"
              style={hidden
                ? { background: amberAlpha(0.14), color: amber, border: `1px solid ${amberAlpha(0.38)}` }
                : { background: blueAlpha(0.12), color: blue, border: `1px solid ${blueAlpha(0.30)}` }}>
              {hidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              {hidden
                ? (isAr ? "أظهر الآية" : "Reveal ayah")
                : (isAr ? "أخفِ الآية واختبر نفسك" : "Hide ayah & test yourself")}
            </button>

            <p className="text-center text-sm font-bold" style={{ color: textPri }}>
              {isAr ? "كيف كانت؟" : "How did it go?"}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleComplete("needs_revision")}
                disabled={completing}
                className="flex-1 py-4 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                style={{ background: redAlpha(0.12), color: red, border: `1px solid ${redAlpha(0.28)}` }}>
                <span className="text-xl">😓</span>
                {isAr ? "لم أتذكر" : "Not yet"}
              </button>
              <button
                onClick={() => handleComplete("learning")}
                disabled={completing}
                className="flex-1 py-4 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                style={{ background: amberAlpha(0.12), color: amber, border: `1px solid ${amberAlpha(0.28)}` }}>
                <span className="text-xl">🤔</span>
                {isAr ? "تقريباً" : "Almost"}
              </button>
              <button
                onClick={() => handleComplete("memorized")}
                disabled={completing}
                className="flex-1 py-4 rounded-xl text-xs font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-1"
                style={{ background: greenAlpha(0.12), color: green, border: `1px solid ${greenAlpha(0.28)}` }}>
                <span className="text-xl">✅</span>
                {isAr ? "حفظت!" : "Got it!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
