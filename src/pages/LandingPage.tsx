import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Calendar, Mic, Wand2, NotebookPen, Music, AudioLines, HeartPulse, Sparkles, MessageCircle, Gamepad2, PenTool, Languages, Image as ImageIcon, MonitorPlay } from "lucide-react";

// Landing components
import { HeroScene } from "@/components/landing/HeroScene";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { PricingScene } from "@/components/landing/PricingScene";
import { LandingScene } from "@/components/landing/LandingScene";
import { InvitationScene } from "@/components/landing/InvitationScene";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Add landing-page class to body
  useEffect(() => {
    document.body.classList.add("landing-page");
    return () => {
      document.body.classList.remove("landing-page");
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const pct = maxScroll <= 0 ? 0 : el.scrollTop / maxScroll;
      setShowScrollTop(pct >= 0.25);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const lang = language as "en" | "ar";

  const features = [
    {
      id: "wakti-ai",
      icon: Sparkles,
      title: "WAKTI AI",
      titleAr: "وقتي AI",
      description: "Chat, Search, Web Search, YouTube, Study Mode, and Live Talk. Premium AI for daily life.",
      descriptionAr: "دردشة وبحث وبحث ويب ويوتيوب ووضع الدراسة ومحادثة مباشرة. ذكاء اصطناعي بريميوم لحياتك اليومية.",
      accentColor: "hsl(25, 95%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(25, 95%, 60%) 0%, hsl(45, 100%, 60%) 100%)",
    },
    {
      id: "image-generator",
      icon: ImageIcon,
      title: "Image Generator",
      titleAr: "مولد الصور",
      description: "Generate stunning images instantly from ideas to visuals in seconds. Image to image, text to image, draw and generate. Sketch ideas and scenes with AI assisted drawing.",
      descriptionAr: "أنشئ صوراً مذهلة فوراً من الفكرة إلى الصورة خلال ثوانٍ. صورة إلى صورة، نص إلى صورة، ارسم وأنشئ. ارسم أفكارك ومشاهدك بمساعدة الذكاء الاصطناعي.",
      accentColor: "hsl(210, 100%, 65%)",
      glowColor: "linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(180, 85%, 60%) 100%)",
    },
    {
      id: "tasks-reminders",
      icon: Calendar,
      title: "Tasks & Reminders",
      titleAr: "المهام والتذكيرات",
      description: "Share tasks and subtasks with family, friends, or coworkers and sync progress in real time across devices.",
      descriptionAr: "شارك المهام والمهام الفرعية مع العائلة أو الأصدقاء أو زملاء العمل وتزامن التقدم لحظيًا عبر الأجهزة.",
      accentColor: "hsl(160, 80%, 55%)",
      glowColor: "linear-gradient(135deg, hsl(160, 80%, 55%) 0%, hsl(142, 76%, 55%) 100%)",
    },
    {
      id: "maw3d-events",
      icon: Wand2,
      title: "Maw3d Events",
      titleAr: "مواعيد",
      description: "Fully customizable events with real time RSVP and comments.",
      descriptionAr: "فعاليات قابلة للتخصيص بالكامل مع RSVP وتعليقات لحظية.",
      accentColor: "hsl(320, 75%, 70%)",
      glowColor: "linear-gradient(135deg, hsl(320, 75%, 70%) 0%, hsl(280, 70%, 65%) 100%)",
    },
    {
      id: "tasjeel-voice-recorder",
      icon: AudioLines,
      title: "Tasjeel Voice Recorder",
      titleAr: "تسجيل الصوت",
      description: "Record meetings and moments, then search, transcribe, and summarize anytime.",
      descriptionAr: "سجّل الاجتماعات واللحظات ثم ابحث وانسخ ولخّص في أي وقت.",
      accentColor: "hsl(180, 85%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(180, 85%, 60%) 0%, hsl(210, 100%, 65%) 100%)",
    },
    {
      id: "contacts-messaging",
      icon: MessageCircle,
      title: "Contacts & Messaging",
      titleAr: "جهات الاتصال والرسائل",
      description: "Stay connected. Add contacts, send messages, and receive replies.",
      descriptionAr: "ابقَ على تواصل. أضف جهات اتصال وأرسل رسائل واستقبل الردود.",
      accentColor: "hsl(210, 100%, 65%)",
      glowColor: "linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(180, 85%, 60%) 100%)",
    },
    {
      id: "vitality",
      icon: HeartPulse,
      title: "Vitality",
      titleAr: "الحيوية",
      description: "Connect WHOOP and your health data for smarter daily insights.",
      descriptionAr: "اربط WHOOP وبياناتك الصحية للحصول على رؤى يومية أذكى.",
      accentColor: "hsl(25, 95%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(25, 95%, 60%) 0%, hsl(45, 100%, 60%) 100%)",
    },
    {
      id: "journal",
      icon: NotebookPen,
      title: "Journal",
      titleAr: "اليوميات",
      description: "Write daily notes, track your mood, and turn reflection into progress.",
      descriptionAr: "اكتب ملاحظات يومية وتتبع مزاجك وحوّل التأمل إلى تقدم.",
      accentColor: "hsl(320, 75%, 70%)",
      glowColor: "linear-gradient(135deg, hsl(320, 75%, 70%) 0%, hsl(280, 70%, 65%) 100%)",
    },
    {
      id: "smart-text-generator",
      icon: PenTool,
      title: "Smart Text Generator",
      titleAr: "مولد النص الذكي",
      description: "Write, rewrite, summarize, translate, and generate content in seconds.",
      descriptionAr: "اكتب وأعد الصياغة ولخّص وترجم وأنشئ محتوى خلال ثوانٍ.",
      accentColor: "hsl(280, 70%, 65%)",
      glowColor: "linear-gradient(135deg, hsl(280, 70%, 65%) 0%, hsl(320, 75%, 70%) 100%)",
    },
    {
      id: "ai-games",
      icon: Gamepad2,
      title: "AI Games",
      titleAr: "ألعاب الذكاء الاصطناعي",
      description: "Play fun, fast games built for friends and families.",
      descriptionAr: "العب ألعاباً ممتعة وسريعة للأصدقاء والعائلة.",
      accentColor: "hsl(320, 75%, 70%)",
      glowColor: "linear-gradient(135deg, hsl(320, 75%, 70%) 0%, hsl(280, 70%, 65%) 100%)",
    },
    {
      id: "voice-cloning",
      icon: Mic,
      title: "Voice Cloning",
      titleAr: "استنساخ الصوت",
      description: "Clone your voice and generate natural speech for any text.",
      descriptionAr: "استنسخ صوتك وأنشئ كلامًا طبيعيًا لأي نص.",
      accentColor: "hsl(25, 95%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(25, 95%, 60%) 0%, hsl(45, 100%, 60%) 100%)",
    },
    {
      icon: Music,
      id: "studio",
      title: "Studio",
      titleAr: "الاستوديو",
      description: "Generate original music and create short videos from images with templates, text overlays, transitions, and audio.",
      descriptionAr: "أنشئ موسيقى أصلية واصنع فيديوهات قصيرة من الصور مع قوالب ونصوص وانتقالات وصوت.",
      accentColor: "hsl(280, 70%, 65%)",
      glowColor: "linear-gradient(135deg, hsl(280, 70%, 65%) 0%, hsl(320, 75%, 70%) 100%)",
    },
    {
      id: "voice-translation",
      icon: Languages,
      title: "Voice Translation",
      titleAr: "ترجمة الصوت",
      description: "Translate audio and voice between languages with clear playback.",
      descriptionAr: "ترجم الصوت بين اللغات مع تشغيل واضح.",
      accentColor: "hsl(180, 85%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(180, 85%, 60%) 0%, hsl(210, 100%, 65%) 100%)",
    },
    {
      id: "wakti-presentations",
      icon: MonitorPlay,
      title: "Wakti Presentations",
      titleAr: "عروض وقتي",
      description: "Create presentations and clean diagrams fast. Structured, beautiful, and ready to share.",
      descriptionAr: "أنشئ عروضًا ومخططات واضحة بسرعة. منظمة وجميلة وجاهزة للمشاركة.",
      accentColor: "hsl(180, 85%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(180, 85%, 60%) 0%, hsl(210, 100%, 65%) 100%)",
    },
  ];

  return (
    <div 
      ref={containerRef}
      className="scroll-snap-container scrollbar-hide"
      style={{ 
        height: "100dvh",
        overflowY: "scroll",
        overflowX: "hidden",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        paddingBottom: "72px",
      }}
    >
      {showScrollTop && (
        <button
          type="button"
          onClick={() => {
            containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-[#0c0f14]/70 border border-blue-400/25 backdrop-blur-xl text-blue-100 shadow-[0_0_26px_hsla(210,100%,65%,0.45)] transition-all duration-300 hover:shadow-[0_0_34px_hsla(210,100%,65%,0.65)] hover:bg-blue-500/10 active:scale-95"
          aria-label="Scroll to top"
        >
          <span className="block text-lg leading-none">^</span>
        </button>
      )}

      {/* Scene 1: Hero */}
      <HeroScene language={lang} />

      {/* Scenes 2-5: Feature Showcases */}
      {features.map((feature) => (
        <FeatureShowcase
          key={feature.id}
          id={feature.id}
          icon={feature.icon}
          title={feature.title}
          titleAr={feature.titleAr}
          description={feature.description}
          descriptionAr={feature.descriptionAr}
          accentColor={feature.accentColor}
          glowColor={feature.glowColor}
          language={lang}
        />
      ))}

      {/* Scene 6: Pricing */}
      <PricingScene language={lang} />

      {/* Scene 7: Invitation / Final CTA */}
      <InvitationScene language={lang} />

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="w-full border-t border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="flex items-center justify-center gap-3 text-[11px] text-white/60">
              <Link to="/privacy-terms" className="hover:text-white/80 transition-colors">
                {lang === "ar" ? "الخصوصية والشروط" : "Privacy & Terms"}
              </Link>
              <span className="text-white/40">•</span>
              <Link to="/contact" className="hover:text-white/80 transition-colors">
                {lang === "ar" ? "تواصل معنا" : "Contact Us"}
              </Link>
              <span className="text-white/40">•</span>
              <Link
                to="/login"
                className="rounded-full px-3 py-1 bg-[#0c0f14]/60 text-white/85 border border-blue-400/25 backdrop-blur-xl shadow-[0_0_18px_hsla(210,100%,65%,0.35)] hover:text-white hover:bg-blue-500/10 hover:border-blue-300/40 hover:shadow-[0_0_26px_hsla(210,100%,65%,0.55)] transition-all"
              >
                {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
              </Link>
              <span className="text-white/40">•</span>
              <a
                href="https://tmw.qa"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/80 transition-colors"
              >
                {lang === "ar" ? "صنع بواسطة TMW" : "Made by TMW"}
              </a>
            </div>
            <div className="mt-1 text-center text-[11px] text-white/40">
              © 2025 WAKTI. {lang === "ar" ? "جميع الحقوق محفوظة" : "All Rights Reserved"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
