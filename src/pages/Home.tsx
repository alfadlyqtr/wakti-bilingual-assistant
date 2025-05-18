
import { useTheme } from "@/providers/ThemeProvider";
import { AppHeader } from "@/components/AppHeader";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomeAICapabilities } from "@/components/home/HomeAICapabilities";
import { HomePricing } from "@/components/home/HomePricing";

export default function Home() {
  const { language, theme } = useTheme();
  
  const translations = {
    en: {
      tagline: "AI Productivity Assistant",
      description: "Manage tasks, events, reminders with AI-powered productivity tools",
      loginBtn: "Login",
      trial: "Start 3-Day Free Trial",
      monthly: "Monthly",
      yearly: "Yearly (Save 17%)",
      monthlyPrice: "55 QAR",
      yearlyPrice: "550 QAR",
      featureSectionTitle: "Boost your productivity",
      feature1Title: "Smart Task Management",
      feature1Desc: "Create, prioritize, and share tasks with AI sorting",
      feature2Title: "Event Planning",
      feature2Desc: "Schedule events with RSVP and map integration",
      feature3Title: "Voice Summaries",
      feature3Desc: "Create audio summaries with AI transcription",
      feature4Title: "Bilingual Support",
      feature4Desc: "Full Arabic and English language support",
      aiSectionTitle: "WAKTI AI Capabilities",
      aiFeature1Title: "Smart Task Generation",
      aiFeature1Desc: "Generate optimized tasks with priorities and deadlines",
      aiFeature2Title: "Content Summarization",
      aiFeature2Desc: "Create concise summaries from voice or text inputs",
      aiFeature3Title: "Creative Content",
      aiFeature3Desc: "Write professional content in multiple tones and styles",
      aiFeature4Title: "Learning Assistant",
      aiFeature4Desc: "Get guidance, tutoring, and knowledge on demand"
    },
    ar: {
      tagline: "مساعد الإنتاجية الذكي",
      description: "إدارة المهام والفعاليات والتذكيرات مع أدوات الإنتاجية المدعومة بالذكاء الاصطناعي",
      loginBtn: "تسجيل الدخول",
      trial: "ابدأ التجربة المجانية لمدة 3 أيام",
      monthly: "شهري",
      yearly: "سنوي (وفر 17٪)",
      monthlyPrice: "55 ر.ق",
      yearlyPrice: "550 ر.ق",
      featureSectionTitle: "عزز إنتاجيتك",
      feature1Title: "إدارة المهام الذكية",
      feature1Desc: "إنشاء وترتيب ومشاركة المهام مع فرز متقدم",
      feature2Title: "تخطيط الفعاليات",
      feature2Desc: "جدولة الفعاليات مع تأكيد الحضور والخرائط",
      feature3Title: "ملخصات صوتية",
      feature3Desc: "إنشاء ملخصات صوتية مع النسخ بالذكاء الاصطناعي",
      feature4Title: "دعم ثنائي اللغة",
      feature4Desc: "دعم كامل للغتين العربية والإنجليزية",
      aiSectionTitle: "إمكانيات الذكاء الاصطناعي في WAKTI",
      aiFeature1Title: "إنشاء المهام الذكية",
      aiFeature1Desc: "توليد مهام محسنة مع أولويات ومواعيد نهائية",
      aiFeature2Title: "تلخيص المحتوى",
      aiFeature2Desc: "إنشاء ملخصات موجزة من المدخلات الصوتية أو النصية",
      aiFeature3Title: "المحتوى الإبداعي",
      aiFeature3Desc: "كتابة محتوى احترافي بنبرات وأساليب متعددة",
      aiFeature4Title: "مساعد التعلم",
      aiFeature4Desc: "الحصول على التوجيه والدروس والمعرفة عند الطلب"
    }
  };
  
  const t = translations[language];
  
  // Define colors based on theme
  const primaryBg = theme === "dark" ? "bg-dark-bg" : "bg-light-bg";
  const accentBg = theme === "dark" ? "bg-dark-tertiary/20" : "bg-light-secondary/20";

  return (
    <div className="mobile-container">
      <AppHeader showUserMenu={false} title="WAKTI" />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Hero Section */}
        <HomeHero 
          translations={{
            tagline: t.tagline,
            description: t.description,
            trial: t.trial,
            loginBtn: t.loginBtn
          }} 
        />
        
        {/* Features Section */}
        <HomeFeatures
          translations={{
            featureSectionTitle: t.featureSectionTitle,
            feature1Title: t.feature1Title,
            feature1Desc: t.feature1Desc,
            feature2Title: t.feature2Title,
            feature2Desc: t.feature2Desc,
            feature3Title: t.feature3Title,
            feature3Desc: t.feature3Desc,
            feature4Title: t.feature4Title,
            feature4Desc: t.feature4Desc
          }}
        />
        
        {/* WAKTI AI Section */}
        <HomeAICapabilities
          translations={{
            aiSectionTitle: t.aiSectionTitle,
            aiFeature1Title: t.aiFeature1Title,
            aiFeature1Desc: t.aiFeature1Desc,
            aiFeature2Title: t.aiFeature2Title,
            aiFeature2Desc: t.aiFeature2Desc,
            aiFeature3Title: t.aiFeature3Title,
            aiFeature3Desc: t.aiFeature3Desc,
            aiFeature4Title: t.aiFeature4Title,
            aiFeature4Desc: t.aiFeature4Desc
          }}
        />
        
        {/* Pricing Section */}
        <HomePricing
          translations={{
            monthly: t.monthly,
            yearly: t.yearly,
            monthlyPrice: t.monthlyPrice,
            yearlyPrice: t.yearlyPrice,
            trial: t.trial,
            feature1Title: t.feature1Title,
            feature2Title: t.feature2Title,
            feature3Title: t.feature3Title,
            feature4Title: t.feature4Title
          }}
          accentBg={accentBg}
          language={language}
        />
      </div>
    </div>
  );
}
