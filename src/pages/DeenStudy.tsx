import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Bookmark, CheckCircle, RotateCcw, BookOpen, Play, Pause, Eye, EyeOff, ChevronRight, X, Target, Search } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StudyTab = "today" | "review" | "plans";
type PlanType = "beginner" | "juzamma" | "custom";

interface StudyPlan {
  type: PlanType;
  dailyGoal: number;
  currentSurah: number;
  currentAyah: number;
  startSurah?: number;
  startAyah?: number;
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
  // Match بسم الله الرحمن الرحيم with any diacritics/Unicode variants at the start
  return text.replace(/^[\u0628][\u064e\u0650\u064f\u0652]?[\u0633][\u064e\u0650\u064f\u0652]?[\u0645][\u064e\u0650\u064f\u0652]?\s+[\u0671\u0627][\u0644][\u0644][\u064e\u0651]?[\u0647][\u064e\u0650\u064f\u0652]?\s+[\u0671\u0627][\u0644][\u0631][\u064e\u0651]?[\u062d][\u064e\u0650\u064f\u0652\u0670]?[\u0646][\u064e\u0650\u064f\u0652]?\s+[\u0671\u0627][\u0644][\u0631][\u064e\u0651]?[\u062d][\u064e\u0650\u064f\u0652]?[\u064a][\u064e\u0650\u064f\u0652]?[\u0645][\u064e\u0650\u064f\u0652]?\s*/u, "").trim();
}

function readPlan(): StudyPlan | null {
  try {
    const raw = localStorage.getItem(STUDY_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudyPlan;
  } catch { return null; }
}

function savePlan(plan: StudyPlan) {
  try { localStorage.setItem(STUDY_PLAN_KEY, JSON.stringify(plan)); } catch {}
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
  const { language } = useTheme();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<StudyTab>("today");
  const [plan, setPlan] = useState<StudyPlan | null>(() => readPlan());
  const [memorization, setMemorization] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionAyah, setSessionAyah] = useState<AyahData | null>(null);
  const [playerMode, setPlayerMode] = useState<"learn" | "review">("learn");
  const [fetchingAyah, setFetchingAyah] = useState(false);

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
      savePlan(updated);
      setPlan(updated);
    }
    setSessionAyah(null);
    reloadMemorization();
    toast.success(isAr ? "أحسنت 🌟" : "Well done 🌟");
  }, [sessionAyah, plan, playerMode, upsertMemorization, reloadMemorization, isAr]);

  const activatePlan = (type: PlanType, dailyGoal: number, startSurah: number, startAyah: number) => {
    const newPlan: StudyPlan = { type, dailyGoal, currentSurah: startSurah, currentAyah: startAyah, startSurah, startAyah };
    savePlan(newPlan);
    setPlan(newPlan);
    setActiveTab("today");
    toast.success(isAr ? "تم اختيار الخطة ✓" : "Plan set ✓");
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
      style={{ background: "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)" }}
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
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: "rgba(12,15,20,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate("/deen")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-[#f2f2f2]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <h1 className="text-base font-bold text-[#f2f2f2]">{isAr ? "الدراسة" : "Study"}</h1>
          {plan && (
            <div className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
              style={{ background: "hsla(45,100%,60%,0.12)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.22)" }}>
              {plan.type === "juzamma" ? (isAr ? "جزء عمّ" : "Juz Amma") : plan.type === "beginner" ? (isAr ? "مبتدئ" : "Beginner") : (isAr ? "مخصص" : "Custom")}
            </div>
          )}
        </div>
        <div className="flex rounded-xl p-1 gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
              style={activeTab === tab.id
                ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.25)" }
                : { color: "#858384" }}>
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
              <NoPlanState isAr={isAr} onSetupPlan={() => setActiveTab("plans")} />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard value={learningItems.length} label={isAr ? "تتعلمه" : "Learning"} color="#60a5fa" bg="hsla(210,100%,65%,0.08)" />
                  <StatCard value={reviewItems.length} label={isAr ? "للمراجعة" : "Review due"} color="#fbbf24" bg="hsla(45,100%,60%,0.08)" />
                  <StatCard value={memorizedCount} label={isAr ? "ثابت" : "Strong"} color="#4ade80" bg="hsla(142,76%,55%,0.08)" />
                </div>

                <button
                  onClick={() => openLearnSession(plan.currentSurah, plan.currentAyah)}
                  disabled={fetchingAyah}
                  className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all disabled:opacity-60"
                  style={{ background: "hsla(45,100%,60%,0.08)", border: "1px solid hsla(45,100%,60%,0.22)" }}
                  dir={isAr ? "rtl" : "ltr"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "hsla(45,100%,60%,0.15)", border: "1px solid hsla(45,100%,60%,0.28)" }}>
                        {fetchingAyah
                          ? <div className="w-5 h-5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                          : <Play className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#f2f2f2]">{isAr ? "ابدأ جلسة اليوم" : "Start today's session"}</p>
                        <p className="text-xs text-amber-400 mt-0.5">
                          {isAr ? "سورة" : "Surah"} {plan.currentSurah} — {isAr ? "آية" : "Ayah"} {plan.currentAyah}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
                  </div>
                </button>

                {reviewItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[#f2f2f2]">{isAr ? "تحتاج مراجعة" : "Due for review"}</p>
                      <button onClick={() => setActiveTab("review")} className="text-[11px] text-amber-400 font-semibold">
                        {isAr ? "عرض الكل" : "See all"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {reviewItems.slice(0, 2).map((m) => (
                        <MemorizationRow key={m.id} item={m} isAr={isAr}
                          onUpdate={updateMemorizationStatus}
                          onTap={() => openReviewSession(m)}
                          emphasizeReview />
                      ))}
                    </div>
                  </div>
                )}

                {learningItems.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-[#f2f2f2] mb-2">{isAr ? "تتعلمه الآن" : "Learning now"}</p>
                    <div className="flex flex-col gap-2">
                      {learningItems.slice(0, 3).map((m) => (
                        <MemorizationRow key={m.id} item={m} isAr={isAr}
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
            {loading ? <Loader /> : reviewItems.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <RotateCcw className="w-7 h-7 text-[#606062]" />
                </div>
                <p className="text-sm font-semibold text-[#f2f2f2]">{isAr ? "لا شيء للمراجعة" : "Nothing to review"}</p>
                <p className="text-xs text-[#858384] max-w-[220px] leading-relaxed">
                  {isAr ? "حين تحفظ آيات ستظهر هنا للمراجعة الدورية." : "Once you memorize ayahs they will appear here for periodic revision."}
                </p>
              </div>
            ) : (
              reviewItems.map((m) => (
                <MemorizationRow key={m.id} item={m} isAr={isAr}
                  onUpdate={updateMemorizationStatus}
                  onTap={() => openReviewSession(m)}
                  emphasizeReview />
              ))
            )}
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === "plans" && (
          <PlansSetup isAr={isAr} activePlan={plan} onActivate={activatePlan} />
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

function MemorizationRow({ item: m, isAr, onUpdate, onTap, emphasizeReview = false }: {
  item: any; isAr: boolean;
  onUpdate: (id: string, status: string) => Promise<void>;
  onTap?: () => void;
  emphasizeReview?: boolean;
}) {
  const isMemorized = m.status === "memorized";
  const isReview = m.status === "needs_revision";
  return (
    <div
      className="rounded-xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-all cursor-pointer"
      style={{
        background: emphasizeReview ? "hsla(45,100%,60%,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${emphasizeReview ? "hsla(45,100%,60%,0.16)" : "rgba(255,255,255,0.06)"}`,
      }}
      onClick={onTap}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{
          background: isMemorized ? "hsla(142,76%,55%,0.12)" : isReview ? "hsla(45,100%,60%,0.12)" : "hsla(210,100%,65%,0.12)",
          color: isMemorized ? "#4ade80" : isReview ? "#fbbf24" : "#60a5fa",
          border: `1px solid ${isMemorized ? "hsla(142,76%,55%,0.25)" : isReview ? "hsla(45,100%,60%,0.22)" : "hsla(210,100%,65%,0.25)"}`,
        }}>
        {m.surah_number}:{m.ayah_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#f2f2f2]">
          {isAr ? "سورة" : "Surah"} {m.surah_number} — {isAr ? "آية" : "Ayah"} {m.ayah_number}
        </p>
        <p className="text-[10px] text-[#858384] mt-0.5">
          {isMemorized ? (isAr ? "✅ ثابت" : "✅ Strong") : isReview ? (isAr ? "🔄 راجع اليوم" : "🔄 Review today") : (isAr ? "📖 تتعلمها" : "📖 Learning")}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-[#606062] flex-shrink-0" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
    </div>
  );
}

function NoPlanState({ isAr, onSetupPlan }: { isAr: boolean; onSetupPlan: () => void }) {
  return (
    <div className="flex flex-col items-center py-14 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "hsla(45,100%,60%,0.08)", border: "1px solid hsla(45,100%,60%,0.18)" }}>
        <Target className="w-8 h-8 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-[#f2f2f2]">{isAr ? "اختر خطة للبداية" : "Choose a plan to begin"}</p>
        <p className="text-xs text-[#858384] mt-1.5 max-w-[230px] mx-auto leading-relaxed">
          {isAr
            ? "اختر مساراً مناسباً وسنوجهك آية بآية حتى تحفظ بثبات."
            : "Pick a path and we will guide you ayah by ayah to build a consistent memorization habit."}
        </p>
      </div>
      <button
        onClick={onSetupPlan}
        className="px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
        style={{ background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }}
      >
        {isAr ? "اختر خطتك" : "Choose your plan"}
      </button>
    </div>
  );
}

function PlansSetup({ isAr, activePlan, onActivate }: {
  isAr: boolean;
  activePlan: StudyPlan | null;
  onActivate: (type: PlanType, dailyGoal: number, startSurah: number, startAyah: number) => void;
}) {
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
    { type: "custom", icon: Bookmark, titleEn: "Custom Plan", titleAr: "خطة مخصصة", descEn: "Pick any surah and ayah to start from", descAr: "اختر أي سورة وآية تبدأ منها", glow: "hsla(45,100%,60%" },
  ];

  const resolvedAyah = ayahMode === "beginning" ? 1 : customAyah;
  const canStart = selectedType === "custom" ? !!pickedSurah : !!selectedType;

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
      <p className="text-xs text-[#858384] font-semibold">{isAr ? "اختر مسار الحفظ" : "Choose your memorization path"}</p>
      <div className="flex flex-col gap-3">
        {plans.map(({ type, icon: Icon, titleEn, titleAr, descEn, descAr, glow }) => {
          const active = selectedType === type;
          return (
            <button key={type} onClick={() => setSelectedType(type)}
              className="w-full flex items-center gap-3 rounded-xl p-4 text-left active:scale-[0.99] transition-all"
              style={{
                background: active ? `${glow},0.10)` : `${glow},0.03)`,
                border: `1px solid ${active ? `${glow},0.30)` : `${glow},0.10)`}`,
              }}
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${glow},${active ? "0.18)" : "0.08)"}` }}>
                <Icon className="w-5 h-5" style={{ color: active ? "#f2f2f2" : "#858384" }} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: active ? "#f2f2f2" : "#858384" }}>{isAr ? titleAr : titleEn}</p>
                <p className="text-[11px] mt-0.5" style={{ color: active ? "#a3a3a3" : "#606062" }}>{isAr ? descAr : descEn}</p>
              </div>
              {active && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* ── Custom Plan: surah picker + ayah choice ── */}
      {selectedType === "custom" && (
        <div className="rounded-xl flex flex-col gap-3" style={{ background: "hsla(45,100%,60%,0.04)", border: "1px solid hsla(45,100%,60%,0.14)" }}>
          {/* Step 1: pick surah */}
          <div className="p-3.5 pb-0">
            <p className="text-xs text-[#858384] font-semibold mb-2">
              {isAr ? "1. اختر السورة" : "1. Choose a surah"}
            </p>
            {/* Search box */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <Search className="w-3.5 h-3.5 text-[#606062] flex-shrink-0" />
              <input
                type="text"
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                placeholder={isAr ? "ابحث عن سورة…" : "Search surah…"}
                aria-label={isAr ? "بحث السورة" : "Search surah"}
                className="flex-1 bg-transparent text-xs text-[#f2f2f2] outline-none placeholder:text-[#606062]"
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
                    style={{ background: picked ? "hsla(45,100%,60%,0.12)" : "transparent" }}
                    dir={isAr ? "rtl" : "ltr"}
                  >
                    <span className="text-[10px] font-bold w-6 text-center flex-shrink-0"
                      style={{ color: picked ? "#fbbf24" : "#606062" }}>{s.n}</span>
                    <span className="flex-1 text-xs font-semibold truncate"
                      style={{ color: picked ? "#f2f2f2" : "#858384" }}>
                      {isAr ? s.ar : s.en}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: picked ? "#fbbf24" : "#606062" }}>
                      {s.ayahs} {isAr ? "آية" : "ayahs"}
                    </span>
                    {picked && <CheckCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                  </button>
                );
              })}
              {filteredSurahs.length === 0 && (
                <p className="text-center text-xs text-[#606062] py-4">{isAr ? "لا نتائج" : "No results"}</p>
              )}
            </div>
          </div>

          {/* Step 2: ayah choice — only visible after surah picked */}
          {pickedSurah && (
            <div className="px-3.5 pb-3.5 flex flex-col gap-2 border-t" style={{ borderColor: "hsla(45,100%,60%,0.12)" }}>
              <p className="text-xs text-[#858384] font-semibold pt-3">
                {isAr ? "2. ابدأ من" : "2. Start from"}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setAyahMode("beginning")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  style={ayahMode === "beginning"
                    ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#858384", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {isAr ? "البداية (آية 1)" : "Beginning (Ayah 1)"}
                </button>
                <button onClick={() => setAyahMode("custom")}
                  className="flex-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  style={ayahMode === "custom"
                    ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#858384", border: "1px solid rgba(255,255,255,0.08)" }}>
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
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }}
                  placeholder={`1 – ${pickedSurah.ayahs}`}
                />
              )}
              <p className="text-[10px] text-amber-400">
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
        <p className="text-xs text-[#858384] font-semibold mb-2">{isAr ? "كم آية يومياً؟" : "How many ayahs per day?"}</p>
        <div className="flex gap-2">
          {[1, 3, 5].map((n) => (
            <button key={n} onClick={() => setDailyGoal(n)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
              style={dailyGoal === n
                ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }
                : { background: "rgba(255,255,255,0.04)", color: "#858384", border: "1px solid rgba(255,255,255,0.08)" }}>
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
                ? { background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }
                : { background: "rgba(255,255,255,0.04)", color: "#858384", border: "1px solid rgba(255,255,255,0.08)" }
            }
          />
        </div>
        <p className="text-[10px] text-[#606062] mt-1.5">
          {isAr ? `الهدف: ${dailyGoal} آية يومياً` : `Goal: ${dailyGoal} ayah${dailyGoal !== 1 ? "s" : ""} / day`}
        </p>
      </div>

      <button
        onClick={handleStart}
        disabled={!canStart}
        className="w-full py-3 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
        style={{ background: "hsla(45,100%,60%,0.15)", color: "#fbbf24", border: "1px solid hsla(45,100%,60%,0.28)" }}
      >
        {isAr ? "ابدأ الخطة" : "Start this plan"}
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "linear-gradient(180deg, #0c0f14 0%, hsl(235 30% 6%) 100%)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 pb-3"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px) + 56px, 72px)",
          background: "rgba(12,15,20,0.95)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Back / close */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          aria-label={isAr ? "رجوع" : "Back"}
        >
          <ArrowLeft className="w-4 h-4 text-[#f2f2f2]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
        </button>

        {/* Surah name + ayah */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#f2f2f2] truncate">
            {isAr ? (surahInfo?.ar ?? `سورة ${ayah.surah_number}`) : (surahInfo?.en ?? `Surah ${ayah.surah_number}`)}
          </p>
          <p className="text-[11px] text-[#858384] mt-0.5">
            {isAr ? `آية ${ayah.ayah_number}` : `Ayah ${ayah.ayah_number}`}
            {surahInfo && ` · ${surahInfo.ayahs} ${isAr ? "آية" : "ayahs"}`}
          </p>
        </div>

        {/* Repeat counter: −  2/3×  + */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { const v = Math.max(1, targetLoops - 1); setTargetLoops(v); targetLoopsRef.current = v; }}
            aria-label="Fewer repeats"
            className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "#858384", border: "1px solid rgba(255,255,255,0.10)" }}
          >−</button>
          <span className="text-[11px] font-bold w-10 text-center" style={{ color: "#fbbf24" }}>
            {loopCount}/{targetLoops}×
          </span>
          <button
            onClick={() => { const v = Math.min(10, targetLoops + 1); setTargetLoops(v); targetLoopsRef.current = v; }}
            aria-label="More repeats"
            className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.07)", color: "#858384", border: "1px solid rgba(255,255,255,0.10)" }}
          >+</button>
        </div>

        {/* Replay */}
        <button
          onClick={replay}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
          aria-label={isAr ? "إعادة" : "Replay"}
        >
          <RotateCcw className="w-4 h-4 text-[#858384]" />
        </button>
      </div>

      {/* ── MAIN CONTENT: ayah card fills the upper space ── */}
      <div className="flex-1 flex flex-col px-5 pt-6 pb-2 overflow-y-auto">

        {/* Basmala header — always shown for ayah 1 of any surah (except surah 9) */}
        {ayah.ayah_number === 1 && ayah.surah_number !== 9 && (
          <div className="text-center mb-4">
            <p className="text-lg text-[#858384] font-serif leading-loose tracking-wide" dir="rtl">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
            <div className="mx-auto mt-2 h-px w-20" style={{ background: "rgba(255,255,255,0.10)" }} />
          </div>
        )}

        {/* Arabic ayah card — Basmala stripped from the text */}
        <div className="w-full rounded-2xl px-5 py-6 text-center"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {hidden ? (
            <p className="text-[#606062] text-sm font-semibold py-4">
              {isAr ? "النص مخفي — حاول أن تتذكر" : "Text hidden — try to recall from memory"}
            </p>
          ) : (
            <p className="text-[1.55rem] text-[#f2f2f2] leading-[2.2] font-serif" dir="rtl">
              {stripBasmala(ayah.arabic)}
            </p>
          )}
        </div>

        {/* Translation */}
        {!hidden && ayah.translation && (
          <p className="text-xs text-[#858384] text-center leading-relaxed mt-4 px-2">{ayah.translation}</p>
        )}
      </div>

      {/* ── BOTTOM PANEL: phase pill + controls always pinned here ── */}
      <div
        className="flex-shrink-0 flex flex-col items-center gap-4 px-5 pt-4"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px) + 16px, 28px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(12,15,20,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Phase pill */}
        <div className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={phase === "listen"
            ? { background: "hsla(210,100%,65%,0.12)", color: "#7dd3fc", border: "1px solid hsla(210,100%,65%,0.22)" }
            : { background: "hsla(280,70%,65%,0.12)", color: "#c084fc", border: "1px solid hsla(280,70%,65%,0.22)" }}>
          {phase === "listen"
            ? (isAr ? `🔊 استمع وردد — ${Math.max(0, targetLoops - loopCount)} متبقية` : `🔊 Listen & repeat — ${Math.max(0, targetLoops - loopCount)} left`)
            : (isAr ? "🙈 هل تتذكرها؟" : "🙈 Can you recall it?")}
        </div>

        {/* ── LISTEN controls ── */}
        {phase === "listen" && (
          <div className="w-full flex flex-col items-center gap-3">
            <button
              onClick={togglePlay}
              className="rounded-full flex items-center justify-center active:scale-95 transition-all"
              style={{
                width: "68px", height: "68px",
                background: playing ? "hsla(210,100%,65%,0.22)" : "hsla(210,100%,65%,0.12)",
                border: "1px solid hsla(210,100%,65%,0.35)",
                boxShadow: playing ? "0 0 24px hsla(210,100%,65%,0.35)" : "none",
              }}
              aria-label={playing ? (isAr ? "إيقاف" : "Pause") : (isAr ? "تشغيل" : "Play")}
            >
              {playing
                ? <Pause className="w-7 h-7 text-sky-400" />
                : <Play className="w-7 h-7 text-sky-400" style={{ marginLeft: "3px" }} />}
            </button>

            {duration > 0 && (
              <div className="w-full flex items-center gap-2">
                <span className="text-[10px] text-[#606062] w-8 text-center flex-shrink-0">{fmt(progress)}</span>
                <input
                  type="range" min={0} max={100} value={progressPct}
                  onChange={seek}
                  aria-label={isAr ? "شريط التقدم" : "Progress"}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#60a5fa" }}
                />
                <span className="text-[10px] text-[#606062] w-8 text-center flex-shrink-0">{fmt(duration)}</span>
              </div>
            )}

            <button
              onClick={skipToRecall}
              className="text-[11px] text-[#606062] font-semibold active:text-[#858384] transition-all"
            >
              {isAr ? "تخطى إلى الاختبار ←" : "Skip to recall →"}
            </button>
          </div>
        )}

        {/* ── RECALL controls ── */}
        {phase === "recall" && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setHidden((h) => !h)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-95 transition-all text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.07)", color: "#858384", border: "1px solid rgba(255,255,255,0.12)" }}>
              {hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {hidden ? (isAr ? "أظهر الآية" : "Reveal ayah") : (isAr ? "أخفِ الآية" : "Hide ayah")}
            </button>

            <p className="text-center text-xs text-[#606062] font-semibold">
              {isAr ? "كيف كانت؟" : "How did it go?"}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => handleComplete("needs_revision")}
                disabled={completing}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                style={{ background: "hsla(0,80%,55%,0.10)", color: "#f87171", border: "1px solid hsla(0,80%,55%,0.22)" }}>
                <span className="text-base">😓</span>
                {isAr ? "لم أتذكر" : "Not yet"}
              </button>
              <button
                onClick={() => handleComplete("learning")}
                disabled={completing}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                style={{ background: "hsla(210,100%,65%,0.10)", color: "#7dd3fc", border: "1px solid hsla(210,100%,65%,0.22)" }}>
                <span className="text-base">🤔</span>
                {isAr ? "تقريباً" : "Almost"}
              </button>
              <button
                onClick={() => handleComplete("memorized")}
                disabled={completing}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                style={{ background: "hsla(142,76%,55%,0.10)", color: "#4ade80", border: "1px solid hsla(142,76%,55%,0.22)" }}>
                <span className="text-base">✅</span>
                {isAr ? "حفظت!" : "Got it!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
