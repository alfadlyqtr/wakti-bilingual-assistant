
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";
import { Check, ArrowRight, CircleCheck, Sparkles, Brain, Robot, Wand } from "lucide-react";
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
      feature4Desc: "Full Arabic and English language support",
      aiSectionTitle: "WAKTI AI Assistant",
      aiFeature1Title: "Smart Task Generation",
      aiFeature1Desc: "Create tasks from natural language descriptions",
      aiFeature2Title: "Intelligent Summarization",
      aiFeature2Desc: "Get summaries of meetings, articles and voice recordings",
      aiFeature3Title: "Creative Content Creation",
      aiFeature3Desc: "Generate text, charts, and images for your projects",
      aiFeature4Title: "Learning & Tutoring",
      aiFeature4Desc: "Get help with complex topics and learning new skills"
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
      aiSectionTitle: "مساعد واكتي الذكي",
      aiFeature1Title: "إنشاء المهام الذكية",
      aiFeature1Desc: "إنشاء المهام من وصف اللغة الطبيعية",
      aiFeature2Title: "تلخيص ذكي",
      aiFeature2Desc: "الحصول على ملخصات للاجتماعات والمقالات والتسجيلات الصوتية",
      aiFeature3Title: "إنشاء محتوى إبداعي",
      aiFeature3Desc: "إنشاء نصوص ورسوم بيانية وصور لمشاريعك",
      aiFeature4Title: "التعلم والتدريس",
      aiFeature4Desc: "الحصول على مساعدة في المواضيع المعقدة وتعلم مهارات جديدة"
    }
  };
  
  const t = translations[language];
  
  // Define colors based on theme
  const primaryBg = theme === "dark" ? "bg-dark-bg" : "bg-light-bg";
  const primaryText = theme === "dark" ? "text-white" : "text-light-primary";
  const accentBg = theme === "dark" ? "bg-dark-tertiary/20" : "bg-light-secondary/20";
  const [pricingPlan, setPricingPlan] = useState("monthly");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <div className="mobile-container">
      <AppHeader showUserMenu={false} title="WAKTI" />
      
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Hero Section */}
        <section className={`${primaryBg} px-4 py-6`}>
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="mb-6"
          >
            <motion.div variants={itemVariants}>
              <Logo3D size="lg" className="mx-auto mb-2" />
            </motion.div>
            
            <motion.h1 
              variants={itemVariants} 
              className={`text-3xl font-bold mb-2 ${primaryText}`}
            >
              {t.tagline}
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto"
            >
              {t.description}
            </motion.p>
            
            <motion.div variants={itemVariants} className="mt-6 flex flex-col gap-3 max-w-xs mx-auto">
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={() => navigate('/signup')}
              >
                {t.trial}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          </motion.div>
        </section>
        
        {/* Features Section with Modern Cards */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="px-4 py-8"
        >
          <motion.h2 
            variants={itemVariants}
            className="text-xl font-bold mb-6 text-center"
          >
            {t.featureSectionTitle}
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <CircleCheck className="h-5 w-5 mr-2 text-blue-500" /> {t.feature1Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.feature1Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-purple-500 to-pink-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <CircleCheck className="h-5 w-5 mr-2 text-purple-500" /> {t.feature2Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.feature2Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-amber-500 to-orange-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <CircleCheck className="h-5 w-5 mr-2 text-amber-500" /> {t.feature3Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.feature3Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-green-500 to-teal-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <CircleCheck className="h-5 w-5 mr-2 text-green-500" /> {t.feature4Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.feature4Desc}</p>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.section>
        
        {/* WAKTI AI Section */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
          className="px-4 py-8 bg-gradient-to-b from-transparent to-blue-500/5 rounded-t-3xl"
        >
          <motion.h2 
            variants={itemVariants}
            className="text-xl font-bold mb-6 text-center flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5 text-blue-500" />
            {t.aiSectionTitle}
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg bg-background/80 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-indigo-500 to-blue-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <Robot className="h-5 w-5 mr-2 text-indigo-500" /> {t.aiFeature1Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.aiFeature1Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg bg-background/80 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-violet-500 to-purple-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-violet-500" /> {t.aiFeature2Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.aiFeature2Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg bg-background/80 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-fuchsia-500 to-pink-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <Wand className="h-5 w-5 mr-2 text-fuchsia-500" /> {t.aiFeature3Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.aiFeature3Desc}</p>
                </div>
              </Card>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-0 shadow-lg bg-background/80 backdrop-blur-sm">
                <div className="bg-gradient-to-r from-cyan-500 to-teal-400 h-2"></div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1 flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-cyan-500" /> {t.aiFeature4Title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.aiFeature4Desc}</p>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.section>
        
        {/* Pricing Section with Modern Design */}
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={containerVariants}
          className={`px-4 py-8 mx-4 my-4 rounded-2xl ${accentBg} backdrop-blur-sm`}
        >
          <motion.div 
            variants={itemVariants}
            className="text-center mb-5"
          >
            <div className="inline-flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full p-1 border mb-6 shadow-sm">
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
              key={pricingPlan}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-background/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border max-w-xs mx-auto"
            >
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="text-2xl font-bold">
                  {pricingPlan === "monthly" ? t.monthlyPrice : t.yearlyPrice}
                </h3>
                {pricingPlan === "yearly" && (
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                    {language === 'en' ? 'SAVE 17%' : 'وفر 17٪'}
                  </span>
                )}
              </div>
              
              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-start">
                  <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature1Title}</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature2Title}</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature3Title}</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 mr-2 shrink-0 text-primary mt-0.5" />
                  <span>{t.feature4Title}</span>
                </li>
              </ul>
              
              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={() => navigate('/signup')}
              >
                {t.trial}
              </Button>
            </motion.div>
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
}
