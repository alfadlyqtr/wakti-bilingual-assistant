
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";
import { Check, ArrowRight, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useTheme();
  
  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

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
      feature4Desc: "Full Arabic and English language support"
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
      feature4Desc: "دعم كامل للغتين العربية والإنجليزية"
    }
  };
  
  const t = translations[language];
  
  // Define colors based on theme
  const primaryBg = theme === "dark" ? "bg-dark-bg" : "bg-light-bg";
  const primaryText = theme === "dark" ? "text-white" : "text-light-primary";
  const accentBg = theme === "dark" ? "bg-dark-tertiary/30" : "bg-light-secondary/30";
  const [pricingPlan, setPricingPlan] = useState("monthly");

  return (
    <div className="mobile-container">
      <AppHeader showUserMenu={false} title="WAKTI" />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Hero Section */}
        <section className={`${primaryBg} px-4 py-6 text-center`}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <Logo3D size="lg" className="mx-auto mb-5" />
            <h1 className={`text-2xl font-bold mb-2 ${primaryText}`}>{t.tagline}</h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{t.description}</p>
            
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/signup')}
              >
                {t.trial}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              
              <Button 
                variant="outline"
                size="sm" 
                className="w-fit mx-auto"
                onClick={() => navigate('/login')}
              >
                {t.loginBtn}
              </Button>
            </div>
          </motion.div>
        </section>
        
        {/* Features Section - Stacked Cards */}
        <section className="px-4 py-8">
          <h2 className="text-lg font-semibold mb-5 text-center">{t.featureSectionTitle}</h2>
          
          <div className="space-y-3 max-w-xs mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="p-3 border shadow-sm">
                <h3 className="font-medium text-base mb-1">{t.feature1Title}</h3>
                <p className="text-xs text-muted-foreground">{t.feature1Desc}</p>
              </Card>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-3 border shadow-sm">
                <h3 className="font-medium text-base mb-1">{t.feature2Title}</h3>
                <p className="text-xs text-muted-foreground">{t.feature2Desc}</p>
              </Card>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="p-3 border shadow-sm">
                <h3 className="font-medium text-base mb-1">{t.feature3Title}</h3>
                <p className="text-xs text-muted-foreground">{t.feature3Desc}</p>
              </Card>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card className="p-3 border shadow-sm">
                <h3 className="font-medium text-base mb-1">{t.feature4Title}</h3>
                <p className="text-xs text-muted-foreground">{t.feature4Desc}</p>
              </Card>
            </motion.div>
          </div>
        </section>
        
        {/* Pricing Section with Toggle */}
        <section className={`${accentBg} px-4 py-8 rounded-lg mx-4`}>
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 bg-background rounded-full p-1 border mb-6">
              <Button 
                size="sm" 
                variant={pricingPlan === "monthly" ? "default" : "ghost"}
                className="rounded-full text-xs px-4"
                onClick={() => setPricingPlan("monthly")}
              >
                {t.monthly}
              </Button>
              <Button 
                size="sm"
                variant={pricingPlan === "yearly" ? "default" : "ghost"}
                className="rounded-full text-xs px-4"
                onClick={() => setPricingPlan("yearly")}
              >
                {t.yearly}
              </Button>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-card rounded-lg p-5 shadow-sm border max-w-xs mx-auto"
              key={pricingPlan}
            >
              <div className="flex justify-between items-baseline mb-4">
                <h3 className="text-lg font-semibold">
                  {pricingPlan === "monthly" ? t.monthlyPrice : t.yearlyPrice}
                </h3>
                {pricingPlan === "yearly" && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {language === 'en' ? 'SAVE 17%' : 'وفر 17٪'}
                  </span>
                )}
              </div>
              
              <ul className="space-y-2 mb-5 text-sm">
                <li className="flex items-start">
                  <CircleCheck className="h-4 w-4 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature1Title}</span>
                </li>
                <li className="flex items-start">
                  <CircleCheck className="h-4 w-4 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature2Title}</span>
                </li>
                <li className="flex items-start">
                  <CircleCheck className="h-4 w-4 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature3Title}</span>
                </li>
                <li className="flex items-start">
                  <CircleCheck className="h-4 w-4 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature4Title}</span>
                </li>
              </ul>
              
              <Button
                className="w-full"
                onClick={() => navigate('/signup')}
              >
                {t.trial}
              </Button>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
