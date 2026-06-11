import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ScrollIndicator } from "./ScrollIndicator";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight, Code2, Music, Image as ImageIcon, AudioLines, Sparkles, Mic, Languages, MonitorPlay, ListTodo } from "lucide-react";
import RippleGrid from "@/components/landing/RippleGrid";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface HeroSceneProps {
  language?: "en" | "ar";
}

export function HeroScene({ language = "en" }: HeroSceneProps) {
  const navigate = useNavigate();
  const { language: currentLang, setLanguage } = useTheme();
  const { signInAnonymously } = useAuth();
  const isArabic = language === "ar";
  const sectionRef = useRef<HTMLElement>(null);
  const [isGuestSigningIn, setIsGuestSigningIn] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const gridY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  const toggleLanguage = () => {
    setLanguage(currentLang === "en" ? "ar" : "en");
  };

  const handleGuestAccess = async () => {
    if (isGuestSigningIn) return;
    setIsGuestSigningIn(true);
    try {
      const { error, user } = await signInAnonymously();
      if (error || !user?.id) {
        toast.error(isArabic ? "تعذر بدء وضع الضيف الآن" : "Couldn't start guest mode right now");
        return;
      }
      navigate("/dashboard", { replace: true });
    } finally {
      setIsGuestSigningIn(false);
    }
  };

  // Auto-advance for the features carousel
  const [featuresApi, setFeaturesApi] = useState<CarouselApi | null>(null);
  useEffect(() => {
    if (!featuresApi) return;
    const id = window.setInterval(() => {
      try { featuresApi.scrollNext(); } catch {}
    }, 3200);
    return () => window.clearInterval(id);
  }, [featuresApi]);

  const slides = isArabic
    ? [
        {
          icon: Code2,
          color: "text-emerald-300",
          line: "فايب كودينج — صِف فكرتك والذكاء الاصطناعي يبنيها لك",
        },
        {
          icon: Sparkles,
          color: "text-blue-300",
          line: "مساعد ذكي — دردشة وبحث ويب وملخصات يوتيوب",
        },
        {
          icon: ImageIcon,
          color: "text-pink-300",
          line: "توليد الصور — حوّل النص إلى صورة فنية خلال ثوانٍ",
        },
        {
          icon: Mic,
          color: "text-cyan-300",
          line: "استنساخ الصوت — صوتك بأكثر من 60 لغة",
        },
        {
          icon: Languages,
          color: "text-green-300",
          line: "مترجم فوري — ترجمة صوت ونص لحظية بأكثر من 60 لغة",
        },
        {
          icon: AudioLines,
          color: "text-teal-300",
          line: "مدوّن الاجتماعات — سجّل وفرّغ ولخّص اجتماعاتك تلقائياً",
        },
        {
          icon: Music,
          color: "text-purple-300",
          line: "موسيقى وفيديو AI — مقاطع أصلية وفيديوهات قصيرة",
        },
        {
          icon: MonitorPlay,
          color: "text-violet-300",
          line: "شرائح بالذكاء الاصطناعي — عروض و PDF خلال ثوانٍ",
        },
        {
          icon: ListTodo,
          color: "text-amber-300",
          line: "مهام ذكية — قوائم قابلة للمشاركة مع متابعة لحظية",
        },
      ]
    : [
        {
          icon: Code2,
          color: "text-emerald-300",
          line: "Vibe Coding — describe it, AI builds & ships your app",
        },
        {
          icon: Sparkles,
          color: "text-blue-300",
          line: "AI Assistant — smart chat, web search & YouTube recaps",
        },
        {
          icon: ImageIcon,
          color: "text-pink-300",
          line: "AI Image Gen — text-to-image art in seconds",
        },
        {
          icon: Mic,
          color: "text-cyan-300",
          line: "Voice Cloning — your voice in 60+ languages",
        },
        {
          icon: Languages,
          color: "text-green-300",
          line: "Live Translator — real-time voice & text in 60+ languages",
        },
        {
          icon: AudioLines,
          color: "text-teal-300",
          line: "AI Note-Taker — record, transcribe & summarize meetings",
        },
        {
          icon: Music,
          color: "text-purple-300",
          line: "AI Music & Video — original tracks & short-form clips",
        },
        {
          icon: MonitorPlay,
          color: "text-violet-300",
          line: "AI Slides — deck & PDF builder in seconds",
        },
        {
          icon: ListTodo,
          color: "text-amber-300",
          line: "Smart Tasks — shareable to-dos with live tracking",
        },
      ];

  return (
    <section 
      ref={sectionRef}
      className="landing-scene scroll-snap-scene relative flex flex-col items-center justify-start h-[100dvh] w-full overflow-hidden pt-6 md:pt-8"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* RippleGrid Background with parallax */}
      <motion.div className="absolute inset-0 z-0" style={{ y: gridY }}>
        <div className="absolute inset-0 bg-[#0c0f14]" />
        <ErrorBoundary fallback={<></>}>
        <RippleGrid
          gridColor="#4a90d9"
          rippleIntensity={0.01}
          gridSize={12.0}
          gridThickness={15.0}
          fadeDistance={0.5}
          vignetteStrength={5.0}
          glowIntensity={0.0}
          opacity={1.0}
          gridRotation={0}
          mouseInteraction={true}
          mouseInteractionRadius={1.2}
        />
        </ErrorBoundary>
        {/* Dark gradient overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(12,15,20,0.3) 0%, rgba(12,15,20,0.6) 60%, rgba(12,15,20,0.95) 100%)"
          }}
        />
      </motion.div>

      {/* Header Bar - Top Right */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-2 py-2 backdrop-blur-xl bg-[#0c0f14]/60 border border-blue-400/25"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {/* Pricing Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const el = document.getElementById('pricing');
            if (el) {
              const container = el.closest('.scroll-snap-container') as HTMLElement | null;
              if (container) {
                container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
              } else {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }}
          className="rounded-full text-[#e9ceb0] hover:text-white bg-[#0c0f14]/50 hover:bg-[#e9ceb0]/10 transition-all duration-300 h-9 px-4 font-medium border border-[#e9ceb0]/25"
        >
          <span className="text-sm font-light tracking-wide">
            {isArabic ? "الأسعار" : "Pricing"}
          </span>
        </Button>

        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="rounded-full text-white/95 hover:text-white bg-[#0c0f14]/50 hover:bg-blue-500/10 transition-all duration-300 h-9 px-3 font-medium border border-blue-400/25"
        >
          {currentLang === "en" ? "العربية" : "English"}
        </Button>
      </motion.div>

      {/* Main Content with parallax */}
      <motion.div className="relative z-10 flex flex-col items-center text-center px-6 pb-28 md:pb-36" style={{ y: contentY }}>

        {/* Logo with breathing animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="breathing-animation">
            <Logo3D size="xl" className="gold-glow" />
          </div>
        </motion.div>

        {/* WAKTI Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="luxury-title text-5xl mb-4 gold-glow"
          style={{
            background: "linear-gradient(135deg, #e9ceb0 0%, #ffffff 50%, #e9ceb0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          WAKTI
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg font-light text-white/80 mb-5 md:mb-8 max-w-xs"
          style={{ letterSpacing: "0.05em" }}
        >
          {isArabic 
            ? "أذكى . أسرع . أسهل"
            : "SMARTER . FASTER . EASIER"
          }
        </motion.p>

        {/* Features banner carousel */}
        <div className="w-full max-w-md md:max-w-2xl mb-12 md:mb-20">
          <Carousel setApi={setFeaturesApi} opts={{ loop: true }}>
            <CarouselContent>
              {slides.map((s, idx) => {
                const Icon = s.icon as any;
                return (
                  <CarouselItem key={idx}>
                    <div className="inline-flex flex-col items-stretch mx-auto max-w-[90vw] md:max-w-2xl">
                      {/* Glow + gradient ring wrapper */}
                      <div className="relative p-[1.5px] rounded-full bg-[linear-gradient(135deg,hsl(210_100%_65%/.35),hsl(280_70%_65%/.35))]">
                        <div className="absolute -inset-2 rounded-full pointer-events-none opacity-70 animate-pulse shadow-[0_0_40px_hsla(210,100%,65%,0.45),0_0_80px_hsla(280,70%25,65%,0.28)]" />
                        <div className="relative rounded-full border border-white/10 bg-[#0c0f14]/60 backdrop-blur-xl px-3 py-2 shadow-[0_0_14px_rgba(0,0,0,0.3)] inline-flex items-start md:items-center gap-3 min-h-[2.5rem] md:h-11">
                          <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-white/5 border border-white/10 ${s.color} transition-transform duration-700 ease-in-out will-change-transform`}
                               style={{ transform: 'scale(1)' }}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="text-white/90 text-[13px] md:text-base font-medium leading-snug whitespace-normal break-words pr-1">
                            {s.line}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="flex flex-col items-center mt-4 md:mt-10 lg:mt-14"
        >
          <button
            type="button"
            onClick={handleGuestAccess}
            disabled={isGuestSigningIn}
            className="mb-2 rounded-full px-10 py-2 text-[13px] font-semibold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-[#0c0f14]/70 text-white border border-emerald-300/40 backdrop-blur-xl shadow-[0_0_18px_hsla(160,80%,55%,0.32)] hover:bg-emerald-500/15 hover:border-emerald-300/60 hover:shadow-[0_0_26px_hsla(160,80%,55%,0.55)]"
          >
            <span className="inline-flex items-center gap-2">
              <span>{isGuestSigningIn ? (isArabic ? "جارٍ الدخول كضيف..." : "STARTING GUEST MODE...") : (isArabic ? "جربه كضيف" : "TRY IT OUT AS A GUEST")}</span>
              <ArrowRight className={isArabic ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
            </span>
          </button>

          <button
            onClick={() => navigate("/signup")}
            className="relative overflow-hidden rounded-full px-10 py-2 text-[13px] font-semibold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-[#0c0f14]/70 text-white border border-blue-300/35 backdrop-blur-xl shadow-[0_0_18px_hsla(210,100%,65%,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] hover:text-white hover:bg-blue-500/18 hover:border-blue-200/55 hover:shadow-[0_0_30px_hsla(210,100%,65%,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <span className="relative z-10">{isArabic ? "إنشاء حساب / تسجيل الدخول" : "Create Account / Sign in"}</span>
          </button>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <ScrollIndicator className="absolute bottom-20 inset-x-0 z-10 flex justify-center" language={language} />
    </section>
  );
}
