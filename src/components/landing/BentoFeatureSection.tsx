import { motion } from "framer-motion";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// ─── 3D Glassmorphic Icon Component ─────────────────────────────────────────
// Renders a frosted-glass "physical object" icon using layered CSS
interface GlassIconProps {
  emoji: string;
  gradient: string;
  glow: string;
  size?: "sm" | "md" | "lg";
}

function GlassIcon({ emoji, gradient, glow, size = "md" }: GlassIconProps) {
  const dim = size === "lg" ? 64 : size === "sm" ? 36 : 48;
  const fontSize = size === "lg" ? 28 : size === "sm" ? 16 : 22;
  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: "30%",
        background: gradient,
        boxShadow: `0 4px 20px ${glow}55, 0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.2) inset`,
        border: "1px solid rgba(255,255,255,0.25)",
        backdropFilter: "blur(12px) saturate(200%)",
        WebkitBackdropFilter: "blur(12px) saturate(200%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Top-edge glass highlight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "30%",
          background: "linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <span style={{ fontSize, position: "relative", zIndex: 1, lineHeight: 1 }}>{emoji}</span>
    </div>
  );
}

// ─── Bento Card ──────────────────────────────────────────────────────────────
interface BentoCardProps {
  icon: { emoji: string; gradient: string; glow: string };
  title: string;
  titleAr?: string;
  bullets: string[];
  bulletsAr?: string[];
  accent: string;
  span?: "1" | "2"; // column span
  language: "en" | "ar";
  delay?: number;
}

function BentoCard({ icon, title, titleAr, bullets, bulletsAr, accent, span = "1", language, delay = 0 }: BentoCardProps) {
  const isAr = language === "ar";
  const displayTitle = isAr && titleAr ? titleAr : title;
  const displayBullets = isAr && bulletsAr ? bulletsAr : bullets;
  const isWide = span === "2";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      style={{
        gridColumn: isWide ? "span 2" : "span 1",
        background: `linear-gradient(145deg, rgba(12,15,20,0.82) 0%, rgba(20,24,32,0.75) 100%)`,
        border: `1px solid ${accent}30`,
        borderRadius: "1.25rem",
        padding: "1rem",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset`,
        position: "relative",
        overflow: "hidden",
        direction: isAr ? "rtl" : "ltr",
      }}
    >
      {/* Subtle top shimmer line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "20%",
          right: "20%",
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
          pointerEvents: "none",
        }}
      />
      {/* Faint accent glow in corner */}
      <div
        style={{
          position: "absolute",
          top: -20,
          [isAr ? "left" : "right"]: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `${accent}18`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, position: "relative", zIndex: 1 }}>
        <GlassIcon emoji={icon.emoji} gradient={icon.gradient} glow={icon.glow} size={isWide ? "md" : "sm"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: isWide ? 13 : 12, lineHeight: 1.2, marginBottom: 6 }}>
            {displayTitle}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
            {displayBullets.map((b, i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ color: accent, fontSize: 9, flexShrink: 0, fontWeight: 700 }}>▸</span>
                <span style={{ color: "rgba(255,255,255,0.68)", fontSize: 10, lineHeight: 1.4 }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label, labelAr, title, titleAr, accent, language }: {
  label: string; labelAr?: string;
  title: string; titleAr?: string;
  accent: string; language: "en" | "ar";
}) {
  const isAr = language === "ar";
  return (
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <motion.p
        initial={{ opacity: 0, y: -8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ color: accent, fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 4 }}
      >
        {isAr && labelAr ? labelAr : label}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, delay: 0.08 }}
        style={{
          color: "#fff",
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: "0.1em",
          textShadow: `0 0 30px ${accent}40`,
        }}
      >
        {isAr && titleAr ? titleAr : title}
      </motion.h2>
    </div>
  );
}

// ─── Section A: WAKTI AI ──────────────────────────────────────────────────────
export function SectionA({ language = "en" }: { language?: "en" | "ar" }) {
  const navigate = useNavigate();
  const isAr = language === "ar";
  const accent = "hsl(210,100%,65%)";

  const cards: BentoCardProps[] = [
    {
      icon: { emoji: "🤖", gradient: "linear-gradient(145deg, rgba(59,130,246,0.6), rgba(37,99,235,0.8))", glow: "#3b82f6" },
      title: "WAKTI AI Chat", titleAr: "دردشة وقتي AI",
      bullets: ["Smart chat & web search", "YouTube summaries", "Study mode & live talk"],
      bulletsAr: ["دردشة ذكية وبحث ويب", "ملخصات يوتيوب", "وضع الدراسة والمحادثة المباشرة"],
      accent, span: "2", language, delay: 0,
    },
    {
      icon: { emoji: "⌨️", gradient: "linear-gradient(145deg, rgba(99,102,241,0.6), rgba(79,70,229,0.8))", glow: "#6366f1" },
      title: "Smart Text Generator", titleAr: "مولد النص الذكي",
      bullets: ["Write, rewrite & summarize", "Compose replies fast", "Generate PDFs & slides"],
      bulletsAr: ["كتابة وإعادة صياغة وتلخيص", "صياغة ردود بسرعة", "إنشاء ملفات PDF وشرائح"],
      accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05,
    },
    {
      icon: { emoji: "💻", gradient: "linear-gradient(145deg, rgba(16,185,129,0.6), rgba(5,150,105,0.8))", glow: "#10b981" },
      title: "AI Coder", titleAr: "المبرمج الذكي",
      bullets: ["Generate & debug code", "Multi-language support", "Live code preview"],
      bulletsAr: ["إنشاء وتصحيح الأكواد", "دعم متعدد اللغات", "معاينة الكود مباشرة"],
      accent: "hsl(160,80%,55%)", span: "1", language, delay: 0.1,
    },
    {
      icon: { emoji: "🤝", gradient: "linear-gradient(145deg, rgba(245,158,11,0.6), rgba(217,119,6,0.8))", glow: "#f59e0b" },
      title: "Chatbot Builder", titleAr: "بناء الشات بوت",
      bullets: ["Build custom AI chatbots", "Embed on your site", "No-code setup"],
      bulletsAr: ["بناء شات بوت AI مخصص", "تضمين في موقعك", "إعداد بدون كود"],
      accent: "hsl(45,100%,60%)", span: "1", language, delay: 0.15,
    },
    {
      icon: { emoji: "📊", gradient: "linear-gradient(145deg, rgba(139,92,246,0.6), rgba(109,40,217,0.8))", glow: "#8b5cf6" },
      title: "Presentations & PDFs", titleAr: "عروض ومستندات",
      bullets: ["Slide decks in seconds", "PDF generation", "Smart diagrams"],
      bulletsAr: ["شرائح خلال ثوانٍ", "إنشاء ملفات PDF", "مخططات ذكية"],
      accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.2,
    },
  ];

  return (
    <LandingScene
      id="section-ai"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)"
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader
          label="Section A" labelAr="القسم أ"
          title="Intelligence Hub" titleAr="مركز الذكاء"
          accent={accent} language={language}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {cards.map((c, i) => <BentoCard key={i} {...c} />)}
        </div>
      </div>
    </LandingScene>
  );
}

// ─── Section B: Studio + Voice + Text ────────────────────────────────────────
export function SectionB({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(280,70%,65%)";

  const cards: BentoCardProps[] = [
    {
      icon: { emoji: "🎨", gradient: "linear-gradient(145deg, rgba(236,72,153,0.6), rgba(219,39,119,0.8))", glow: "#ec4899" },
      title: "Image Generation", titleAr: "توليد الصور",
      bullets: ["Text → image in seconds", "Image → image transforms", "AI-assisted drawing canvas"],
      bulletsAr: ["نص إلى صورة خلال ثوانٍ", "تحويل صورة إلى صورة", "لوحة رسم بمساعدة AI"],
      accent: "hsl(320,75%,70%)", span: "2", language, delay: 0,
    },
    {
      icon: { emoji: "🎬", gradient: "linear-gradient(145deg, rgba(139,92,246,0.6), rgba(109,40,217,0.8))", glow: "#8b5cf6" },
      title: "Music & Video Studio", titleAr: "استوديو الموسيقى والفيديو",
      bullets: ["Generate original music", "Short videos from images", "Templates, transitions & audio"],
      bulletsAr: ["توليد موسيقى أصلية", "فيديوهات قصيرة من الصور", "قوالب وانتقالات وصوت"],
      accent, span: "1", language, delay: 0.05,
    },
    {
      icon: { emoji: "✏️", gradient: "linear-gradient(145deg, rgba(251,146,60,0.6), rgba(234,88,12,0.8))", glow: "#fb923c" },
      title: "Draw & Create", titleAr: "ارسم وابتكر",
      bullets: ["Freehand AI sketch pad", "Auto-clean & enhance", "Export as PNG / SVG"],
      bulletsAr: ["لوحة رسم AI حر", "تنظيف وتحسين تلقائي", "تصدير PNG / SVG"],
      accent: "hsl(25,95%,60%)", span: "1", language, delay: 0.1,
    },
    {
      icon: { emoji: "🎙️", gradient: "linear-gradient(145deg, rgba(6,182,212,0.6), rgba(14,116,144,0.8))", glow: "#06b6d4" },
      title: "Voice TTS & Clone", titleAr: "تحويل النص لصوت واستنساخه",
      bullets: ["Clone your voice", "Natural TTS in 60+ languages", "Real-time voice output"],
      bulletsAr: ["استنساخ صوتك", "TTS طبيعي بـ60+ لغة", "إخراج صوتي لحظي"],
      accent: "hsl(180,85%,60%)", span: "1", language, delay: 0.15,
    },
    {
      icon: { emoji: "🌐", gradient: "linear-gradient(145deg, rgba(16,185,129,0.6), rgba(5,150,105,0.8))", glow: "#10b981" },
      title: "Real-time Translation", titleAr: "ترجمة فورية",
      bullets: ["60+ languages", "Voice + text translation", "Clear audio playback"],
      bulletsAr: ["أكثر من 60 لغة", "ترجمة صوت ونص", "تشغيل صوتي واضح"],
      accent: "hsl(160,80%,55%)", span: "1", language, delay: 0.2,
    },
  ];

  return (
    <LandingScene
      id="section-studio"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)"
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader
          label="Section B" labelAr="القسم ب"
          title="Creative Studio" titleAr="الاستوديو الإبداعي"
          accent={accent} language={language}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {cards.map((c, i) => <BentoCard key={i} {...c} />)}
        </div>
      </div>
    </LandingScene>
  );
}

// ─── Section C: Organization ─────────────────────────────────────────────────
export function SectionC({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(160,80%,55%)";

  const cards: BentoCardProps[] = [
    {
      icon: { emoji: "✅", gradient: "linear-gradient(145deg, rgba(34,197,94,0.6), rgba(22,163,74,0.8))", glow: "#22c55e" },
      title: "Tasks & Reminders", titleAr: "المهام والتذكيرات",
      bullets: ["Smart tasks with subtasks", "Share & track with team", "Real-time progress sync"],
      bulletsAr: ["مهام ذكية بمهام فرعية", "شارك وتابع مع الفريق", "مزامنة التقدم لحظياً"],
      accent, span: "2", language, delay: 0,
    },
    {
      icon: { emoji: "📅", gradient: "linear-gradient(145deg, rgba(168,85,247,0.6), rgba(126,34,206,0.8))", glow: "#a855f7" },
      title: "Wakti Calendar", titleAr: "تقويم وقتي",
      bullets: ["Full calendar view", "Event sync across devices", "Reminders & alerts"],
      bulletsAr: ["عرض تقويم كامل", "مزامنة عبر الأجهزة", "تذكيرات وتنبيهات"],
      accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05,
    },
    {
      icon: { emoji: "🗓️", gradient: "linear-gradient(145deg, rgba(236,72,153,0.6), rgba(190,24,93,0.8))", glow: "#ec4899" },
      title: "Maw3d Events", titleAr: "مواعيد",
      bullets: ["Custom event pages", "Live RSVP tracking", "Comments & updates"],
      bulletsAr: ["صفحات فعاليات مخصصة", "تتبع RSVP لحظي", "تعليقات وتحديثات"],
      accent: "hsl(320,75%,70%)", span: "1", language, delay: 0.1,
    },
    {
      icon: { emoji: "📁", gradient: "linear-gradient(145deg, rgba(59,130,246,0.6), rgba(29,78,216,0.8))", glow: "#3b82f6" },
      title: "Documentation Hub", titleAr: "مركز التوثيق",
      bullets: ["My Files & Warranty docs", "Project management", "Searchable file library"],
      bulletsAr: ["ملفاتي ومستندات الضمان", "إدارة المشاريع", "مكتبة ملفات قابلة للبحث"],
      accent: "hsl(210,100%,65%)", span: "2", language, delay: 0.15,
    },
  ];

  return (
    <LandingScene
      id="section-org"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34,197,94,0.07) 0%, transparent 70%)"
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader
          label="Section C" labelAr="القسم ج"
          title="Organization" titleAr="التنظيم"
          accent={accent} language={language}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {cards.map((c, i) => <BentoCard key={i} {...c} />)}
        </div>
      </div>
    </LandingScene>
  );
}

// ─── Section D: Wellness & Capture ───────────────────────────────────────────
export function SectionD({ language = "en" }: { language?: "en" | "ar" }) {
  const accent = "hsl(25,95%,60%)";

  const cards: BentoCardProps[] = [
    {
      icon: { emoji: "❤️", gradient: "linear-gradient(145deg, rgba(239,68,68,0.6), rgba(185,28,28,0.8))", glow: "#ef4444" },
      title: "Vitality – Health Data", titleAr: "الحيوية – البيانات الصحية",
      bullets: ["WHOOP integration", "Recovery & HRV insights", "Sleep & strain tracking"],
      bulletsAr: ["تكامل WHOOP", "رؤى الاستشفاء وHRV", "تتبع النوم والإجهاد"],
      accent, span: "2", language, delay: 0,
    },
    {
      icon: { emoji: "📓", gradient: "linear-gradient(145deg, rgba(168,85,247,0.6), rgba(126,34,206,0.8))", glow: "#a855f7" },
      title: "Wakti Journal", titleAr: "مذكرات وقتي",
      bullets: ["Daily reflections", "Mood tracking", "AI journaling prompts"],
      bulletsAr: ["تأملات يومية", "تتبع المزاج", "مطالبات يومية بالذكاء الاصطناعي"],
      accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.05,
    },
    {
      icon: { emoji: "🎤", gradient: "linear-gradient(145deg, rgba(6,182,212,0.6), rgba(14,116,144,0.8))", glow: "#06b6d4" },
      title: "Tasjeel Recorder", titleAr: "مسجّل تسجيل",
      bullets: ["Record meetings & lectures", "AI transcription", "Search & summarize"],
      bulletsAr: ["تسجيل الاجتماعات والمحاضرات", "نسخ بالذكاء الاصطناعي", "بحث وتلخيص"],
      accent: "hsl(180,85%,60%)", span: "1", language, delay: 0.1,
    },
    {
      icon: { emoji: "💬", gradient: "linear-gradient(145deg, rgba(59,130,246,0.6), rgba(29,78,216,0.8))", glow: "#3b82f6" },
      title: "Contacts & Messaging", titleAr: "جهات الاتصال والرسائل",
      bullets: ["Add & manage contacts", "Send & receive messages", "Stay connected anywhere"],
      bulletsAr: ["إضافة وإدارة جهات الاتصال", "إرسال واستقبال الرسائل", "ابقَ على تواصل دائم"],
      accent: "hsl(210,100%,65%)", span: "2", language, delay: 0.15,
    },
  ];

  return (
    <LandingScene
      id="section-wellness"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(239,68,68,0.07) 0%, transparent 70%)"
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader
          label="Section D" labelAr="القسم د"
          title="Wellness & Capture" titleAr="الصحة والتسجيل"
          accent={accent} language={language}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {cards.map((c, i) => <BentoCard key={i} {...c} />)}
        </div>
      </div>
    </LandingScene>
  );
}

// ─── Section E: Leisure ───────────────────────────────────────────────────────
export function SectionE({ language = "en" }: { language?: "en" | "ar" }) {
  const navigate = useNavigate();
  const isAr = language === "ar";
  const accent = "hsl(320,75%,70%)";

  const cards: BentoCardProps[] = [
    {
      icon: { emoji: "🎮", gradient: "linear-gradient(145deg, rgba(236,72,153,0.6), rgba(190,24,93,0.8))", glow: "#ec4899" },
      title: "AI Games", titleAr: "ألعاب الذكاء الاصطناعي",
      bullets: ["Fun & fast AI-powered games", "Play solo or with friends", "New games regularly added"],
      bulletsAr: ["ألعاب AI ممتعة وسريعة", "العب منفرداً أو مع الأصدقاء", "ألعاب جديدة تُضاف بانتظام"],
      accent, span: "2", language, delay: 0,
    },
    {
      icon: { emoji: "♟️", gradient: "linear-gradient(145deg, rgba(251,191,36,0.6), rgba(217,119,6,0.8))", glow: "#fbbf24" },
      title: "Chess vs AI", titleAr: "الشطرنج ضد AI",
      bullets: ["Classic chess engine", "Multiple difficulty levels", "Move hints & analysis"],
      bulletsAr: ["محرك شطرنج كلاسيكي", "مستويات صعوبة متعددة", "تلميحات وتحليل للحركات"],
      accent: "hsl(45,100%,60%)", span: "1", language, delay: 0.05,
    },
    {
      icon: { emoji: "🧩", gradient: "linear-gradient(145deg, rgba(139,92,246,0.6), rgba(109,40,217,0.8))", glow: "#8b5cf6" },
      title: "Trivia & Word Games", titleAr: "ألعاب المعرفة والكلمات",
      bullets: ["AI-generated trivia", "Word puzzle challenges", "Multiplayer ready"],
      bulletsAr: ["أسئلة ثقافية بالذكاء الاصطناعي", "تحديات ألغاز الكلمات", "جاهز للعب الجماعي"],
      accent: "hsl(280,70%,65%)", span: "1", language, delay: 0.1,
    },
  ];

  return (
    <LandingScene
      id="section-leisure"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 50%, rgba(236,72,153,0.07) 0%, transparent 70%)"
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column" }}>
        <SectionHeader
          label="Section E" labelAr="القسم هـ"
          title="Leisure" titleAr="الترفيه"
          accent={accent} language={language}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {cards.map((c, i) => <BentoCard key={i} {...c} />)}
        </div>

        {/* CTA at bottom of last section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ marginTop: 20 }}
        >
          <Button
            onClick={() => navigate("/signup")}
            className="w-full py-5 rounded-full text-sm font-semibold tracking-[0.06em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #e9ceb0 0%, #d4b896 50%, #e9ceb0 100%)",
              color: "#060541",
              boxShadow: "0 8px 32px rgba(233,206,176,0.35)",
            }}
          >
            <span className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 55%)",
              }}
            />
            <span className="relative z-10">
              {isAr ? "ابدأ وقتي مجاناً" : "START WAKTI FOR FREE"}
            </span>
          </Button>
        </motion.div>
      </div>
    </LandingScene>
  );
}
