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
import LandingPage from "./LandingPage";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, theme } = useTheme();
  const { isMobile } = useIsMobile();
  
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

  return <LandingPage />;
}
