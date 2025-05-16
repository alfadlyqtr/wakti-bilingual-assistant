
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";

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
      welcome: "Welcome to WAKTI",
      tagline: "Your Bilingual Productivity Assistant",
      description: "Manage tasks, events, reminders and more with AI-powered productivity tools",
      loginBtn: "Login",
      signupBtn: "Sign Up",
      features: "Key Features",
      pricing: "Pricing",
      trial: "Start 3-Day Free Trial",
      monthly: "Monthly",
      yearly: "Yearly (Save 17%)",
      monthlyPrice: "55 QAR/month",
      yearlyPrice: "550 QAR/year",
      featureSectionTitle: "Boost your productivity",
      featureSectionSubtitle: "Everything you need in one place",
      feature1Title: "Smart Task Management",
      feature1Desc: "Create, prioritize, and share tasks with advanced AI sorting",
      feature2Title: "Event Planning",
      feature2Desc: "Schedule events with RSVP, maps and calendar integration",
      feature3Title: "Voice Summaries",
      feature3Desc: "Create audio summaries with AI transcription and analysis",
      feature4Title: "AI Assistant",
      feature4Desc: "Get task recommendations and summarize your day",
      feature5Title: "Messaging",
      feature5Desc: "Secure, expiring messages with your contacts",
      feature6Title: "Bilingual Support",
      feature6Desc: "Full Arabic and English language support"
    },
    ar: {
      welcome: "مرحبًا بك في وقتي",
      tagline: "مساعدك الإنتاجي ثنائي اللغة",
      description: "إدارة المهام والفعاليات والتذكيرات والمزيد مع أدوات الإنتاجية المدعومة بالذكاء الاصطناعي",
      loginBtn: "تسجيل الدخول",
      signupBtn: "إنشاء حساب",
      features: "المميزات الرئيسية",
      pricing: "الأسعار",
      trial: "ابدأ التجربة المجانية لمدة 3 أيام",
      monthly: "شهري",
      yearly: "سنوي (وفر 17٪)",
      monthlyPrice: "55 ر.ق/شهر",
      yearlyPrice: "550 ر.ق/سنة",
      featureSectionTitle: "عزز إنتاجيتك",
      featureSectionSubtitle: "كل ما تحتاجه في مكان واحد",
      feature1Title: "إدارة المهام الذكية",
      feature1Desc: "إنشاء وترتيب ومشاركة المهام مع فرز متقدم بالذكاء الاصطناعي",
      feature2Title: "تخطيط الفعاليات",
      feature2Desc: "جدولة الفعاليات مع تأكيد الحضور والخرائط ودمج التقويم",
      feature3Title: "ملخصات صوتية",
      feature3Desc: "إنشاء ملخصات صوتية مع النسخ والتحليل بالذكاء الاصطناعي",
      feature4Title: "المساعد الذكي",
      feature4Desc: "احصل على توصيات للمهام وملخص ليومك",
      feature5Title: "المراسلة",
      feature5Desc: "رسائل آمنة تنتهي صلاحيتها مع جهات اتصالك",
      feature6Title: "دعم ثنائي اللغة",
      feature6Desc: "دعم كامل للغتين العربية والإنجليزية"
    }
  };
  
  const t = translations[language];
  
  // Define primary colors based on theme
  const primaryBg = theme === "dark" ? "bg-dark-bg" : "bg-light-bg";
  const primaryText = theme === "dark" ? "text-white" : "text-light-primary";
  const secondaryBg = theme === "dark" ? "bg-dark-secondary" : "bg-light-secondary";
  const accentBg = theme === "dark" ? "bg-dark-tertiary" : "bg-light-secondary";

  return (
    <div className="mobile-container">
      <header className="mobile-header sticky top-0 z-20 border-b">
        <div className="flex items-center">
          <Logo3D size="sm" className="mr-2" />
          <h1 className="text-lg font-bold">WAKTI</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex"
            onClick={() => navigate('/login')}
          >
            {t.loginBtn}
          </Button>
          <ThemeLanguageToggle />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Hero Section */}
        <section className={`${primaryBg} px-4 py-12`}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <Logo3D size="lg" className="mx-auto mb-6" />
            <h1 className={`text-3xl font-bold mb-2 ${primaryText}`}>{t.welcome}</h1>
            <p className="text-lg text-muted-foreground mb-3">{t.tagline}</p>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">{t.description}</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
              <Button 
                size="lg" 
                className="px-6"
                onClick={() => navigate('/login')}
              >
                {t.loginBtn}
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-6"
                onClick={() => navigate('/signup')}
              >
                {t.signupBtn}
              </Button>
            </div>
            
            <Button
              variant="secondary"
              size="lg" 
              className="group"
              onClick={() => navigate('/signup')}
            >
              {t.trial}
              <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </section>
        
        {/* Features Section */}
        <section className="px-4 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">{t.featureSectionTitle}</h2>
            <p className="text-muted-foreground">{t.featureSectionSubtitle}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature1Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature1Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature2Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature2Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature3Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature3Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature4Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature4Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature5Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature5Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-card rounded-lg p-5 shadow-sm border"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature6Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature6Desc}</p>
            </motion.div>
          </div>
        </section>
        
        {/* Pricing Section */}
        <section className={`${accentBg} px-4 py-12`}>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-8">{t.pricing}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Monthly Plan */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-card rounded-lg p-6 shadow-lg border"
              >
                <h3 className="text-xl font-semibold mb-2">{t.monthly}</h3>
                <p className="text-3xl font-bold mb-4">{t.monthlyPrice}</p>
                <div className="space-y-3 mb-6 text-left">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature1Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature2Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature3Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature4Title}</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => navigate('/signup')}
                >
                  {t.trial}
                </Button>
              </motion.div>
              
              {/* Yearly Plan */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-card rounded-lg p-6 shadow-lg border border-primary"
              >
                <div className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full w-fit mx-auto mb-2">
                  {language === 'en' ? 'BEST VALUE' : 'أفضل قيمة'}
                </div>
                <h3 className="text-xl font-semibold mb-2">{t.yearly}</h3>
                <p className="text-3xl font-bold mb-4">{t.yearlyPrice}</p>
                <div className="space-y-3 mb-6 text-left">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature1Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature2Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature3Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature4Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature5Title}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    <span className="text-sm">{t.feature6Title}</span>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => navigate('/signup')}
                >
                  {t.trial}
                </Button>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
