import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { motion } from "framer-motion";
import { Check, ArrowRight, Sparkles, Bot, Calendar, Mic, Users, MessageSquare, LogIn, Zap, Star, Music, Globe, Image as ImageIcon, BookOpen, PencilRuler, Workflow, MonitorPlay, Video, Languages } from "lucide-react";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { t } from "@/utils/translations";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useTheme();
  
  // Autoplay state for carousels
  const [desktopApi, setDesktopApi] = useState<any>(null);
  const [mobileApi, setMobileApi] = useState<any>(null);
  
  // Desktop autoplay
  useEffect(() => {
    if (!desktopApi) return;
    
    const interval = setInterval(() => {
      if (desktopApi.canScrollNext()) {
        desktopApi.scrollNext();
      } else {
        desktopApi.scrollTo(0);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [desktopApi]);
  
  // Mobile autoplay
  useEffect(() => {
    if (!mobileApi) return;
    
    const interval = setInterval(() => {
      if (mobileApi.canScrollNext()) {
        mobileApi.scrollNext();
      } else {
        mobileApi.scrollTo(0);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [mobileApi]);

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Add public-page class to body for proper scrolling on desktop
  useEffect(() => {
    document.body.classList.add('public-page');
    return () => {
      document.body.classList.remove('public-page');
    };
  }, []);

  // Single monthly plan pricing (matches RevenueCat/Natively)
  const MONTHLY_PRICE_QAR = 95;
  const MONTHLY_PRICE_USD = 24.99;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const features = [
    {
      icon: Bot,
      title: t("waktiAiTitle", language),
      description: t("waktiAiDesc", language),
      gradient: "from-blue-500 via-purple-500 to-indigo-600",
      bgGradient: "from-blue-50 to-purple-50",
      iconColor: "text-blue-600"
    },
    {
      icon: ImageIcon,
      title: t("imageGenTitle", language),
      description: t("imageGenDesc", language),
      gradient: "from-sky-500 via-cyan-500 to-emerald-600",
      bgGradient: "from-sky-50 to-cyan-50",
      iconColor: "text-sky-600"
    },
    {
      icon: Calendar,
      title: t("tasksRemindersTitle", language),
      description: t("tasksRemindersDesc", language),
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
      bgGradient: "from-emerald-50 to-teal-50",
      iconColor: "text-emerald-600"
    },
    {
      icon: Sparkles,
      title: t("maw3dEventsTitle", language),
      description: t("maw3dEventsDesc", language),
      gradient: "from-pink-500 via-rose-500 to-red-600",
      bgGradient: "from-pink-50 to-rose-50",
      iconColor: "text-pink-600"
    },
    {
      icon: Mic,
      title: t("tasjeelRecorderTitle", language),
      description: t("tasjeelRecorderDesc", language),
      gradient: "from-amber-500 via-orange-500 to-red-600",
      bgGradient: "from-amber-50 to-orange-50",
      iconColor: "text-amber-600"
    },
    {
      icon: MessageSquare,
      title: t("contactsMessagingTitle", language),
      description: t("contactsMessagingDesc", language),
      gradient: "from-violet-500 via-purple-500 to-fuchsia-600",
      bgGradient: "from-violet-50 to-purple-50",
      iconColor: "text-violet-600"
    }
    ,
    {
      icon: Zap,
      title: t("vitalityTitle", language),
      description: t("vitalityDesc", language),
      gradient: "from-lime-500 via-green-500 to-emerald-600",
      bgGradient: "from-lime-50 to-emerald-50",
      iconColor: "text-emerald-600"
    },
    {
      icon: Calendar,
      title: t("journalTitle", language),
      description: t("journalDesc", language),
      gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
      bgGradient: "from-rose-50 to-pink-50",
      iconColor: "text-rose-600"
    },
    {
      icon: MessageSquare,
      title: t("smartTextTitle", language),
      description: t("smartTextDesc", language),
      gradient: "from-indigo-500 via-violet-500 to-purple-600",
      bgGradient: "from-indigo-50 to-violet-50",
      iconColor: "text-indigo-600"
    },
    {
      icon: Star,
      title: t("aiGamesTitle", language),
      description: t("aiGamesDesc", language),
      gradient: "from-amber-500 via-orange-500 to-red-600",
      bgGradient: "from-amber-50 to-orange-50",
      iconColor: "text-amber-600"
    },
    {
      icon: Mic,
      title: t("voiceCloningTitle", language),
      description: t("voiceCloningDesc", language),
      gradient: "from-cyan-500 via-sky-500 to-blue-600",
      bgGradient: "from-cyan-50 to-sky-50",
      iconColor: "text-sky-600"
    },
    {
      icon: Music,
      title: t("musicGenTitle", language),
      description: t("musicGenDesc", language),
      gradient: "from-purple-500 via-fuchsia-500 to-pink-600",
      bgGradient: "from-purple-50 to-fuchsia-50",
      iconColor: "text-fuchsia-600"
    },
    {
      icon: Globe,
      title: t("voiceTranslationTitle", language),
      description: t("voiceTranslationDesc", language),
      gradient: "from-teal-500 via-emerald-500 to-green-600",
      bgGradient: "from-teal-50 to-emerald-50",
      iconColor: "text-teal-600"
    },
    {
      icon: BookOpen,
      title: language === "en" ? "Study Mode" : "وضع الدراسة",
      description: language === "en" 
        ? "Turn any topic into simple explanations, flashcards, and practice questions so you can learn faster."
        : "حوّل أي موضوع إلى شروحات بسيطة وبطاقات تعليمية وأسئلة تدريبية لتتعلم بشكل أسرع.",
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
      bgGradient: "from-blue-50 to-indigo-50",
      iconColor: "text-blue-600"
    },
    {
      icon: PencilRuler,
      title: language === "en" ? "Draw Mode" : "وضع الرسم",
      description: language === "en"
        ? "Sketch ideas and scenes with AI-assisted drawing so you can visualize anything in seconds."
        : "ارسم أفكارك ومشاهدك بمساعدة الذكاء الاصطناعي لتتخيل أي شيء في ثوانٍ.",
      gradient: "from-pink-500 via-rose-500 to-purple-600",
      bgGradient: "from-pink-50 to-rose-50",
      iconColor: "text-pink-600"
    },
    {
      icon: Workflow,
      title: language === "en" ? "Create Diagrams" : "إنشاء المخططات",
      description: language === "en"
        ? "Turn messy text into clean diagrams and workflows so you can explain and present clearly."
        : "حوّل النصوص الفوضوية إلى مخططات وسير عمل واضحة لتشرح وتعرض بوضوح.",
      gradient: "from-emerald-500 via-teal-500 to-cyan-600",
      bgGradient: "from-emerald-50 to-teal-50",
      iconColor: "text-emerald-600"
    },
    {
      icon: MonitorPlay,
      title: t("waktiPresentationsTitle", language),
      description: t("waktiPresentationsDesc", language),
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      bgGradient: "from-cyan-50 to-blue-50",
      iconColor: "text-cyan-600"
    },
    {
      icon: Video,
      title: language === "en" ? "Video Editor" : "محرر الفيديو",
      description: language === "en"
        ? "Create short videos from images with templates, text overlays, transitions, and audio — ready to share."
        : "اصنع فيديوهات قصيرة من الصور مع قوالب ونصوص وانتقالات وصوت — جاهزة للمشاركة.",
      gradient: "from-purple-500 via-fuchsia-500 to-pink-600",
      bgGradient: "from-purple-50 to-fuchsia-50",
      iconColor: "text-fuchsia-600"
    },
    {
      icon: Languages,
      title: language === "en" ? "Live Translator" : "مترجم مباشر",
      description: language === "en"
        ? "Talk and translate in real-time with natural voice playback — perfect for quick conversations."
        : "تحدث وترجم لحظيًا مع صوت طبيعي — مثالي للمحادثات السريعة.",
      gradient: "from-teal-500 via-emerald-500 to-green-600",
      bgGradient: "from-teal-50 to-emerald-50",
      iconColor: "text-teal-600"
    }
  ];

  return (
    <>
      {/* Mobile Variant */}
      <div className="block md:hidden">
        <div className="mobile-container">
          <MobileHeader title="WAKTI" showUserMenu={false}>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 border-primary/20 hover:border-primary/40"
                onClick={() => navigate('/login')}
              >
                {t("login", language)}
                <LogIn className="h-4 w-4" />
              </Button>
              <ThemeLanguageToggle />
            </div>
          </MobileHeader>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {/* Hero Section */}
            <section className="relative px-4 py-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30">
              <div className="absolute inset-0 opacity-50"></div>
              
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 text-center"
              >
                <motion.div variants={itemVariants} className="mb-6">
                  <Logo3D size="lg" className="mx-auto mb-4" />
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      WAKTI
                    </h1>
                    <Zap className="h-6 w-6 text-yellow-500" />
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">
                    {t("mainTagline", language)}
                  </p>
                </motion.div>
                
                <motion.div variants={itemVariants} className="mb-6">
                  <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white bg-clip-text text-transparent">
                    {t("heroSubtitle", language)}
                  </h2>
                </motion.div>
                
                <motion.div variants={itemVariants} className="mb-8">
                  <Button
                    size="lg"
                    className="liquid-glass-btn w-full max-w-xs bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300"
                    onClick={() => navigate('/signup')}
                  >
                    <Star className="h-5 w-5 mr-2" />
                    {t("createAccountNow", language)}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            </section>
            
            {/* Features Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="section-3d-pop px-4 py-12 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-900/20"
            >
              <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-2xl font-bold mb-3">
                  {t("discoverFeatures", language)}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t("perfectForEveryone", language)}
                </p>
              </motion.div>
              
              <div className="max-w-lg mx-auto overflow-hidden">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                    slidesToScroll: 1,
                  }}
                  className="w-full"
                  setApi={setMobileApi}
                >
                  <CarouselContent>
                    {features.filter((_, index) => index % 2 === 0).map((feature, index) => {
                      const nextFeature = features[index * 2 + 1];
                      return (
                        <CarouselItem key={index} className="px-2 basis-full">
                          <div className="space-y-4">
                            <motion.div 
                              variants={itemVariants} 
                              className="group"
                              whileHover={{ 
                                scale: 1.02,
                                rotateX: 5,
                                rotateY: -5,
                                z: 50
                              }}
                              transition={{ duration: 0.3 }}
                            >
                              <Card className={`liquid-glass-feature overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br ${feature.bgGradient} dark:from-slate-800/50 dark:to-slate-900/50`}>
                                <div className={`h-1 bg-gradient-to-r ${feature.gradient}`}></div>
                                <div className="p-6">
                                  <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-md ${feature.iconColor} transform hover:scale-110 transition-transform duration-300`}>
                                      <feature.icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                        {feature.title}
                                        <Check className="h-4 w-4 text-green-500" />
                                      </h3>
                                      <p className="text-sm text-muted-foreground leading-relaxed w-full">
                                        {feature.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            </motion.div>
                            
                            {nextFeature && (
                              <motion.div 
                                variants={itemVariants} 
                                className="group"
                                whileHover={{ 
                                  scale: 1.02,
                                  rotateX: 5,
                                  rotateY: -5,
                                  z: 50
                                }}
                                transition={{ duration: 0.3 }}
                              >
                                <Card className={`liquid-glass-feature overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br ${nextFeature.bgGradient} dark:from-slate-800/50 dark:to-slate-900/50`}>
                                  <div className={`h-1 bg-gradient-to-r ${nextFeature.gradient}`}></div>
                                  <div className="p-6">
                                    <div className="flex items-start gap-4">
                                      <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-md ${nextFeature.iconColor} transform hover:scale-110 transition-transform duration-300`}>
                                        <nextFeature.icon className="h-6 w-6" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                          {nextFeature.title}
                                          <Check className="h-4 w-4 text-green-500" />
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed w-full">
                                          {nextFeature.description}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              </motion.div>
                            )}
                          </div>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                  <CarouselPrevious className="flex -left-12 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-2 border-[#e9ceb0]/30" />
                  <CarouselNext className="flex -right-12 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-2 border-[#e9ceb0]/30" />
                </Carousel>
              </div>
            </motion.section>
            
            {/* Pricing Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="px-4 py-12"
            >
              <div className="max-w-6xl mx-auto flex flex-col items-center">
                <motion.div variants={itemVariants} className="text-center mb-8">
                  <p className="text-3xl font-bold text-[#e9ceb0] max-w-3xl mx-auto">
                    {t("perfectForEveryone", language)}
                  </p>
                </motion.div>
                
                {/* Pricing Card - Mobile version */}
                <motion.div
                  variants={itemVariants}
                  className="relative max-w-sm w-full"
                >
                  {/* Background glow effect */}
                  <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/40 via-indigo-400/30 to-cyan-400/40 rounded-[2.5rem] blur-2xl"></div>
                  
                  {/* Card - Vibrant blue gradient with liquid glass */}
                  <div className="liquid-glass-card relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-2xl">
                    
                    <div className="relative z-10 flex flex-col items-center text-center">
                                            
                      {/* Price */}
                      <p className="text-5xl lg:text-6xl font-black mb-2" dir="ltr">
                        {MONTHLY_PRICE_QAR}<span className="text-3xl font-bold ml-1">{language === "en" ? "QAR" : "ر.ق"}</span>
                      </p>
                      <p className="text-xs font-medium text-white/80 tracking-widest uppercase mb-4">
                        {language === "en" ? `$${MONTHLY_PRICE_USD}/month USD` : `${MONTHLY_PRICE_USD}$ شهرياً`}
                      </p>
                      
                      {/* Description */}
                      <p className="text-white/70 text-xs mb-6 max-w-xs">
                        {language === "en" 
                          ? "Unlock all premium features and supercharge your productivity with AI" 
                          : "افتح جميع الميزات المميزة وعزز إنتاجيتك بالذكاء الاصطناعي"}
                      </p>
                      
                      {/* Feature tags - Mobile version */}
                      <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                        {features.map((feature, index) => (
                          <span 
                            key={index} 
                            className="bg-[#e9ceb0]/90 text-[#060541] text-xs font-medium px-2 py-1 rounded-full"
                          >
                            {feature.title}
                          </span>
                        ))}
                      </div>
                      
                      {/* CTA Button - Mobile version */}
                      <button
                        className="w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_hsla(210,100%,65%,0.5)] border-2 border-white/30 text-sm"
                        onClick={() => navigate('/signup')}
                      >
                        <Star className="h-4 w-4" />
                        {t("createAccountNow", language)}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          </div>
          
          <Footer />
        </div>
      </div>

      {/* Desktop/Tablet Variant */}
      <div className="hidden md:block">
        <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b border-border/50">
            <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Logo3D size="sm" />
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  WAKTI
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-primary/20 hover:border-primary/40 px-4 py-2"
                  onClick={() => navigate('/login')}
                >
                  {t("login", language)}
                  <LogIn className="h-4 w-4" />
                </Button>
                <ThemeLanguageToggle />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="w-full">
            {/* Hero Section */}
            <section className="relative py-12 lg:py-16 px-6 lg:px-8">
              <div className="absolute inset-0 z-0 pointer-events-none grid grid-cols-1 lg:grid-cols-2 bg-transparent dark:bg-transparent">
                <div className="col-span-1 lg:col-span-2 flex items-center justify-center bg-transparent dark:bg-transparent">
                  <video
                    className="h-full w-full max-w-5xl object-contain bg-transparent dark:bg-transparent opacity-40 dark:opacity-30 mix-blend-screen dark:mix-blend-lighten [mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,1)_58%,rgba(0,0,0,0)_92%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,1)_58%,rgba(0,0,0,0)_92%)]"
                    src="/Animated_Logo_Splash_Screen_Creation.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </div>
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 text-center max-w-4xl mx-auto"
              >
                <motion.div variants={itemVariants} className="mb-12">
                  <Logo3D size="lg" className="mx-auto mb-6" />
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <h1 className="relative text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-[0_6px_0_rgba(0,0,0,0.22)] shadow-[0_0_40px_rgba(99,102,241,0.35)] hover:shadow-[0_0_60px_rgba(99,102,241,0.45)] transition-transform duration-500 ease-out transform-gpu [perspective:1000px] [transform-style:preserve-3d] rotate-x-3 -rotate-y-3 hover:rotate-x-0 hover:rotate-y-0 before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[12%] before:rounded-full before:bg-white/25 dark:before:bg-transparent before:blur-[2px] before:pointer-events-none">
                      WAKTI
                    </h1>
                    <Zap className="h-10 w-10 lg:h-12 lg:w-12 text-yellow-500" />
                  </div>
                  <p className="text-xl lg:text-2xl font-extrabold text-muted-foreground max-w-3xl mx-auto drop-shadow-[0_3px_0_rgba(0,0,0,0.22)] tracking-tight">
                    {t("mainTagline", language)}
                  </p>
                </motion.div>
                
                <motion.div variants={itemVariants} className="mb-12">
                  <h2 className="text-3xl lg:text-4xl font-extrabold mb-6 bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white bg-clip-text text-transparent max-w-3xl mx-auto drop-shadow-[0_4px_0_rgba(0,0,0,0.22)] tracking-tight">
                    {t("heroSubtitle", language)}
                  </h2>
                </motion.div>
                
                <motion.div variants={itemVariants} className="mb-16">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-extrabold py-6 px-10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg shadow-[0_10px_0_rgba(0,0,0,0.2)] hover:shadow-[0_8px_0_rgba(0,0,0,0.2)] active:shadow-[0_6px_0_rgba(0,0,0,0.22)] active:translate-y-0.5 shadow-[0_0_40px_rgba(99,102,241,0.35)] hover:shadow-[0_0_60px_rgba(99,102,241,0.45)]"
                    onClick={() => navigate('/signup')}
                  >
                    <Star className="h-6 w-6 mr-3" />
                    {t("createAccountNow", language)}
                    <ArrowRight className="h-6 w-6 ml-3" />
                  </Button>
                </motion.div>
              </motion.div>
            </section>
            
            {/* Features Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="py-20 lg:py-32 px-6 lg:px-8 bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-900/20 overflow-visible"
            >
              <motion.div variants={itemVariants} className="text-center mb-20">
                <h2 className="text-3xl lg:text-5xl font-bold mb-6 max-w-3xl mx-auto">
                  {t("discoverFeatures", language)}
                </h2>
                <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
                  {t("perfectForEveryone", language)}
                </p>
              </motion.div>
              
              <div className="max-w-7xl mx-auto overflow-visible">
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                    slidesToScroll: 1,
                  }}
                  className="w-full overflow-visible"
                  setApi={setDesktopApi}
                >
                  <CarouselContent className="-ml-4 overflow-visible">
                    {features.map((feature, index) => (
                      <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/3 overflow-visible py-4">
                        <div 
                          className="group h-full overflow-visible"
                          style={{ perspective: "1000px" }}
                        >
                          <div
                            className="h-full"
                            style={{ 
                              transformStyle: "preserve-3d",
                              transition: "transform 0.5s ease, box-shadow 0.5s ease"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "rotateX(10deg) rotateY(-10deg) translateY(-16px) scale(1.05)";
                              e.currentTarget.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 30px rgba(99, 102, 241, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
                              e.currentTarget.style.boxShadow = "";
                            }}
                          >
                          <Card 
                            className={`overflow-visible border-0 shadow-xl transition-all duration-500 bg-gradient-to-br ${feature.bgGradient} dark:from-slate-800/50 dark:to-slate-900/50 h-full`}
                          >
                            <div className={`h-2 bg-gradient-to-r ${feature.gradient}`}></div>
                            <div className="p-8 lg:p-10">
                              <div className="flex items-start gap-6">
                                <div className={`p-4 lg:p-5 rounded-xl bg-white dark:bg-slate-800 shadow-md ${feature.iconColor} transform hover:scale-110 transition-transform duration-300`}>
                                  <feature.icon className="h-10 w-10 lg:h-12 lg:w-12" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-2xl lg:text-3xl mb-4 flex items-center gap-3">
                                    {feature.title}
                                    <Check className="h-6 w-6 lg:h-7 lg:w-7 text-green-500" />
                                  </h3>
                                  <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed w-full">
                                    {feature.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </Card>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden md:flex -left-16 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-2 border-[#e9ceb0]/30 z-10" />
                  <CarouselNext className="hidden md:flex -right-16 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-2 border-[#e9ceb0]/30 z-10" />
                </Carousel>
              </div>
            </motion.section>
            
            {/* Pricing Section */}
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={containerVariants}
              className="py-16 lg:py-20 px-6 lg:px-8"
            >
              <div className="max-w-6xl mx-auto flex flex-col items-center">
                <motion.div variants={itemVariants} className="text-center mb-16">
                  <p className="text-4xl md:text-5xl font-bold text-[#e9ceb0] max-w-3xl mx-auto">
                    {t("perfectForEveryone", language)}
                  </p>
                </motion.div>
                
                {/* Pricing Card - Wakti style */}
                <motion.div
                  variants={itemVariants}
                  className="relative max-w-md w-full"
                >
                  {/* Background glow effect */}
                  <div className="absolute -inset-6 bg-gradient-to-br from-blue-500/40 via-indigo-400/30 to-cyan-400/40 rounded-[3rem] blur-3xl"></div>
                  
                  {/* Card - Vibrant blue gradient */}
                  <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-2xl overflow-hidden">
                    {/* Glassmorphic overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/10 rounded-3xl"></div>
                    {/* Inner border glow - Wakti gold accent */}
                    <div className="absolute inset-[2px] rounded-[22px] border-2 border-[#e9ceb0]/40"></div>
                    
                    <div className="relative z-10 flex flex-col items-center text-center">
                                            
                      {/* Price */}
                      <p className="text-7xl lg:text-8xl font-black mb-2" dir="ltr">
                        {MONTHLY_PRICE_QAR}<span className="text-4xl font-bold ml-1">{language === "en" ? "QAR" : "ر.ق"}</span>
                      </p>
                      <p className="text-sm font-medium text-white/80 tracking-widest uppercase mb-6">
                        {language === "en" ? `$${MONTHLY_PRICE_USD}/month USD` : `${MONTHLY_PRICE_USD}$ شهرياً`}
                      </p>
                      
                      {/* Description */}
                      <p className="text-white/70 text-sm mb-8 max-w-xs">
                        {language === "en" 
                          ? "Unlock all premium features and supercharge your productivity with AI" 
                          : "افتح جميع الميزات المميزة وعزز إنتاجيتك بالذكاء الاصطناعي"}
                      </p>
                      
                      {/* Feature tags - ALL features - Wakti style */}
                      <div className="flex flex-wrap justify-center gap-2 mb-8">
                        {features.map((feature, index) => (
                          <span 
                            key={index} 
                            className="bg-[#e9ceb0]/90 text-[#060541] text-sm font-medium px-3 py-1.5 rounded-full"
                          >
                            {feature.title}
                          </span>
                        ))}
                      </div>
                      
                      {/* CTA Button - Wakti vibrant gradient */}
                      <button
                        className="w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 hover:from-cyan-500 hover:via-blue-600 hover:to-indigo-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_hsla(210,100%,65%,0.5)] border-2 border-white/30"
                        onClick={() => navigate('/signup')}
                      >
                        <Star className="h-5 w-5" />
                        {t("createAccountNow", language)}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          </main>

          <Footer />
        </div>
      </div>
    </>
  );
}
