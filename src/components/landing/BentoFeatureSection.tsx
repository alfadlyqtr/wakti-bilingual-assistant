import { motion } from "framer-motion";
import { ReactNode } from "react";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles, PenTool, Code2, MessageSquareMore, MonitorPlay,
  ImageIcon, Music, Pencil, Mic, Languages,
  ListTodo, CalendarDays, CalendarClock, FolderOpen,
  HeartPulse, NotebookPen, AudioLines, MessageCircle,
  Gamepad2, Swords, Puzzle,
} from "lucide-react";

// ─── 3D Glassmorphic Icon ────────────────────────────────────────────────────
function GlassIcon({ children, gradient, glow, size = 40 }: {
  children: ReactNode; gradient: string; glow: string; size?: number;
}) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "28%", background: gradient, flexShrink: 0,
        boxShadow: `0 6px 24px ${glow}50, 0 2px 0 rgba(255,255,255,0.35) inset, 0 -2px 0 rgba(0,0,0,0.15) inset, 0 0 0 0.5px rgba(255,255,255,0.18)`,
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: "28%", background: "linear-gradient(155deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 35%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "28%", background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18) 0%, transparent 50%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, color: "#fff", display: "flex" }}>{children}</div>
    </div>
  );
}

// ─── Bento Card ──────────────────────────────────────────────────────────────
interface BentoCardProps {
  icon: ReactNode;
  title: string; titleAr?: string;
  bullets: string[]; bulletsAr?: string[];
  accent: string; span?: "1" | "2";
  language: "en" | "ar"; delay?: number;
}

function BentoCard({ icon, title, titleAr, bullets, bulletsAr, accent, span = "1", language, delay = 0 }: BentoCardProps) {
  const isAr = language === "ar";
  const displayTitle = isAr && titleAr ? titleAr : title;
  const displayBullets = isAr && bulletsAr ? bulletsAr : bullets;
  const isWide = span === "2";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      style={{
        gridColumn: isWide ? "span 2" : "span 1",
        background: "linear-gradient(145deg, rgba(12,15,20,0.84) 0%, rgba(20,24,32,0.78) 100%)",
        border: `1px solid ${accent}28`, borderRadius: "1.15rem", padding: "0.85rem",
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset`,
        position: "relative", overflow: "hidden", direction: isAr ? "rtl" : "ltr",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -18, [isAr ? "left" : "right"]: -18, width: 72, height: 72, borderRadius: "50%", background: `${accent}15`, filter: "blur(18px)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, position: "relative", zIndex: 1 }}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: isWide ? 13 : 11.5, lineHeight: 1.2, marginBottom: 5 }}>{displayTitle}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2.5 }}>
            {displayBullets.map((b, i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ color: accent, fontSize: 8, flexShrink: 0, fontWeight: 800 }}>●</span>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, lineHeight: 1.35 }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section Header (no "Section A/B" labels) ────────────────────────────────
function SectionHeader({ title, titleAr, accent, language }: {
  title: string; titleAr?: string; accent: string; language: "en" | "ar";
}) {
  const isAr = language === "ar";
  return (
    <motion.h2
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{
        color: "#fff", fontSize: 22, fontWeight: 300, letterSpacing: "0.1em",
        textAlign: "center", marginBottom: 14, textShadow: `0 0 30px ${accent}40`,
      }}
    >
      {isAr && titleAr ? titleAr : title}
    </motion.h2>
  );
}

// ─── Shared CTA Button ───────────────────────────────────────────────────────
function SectionCTA({ language }: { language: "en" | "ar" }) {
  const navigate = useNavigate();
  const isAr = language === "ar";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.25 }}
      style={{ marginTop: 14 }}
    >
      <Button
        onClick={() => navigate("/signup")}
        className="w-full py-4 rounded-full text-[12px] font-bold tracking-[0.07em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #e9ceb0 0%, #c5a47e 50%, #e9ceb0 100%)",
          color: "#060541",
          boxShadow: "0 6px 28px rgba(233,206,176,0.32), 0 0 40px rgba(233,206,176,0.1)",
        }}
      >
        <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 55%)" }} />
        <span className="relative z-10">{isAr ? "ابدأ وقتي مجاناً" : "START WAKTI FOR FREE"}</span>
      </Button>
    </motion.div>
  );
}

// ─── Icon helpers (shorthand) ────────────────────────────────────────────────
const gi = (Icon: any, grad: string, glow: string, sz = 36) => (
  <GlassIcon gradient={grad} glow={glow} size={sz}><Icon style={{ width: sz * 0.48, height: sz * 0.48 }} strokeWidth={1.8} /></GlassIcon>
);
const giW = (Icon: any, grad: string, glow: string) => gi(Icon, grad, glow, 42);

// ─── Section A: Intelligence Hub ─────────────────────────────────────────────
export function SectionA({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(210,100%,65%)";
  const cards: BentoCardProps[] = [
    { icon: giW(Sparkles, "linear-gradient(145deg,#2563eb,#1d4ed8)", "#3b82f6"), title: "WAKTI AI Chat", titleAr: "دردشة وقتي AI", bullets: ["Smart chat & web search", "YouTube summaries", "Study mode & live talk"], bulletsAr: ["دردشة ذكية وبحث ويب", "ملخصات يوتيوب", "وضع الدراسة والمحادثة"], accent, span: "2", language, delay: 0 },
    { icon: gi(PenTool, "linear-gradient(145deg,#7c3aed,#6d28d9)", "#8b5cf6"), title: "Smart Text Generator", titleAr: "مولد النص الذكي", bullets: ["Write, rewrite & summarize", "Compose replies fast", "Generate PDFs & slides"], bulletsAr: ["كتابة وإعادة صياغة وتلخيص", "صياغة ردود بسرعة", "إنشاء PDF وشرائح"], accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05 },
    { icon: gi(Code2, "linear-gradient(145deg,#059669,#047857)", "#10b981"), title: "AI Coder", titleAr: "المبرمج الذكي", bullets: ["Generate & debug code", "Multi-language support", "Live code preview"], bulletsAr: ["إنشاء وتصحيح الأكواد", "دعم متعدد اللغات", "معاينة مباشرة"], accent: "hsl(160,80%,55%)", span: "1", language, delay: 0.1 },
    { icon: gi(MessageSquareMore, "linear-gradient(145deg,#d97706,#b45309)", "#f59e0b"), title: "Chatbot Builder", titleAr: "بناء الشات بوت", bullets: ["Build custom AI chatbots", "Embed on your site", "No-code setup"], bulletsAr: ["بناء شات بوت مخصص", "تضمين في موقعك", "إعداد بدون كود"], accent: "hsl(45,100%,60%)", span: "1", language, delay: 0.15 },
    { icon: gi(MonitorPlay, "linear-gradient(145deg,#7c3aed,#5b21b6)", "#a855f7"), title: "Presentations & PDFs", titleAr: "عروض ومستندات", bullets: ["Slide decks in seconds", "PDF generation", "Smart diagrams"], bulletsAr: ["شرائح خلال ثوانٍ", "إنشاء PDF", "مخططات ذكية"], accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.2 },
  ];

  return (
    <LandingScene id="section-ai" className="bg-[#0c0f14]" gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)">
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader title="Intelligence Hub" titleAr="مركز الذكاء" accent={accent} language={language} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cards.map((c, i) => <BentoCard key={i} {...c} />)}</div>
        <SectionCTA language={language} />
      </div>
    </LandingScene>
  );
}

// ─── Section B: Creative Studio ──────────────────────────────────────────────
export function SectionB({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(280,70%,65%)";
  const cards: BentoCardProps[] = [
    { icon: giW(ImageIcon, "linear-gradient(145deg,#db2777,#be185d)", "#ec4899"), title: "Image Generation", titleAr: "توليد الصور", bullets: ["Text → image in seconds", "Image → image transforms", "AI drawing canvas"], bulletsAr: ["نص إلى صورة خلال ثوانٍ", "تحويل صورة إلى صورة", "لوحة رسم AI"], accent: "hsl(320,75%,70%)", span: "2", language, delay: 0 },
    { icon: gi(Music, "linear-gradient(145deg,#7c3aed,#6d28d9)", "#8b5cf6"), title: "Music & Video Studio", titleAr: "استوديو الموسيقى والفيديو", bullets: ["Generate original music", "Short videos from images", "Templates & transitions"], bulletsAr: ["توليد موسيقى أصلية", "فيديوهات من صور", "قوالب وانتقالات"], accent, span: "1", language, delay: 0.05 },
    { icon: gi(Pencil, "linear-gradient(145deg,#ea580c,#c2410c)", "#fb923c"), title: "Draw & Create", titleAr: "ارسم وابتكر", bullets: ["Freehand AI sketch pad", "Auto-clean & enhance", "Export PNG / SVG"], bulletsAr: ["لوحة رسم AI حر", "تنظيف وتحسين تلقائي", "تصدير PNG / SVG"], accent: "hsl(25,95%,60%)", span: "1", language, delay: 0.1 },
    { icon: gi(Mic, "linear-gradient(145deg,#0891b2,#0e7490)", "#06b6d4"), title: "Voice TTS & Clone", titleAr: "تحويل النص لصوت واستنساخه", bullets: ["Clone your voice", "Natural TTS 60+ languages", "Real-time output"], bulletsAr: ["استنساخ صوتك", "TTS طبيعي 60+ لغة", "إخراج صوتي لحظي"], accent: "hsl(180,85%,60%)", span: "1", language, delay: 0.15 },
    { icon: gi(Languages, "linear-gradient(145deg,#059669,#047857)", "#10b981"), title: "Real-time Translation", titleAr: "ترجمة فورية", bullets: ["60+ languages", "Voice + text translation", "Clear audio playback"], bulletsAr: ["أكثر من 60 لغة", "ترجمة صوت ونص", "تشغيل صوتي واضح"], accent: "hsl(160,80%,55%)", span: "1", language, delay: 0.2 },
  ];

  return (
    <LandingScene id="section-studio" className="bg-[#0c0f14]" gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)">
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader title="Creative Studio" titleAr="الاستوديو الإبداعي" accent={accent} language={language} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cards.map((c, i) => <BentoCard key={i} {...c} />)}</div>
        <SectionCTA language={language} />
      </div>
    </LandingScene>
  );
}

// ─── Section C: Organization ─────────────────────────────────────────────────
export function SectionC({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(160,80%,55%)";
  const cards: BentoCardProps[] = [
    { icon: giW(ListTodo, "linear-gradient(145deg,#16a34a,#15803d)", "#22c55e"), title: "Tasks & Reminders", titleAr: "المهام والتذكيرات", bullets: ["Smart tasks with subtasks", "Share & track with team", "Real-time progress sync"], bulletsAr: ["مهام ذكية بمهام فرعية", "شارك وتابع مع الفريق", "مزامنة لحظية"], accent, span: "2", language, delay: 0 },
    { icon: gi(CalendarDays, "linear-gradient(145deg,#7c3aed,#6d28d9)", "#a855f7"), title: "Wakti Calendar", titleAr: "تقويم وقتي", bullets: ["Full calendar view", "Sync across devices", "Reminders & alerts"], bulletsAr: ["عرض تقويم كامل", "مزامنة عبر الأجهزة", "تذكيرات وتنبيهات"], accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05 },
    { icon: gi(CalendarClock, "linear-gradient(145deg,#db2777,#be185d)", "#ec4899"), title: "Maw3d Events", titleAr: "مواعيد", bullets: ["Custom event pages", "Live RSVP tracking", "Comments & updates"], bulletsAr: ["صفحات فعاليات مخصصة", "تتبع RSVP لحظي", "تعليقات وتحديثات"], accent: "hsl(320,75%,70%)", span: "1", language, delay: 0.1 },
    { icon: giW(FolderOpen, "linear-gradient(145deg,#2563eb,#1d4ed8)", "#3b82f6"), title: "Documentation Hub", titleAr: "مركز التوثيق", bullets: ["My Files & Warranty docs", "Project management", "Searchable file library"], bulletsAr: ["ملفاتي ومستندات الضمان", "إدارة المشاريع", "مكتبة ملفات"], accent: "hsl(210,100%,65%)", span: "2", language, delay: 0.15 },
  ];

  return (
    <LandingScene id="section-org" className="bg-[#0c0f14]" gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,197,94,0.07) 0%, transparent 70%)">
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader title="Organization" titleAr="التنظيم" accent={accent} language={language} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cards.map((c, i) => <BentoCard key={i} {...c} />)}</div>
        <SectionCTA language={language} />
      </div>
    </LandingScene>
  );
}

// ─── Section D: Wellness & Capture ───────────────────────────────────────────
export function SectionD({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(25,95%,60%)";
  const cards: BentoCardProps[] = [
    { icon: giW(HeartPulse, "linear-gradient(145deg,#dc2626,#b91c1c)", "#ef4444"), title: "Vitality – Health Data", titleAr: "الحيوية – البيانات الصحية", bullets: ["WHOOP integration", "Recovery & HRV insights", "Sleep & strain tracking"], bulletsAr: ["تكامل WHOOP", "رؤى الاستشفاء وHRV", "تتبع النوم والإجهاد"], accent, span: "2", language, delay: 0 },
    { icon: gi(NotebookPen, "linear-gradient(145deg,#7c3aed,#6d28d9)", "#a855f7"), title: "Wakti Journal", titleAr: "مذكرات وقتي", bullets: ["Daily reflections", "Mood tracking", "AI journaling prompts"], bulletsAr: ["تأملات يومية", "تتبع المزاج", "مطالبات AI يومية"], accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05 },
    { icon: gi(AudioLines, "linear-gradient(145deg,#0891b2,#0e7490)", "#06b6d4"), title: "Tasjeel Recorder", titleAr: "مسجّل تسجيل", bullets: ["Record meetings & lectures", "AI transcription", "Search & summarize"], bulletsAr: ["تسجيل اجتماعات ومحاضرات", "نسخ بالـ AI", "بحث وتلخيص"], accent: "hsl(180,85%,60%)", span: "1", language, delay: 0.1 },
    { icon: giW(MessageCircle, "linear-gradient(145deg,#2563eb,#1d4ed8)", "#3b82f6"), title: "Contacts & Messaging", titleAr: "جهات الاتصال والرسائل", bullets: ["Add & manage contacts", "Send & receive messages", "Stay connected anywhere"], bulletsAr: ["إضافة وإدارة جهات الاتصال", "إرسال واستقبال رسائل", "تواصل دائم"], accent: "hsl(210,100%,65%)", span: "2", language, delay: 0.15 },
  ];

  return (
    <LandingScene id="section-wellness" className="bg-[#0c0f14]" gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(239,68,68,0.07) 0%, transparent 70%)">
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader title="Wellness & Capture" titleAr="الصحة والتسجيل" accent={accent} language={language} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cards.map((c, i) => <BentoCard key={i} {...c} />)}</div>
        <SectionCTA language={language} />
      </div>
    </LandingScene>
  );
}

// ─── Section E: Leisure ──────────────────────────────────────────────────────
export function SectionE({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(320,75%,70%)";
  const cards: BentoCardProps[] = [
    { icon: giW(Gamepad2, "linear-gradient(145deg,#db2777,#be185d)", "#ec4899"), title: "AI Games", titleAr: "ألعاب الذكاء الاصطناعي", bullets: ["Fun & fast AI-powered games", "Play solo or with friends", "New games added regularly"], bulletsAr: ["ألعاب AI ممتعة وسريعة", "العب منفرداً أو مع أصدقاء", "ألعاب جديدة بانتظام"], accent, span: "2", language, delay: 0 },
    { icon: gi(Swords, "linear-gradient(145deg,#d97706,#b45309)", "#fbbf24"), title: "Chess vs AI", titleAr: "الشطرنج ضد AI", bullets: ["Classic chess engine", "Multiple difficulty levels", "Move hints & analysis"], bulletsAr: ["محرك شطرنج كلاسيكي", "مستويات صعوبة متعددة", "تلميحات وتحليل"], accent: "hsl(45,100%,60%)", span: "1", language, delay: 0.05 },
    { icon: gi(Puzzle, "linear-gradient(145deg,#7c3aed,#5b21b6)", "#8b5cf6"), title: "Trivia & Word Games", titleAr: "ألعاب المعرفة والكلمات", bullets: ["AI-generated trivia", "Word puzzle challenges", "Multiplayer ready"], bulletsAr: ["أسئلة ثقافية بالـ AI", "تحديات ألغاز كلمات", "جاهز للعب الجماعي"], accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.1 },
  ];

  return (
    <LandingScene id="section-leisure" className="bg-[#0c0f14]" gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(236,72,153,0.07) 0%, transparent 70%)">
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader title="Leisure" titleAr="الترفيه" accent={accent} language={language} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{cards.map((c, i) => <BentoCard key={i} {...c} />)}</div>
        <SectionCTA language={language} />
      </div>
    </LandingScene>
  );
}
