
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Check,
  Calendar,
  Bell,
  MessageSquare,
  List,
} from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export default function Home() {
  const navigate = useNavigate();
  const { theme, language, toggleLanguage } = useTheme();

  // Direct text values for features instead of translation keys
  const features = language === "en" ? [
    {
      icon: List,
      title: "Task Management",
      description: "Smart task organization with priorities and sharing",
    },
    {
      icon: Calendar,
      title: "Calendar",
      description: "Unified calendar for events, tasks and reminders",
    },
    {
      icon: Bell,
      title: "Reminders",
      description: "Smart reminders with recurring options",
    },
    {
      icon: MessageSquare,
      title: "Messaging",
      description: "Secure messaging with voice and text",
    },
  ] : [
    {
      icon: List,
      title: "إدارة المهام",
      description: "تنظيم ذكي للمهام مع الأولويات والمشاركة",
    },
    {
      icon: Calendar,
      title: "التقويم",
      description: "تقويم موحد للأحداث والمهام والتذكيرات",
    },
    {
      icon: Bell,
      title: "التذكيرات",
      description: "تذكيرات ذكية مع خيارات التكرار",
    },
    {
      icon: MessageSquare,
      title: "المراسلة",
      description: "مراسلة آمنة بالصوت والنص",
    },
  ];

  const pricingPlans = language === "en" ? [
    {
      title: "Monthly",
      priceQAR: 55,
      priceUSD: 15,
    },
    {
      title: "Yearly",
      priceQAR: 550,
      priceUSD: 150,
    },
  ] : [
    {
      title: "شهري",
      priceQAR: 55,
      priceUSD: 15,
    },
    {
      title: "سنوي",
      priceQAR: 550,
      priceUSD: 150,
    },
  ];

  // Direct content based on language without translation keys
  const content = {
    en: {
      appName: "WAKTI",
      tagline: "Manage your time efficiently",
      features: "Features",
      pricing: "Pricing",
      freeTrialDays: "3-Day Free Trial",
      taskManagement: "Task Management",
      aiSummaries: "AI Summaries",
      startFreeTrial: "Start Free Trial",
      login: "Login",
      qar: "QAR",
      usd: "USD",
    },
    ar: {
      appName: "واكتي",
      tagline: "إدارة وقتك بكفاءة",
      features: "الميزات",
      pricing: "التسعير",
      freeTrialDays: "3 أيام تجربة مجانية",
      taskManagement: "إدارة المهام",
      aiSummaries: "ملخصات الذكاء الاصطناعي",
      startFreeTrial: "ابدأ النسخة التجريبية المجانية",
      login: "تسجيل الدخول",
      qar: "ريال",
      usd: "دولار",
    }
  };

  const currentContent = content[language];

  return (
    <div className={`mobile-container ${language === 'ar' ? 'rtl' : ''}`}>
      <header className="mobile-header">
        <h1 className="text-2xl font-bold">{currentContent.appName}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="h-9 px-3 rounded-full text-sm"
          >
            {language === "en" ? "العربية" : "English"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <section className="py-6 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6"
          >
            <div className="mb-4 flex justify-center">
              <div className="w-24 h-24 relative">
                <AspectRatio ratio={1/1} className="bg-primary-900 rounded-2xl overflow-hidden">
                  <img 
                    src="/lovable-uploads/33ebdcdd-300d-42cf-be5e-f6a82ca9ef4d.png" 
                    alt="WAKTI Logo"
                    className="object-cover w-full h-full"
                  />
                </AspectRatio>
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-2">{currentContent.appName}</h1>
            <p className="text-xl text-muted-foreground mb-6">
              {currentContent.tagline}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full text-base py-6"
                onClick={() => navigate("/signup")}
              >
                {currentContent.startFreeTrial}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full text-base py-6"
                onClick={() => navigate("/login")}
              >
                {currentContent.login}
              </Button>
            </div>
          </motion.div>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold mb-5 text-center">
              {currentContent.features}
            </h2>
            <div className="grid grid-cols-1 gap-4 mb-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-card p-4 rounded-xl shadow-sm border border-border"
                >
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-2 rounded-lg mr-4">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Pricing Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-10"
          >
            <h2 className="text-2xl font-bold mb-5 text-center">
              {currentContent.pricing}
            </h2>
            <div className="bg-card p-4 rounded-xl border border-border mb-4">
              <p className="text-center font-medium mb-2">
                {currentContent.freeTrialDays}
              </p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">
                    {currentContent.features} {currentContent.taskManagement}
                  </span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">
                    {currentContent.aiSummaries}
                  </span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {pricingPlans.map((plan, index) => (
                <div
                  key={index}
                  className="bg-card p-4 rounded-xl border border-border text-center"
                >
                  <h3 className="font-medium mb-2">
                    {plan.title}
                  </h3>
                  <div className="text-2xl font-bold mb-1">
                    {plan.priceQAR} {currentContent.qar}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ≈ {plan.priceUSD} {currentContent.usd}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
