import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Bot, Calendar, Mic, Wand2 } from "lucide-react";

// Landing components
import { HeroScene } from "@/components/landing/HeroScene";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { PricingScene } from "@/components/landing/PricingScene";
import { InvitationScene } from "@/components/landing/InvitationScene";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

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

  const lang = language as "en" | "ar";

  const features = [
    {
      id: "ai-assistant",
      icon: Bot,
      title: "Your Intelligent Partner",
      titleAr: "شريكك الذكي",
      description: "AI that understands you, learns from you, and helps you achieve more every day.",
      descriptionAr: "ذكاء اصطناعي يفهمك ويتعلم منك ويساعدك على تحقيق المزيد كل يوم.",
      accentColor: "hsl(260, 70%, 65%)",
      glowColor: "linear-gradient(135deg, hsl(260, 70%, 65%) 0%, hsl(280, 60%, 55%) 100%)",
    },
    {
      id: "tasks-events",
      icon: Calendar,
      title: "Organize Your Life",
      titleAr: "نظّم حياتك",
      description: "Tasks, events, and reminders that sync seamlessly across your day.",
      descriptionAr: "مهام وأحداث وتذكيرات تتزامن بسلاسة طوال يومك.",
      accentColor: "hsl(160, 80%, 55%)",
      glowColor: "linear-gradient(135deg, hsl(160, 80%, 55%) 0%, hsl(180, 70%, 45%) 100%)",
    },
    {
      id: "voice-recording",
      icon: Mic,
      title: "Speak Your Mind",
      titleAr: "عبّر بصوتك",
      description: "Record, transcribe, and summarize with the power of your voice.",
      descriptionAr: "سجّل وانسخ ولخّص بقوة صوتك.",
      accentColor: "hsl(25, 95%, 60%)",
      glowColor: "linear-gradient(135deg, hsl(25, 95%, 60%) 0%, hsl(45, 90%, 55%) 100%)",
    },
    {
      id: "creative-tools",
      icon: Wand2,
      title: "Unleash Creativity",
      titleAr: "أطلق إبداعك",
      description: "Generate images, music, and presentations with a single thought.",
      descriptionAr: "أنشئ صوراً وموسيقى وعروضاً تقديمية بفكرة واحدة.",
      accentColor: "hsl(320, 75%, 70%)",
      glowColor: "linear-gradient(135deg, hsl(320, 75%, 70%) 0%, hsl(280, 70%, 65%) 100%)",
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
      }}
    >
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
    </div>
  );
}
