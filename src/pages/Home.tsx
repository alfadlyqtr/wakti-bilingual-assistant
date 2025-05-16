
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  
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
      features: "Features",
      feature1Title: "Smart Task Management",
      feature1Desc: "Create, prioritize, and share tasks with advanced AI sorting",
      feature2Title: "Event Planning",
      feature2Desc: "Schedule events with RSVP, maps and calendar integration",
      feature3Title: "Voice Summaries",
      feature3Desc: "Create audio summaries with AI transcription and analysis"
    },
    ar: {
      welcome: "مرحبًا بك في وقتي",
      tagline: "مساعدك الإنتاجي ثنائي اللغة",
      description: "إدارة المهام والفعاليات والتذكيرات والمزيد مع أدوات الإنتاجية المدعومة بالذكاء الاصطناعي",
      loginBtn: "تسجيل الدخول",
      signupBtn: "إنشاء حساب",
      features: "المميزات",
      feature1Title: "إدارة المهام الذكية",
      feature1Desc: "إنشاء وترتيب ومشاركة المهام مع فرز متقدم بالذكاء الاصطناعي",
      feature2Title: "تخطيط الفعاليات",
      feature2Desc: "جدولة الفعاليات مع تأكيد الحضور والخرائط ودمج التقويم",
      feature3Title: "ملخصات صوتية",
      feature3Desc: "إنشاء ملخصات صوتية مع النسخ والتحليل بالذكاء الاصطناعي"
    }
  };
  
  const t = translations[language];

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Logo3D size="sm" className="mr-2" />
          <h1 className="text-lg font-bold">WAKTI</h1>
        </div>
        <ThemeLanguageToggle />
      </header>
      
      <div className="flex-1 overflow-y-auto pb-16">
        <div className="px-4 py-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <Logo3D size="lg" className="mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-2">{t.welcome}</h1>
            <p className="text-lg text-muted-foreground mb-6">{t.tagline}</p>
            <p className="text-sm text-muted-foreground mb-8">{t.description}</p>
            
            <div className="flex justify-center gap-4">
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
          </motion.div>
          
          <div className="space-y-8 mt-12">
            <h2 className="text-xl font-semibold text-center mb-6">{t.features}</h2>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-card rounded-lg p-4 shadow-sm"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature1Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature1Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-card rounded-lg p-4 shadow-sm"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature2Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature2Desc}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-card rounded-lg p-4 shadow-sm"
            >
              <h3 className="font-medium text-lg mb-2">{t.feature3Title}</h3>
              <p className="text-muted-foreground text-sm">{t.feature3Desc}</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
