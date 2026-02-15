import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ScrollIndicator } from "./ScrollIndicator";
import { useTheme } from "@/providers/ThemeProvider";
import { ArrowRight } from "lucide-react";

interface HeroSceneProps {
  language?: "en" | "ar";
}

export function HeroScene({ language = "en" }: HeroSceneProps) {
  const navigate = useNavigate();
  const { language: currentLang, setLanguage } = useTheme();
  const isArabic = language === "ar";

  const toggleLanguage = () => {
    setLanguage(currentLang === "en" ? "ar" : "en");
  };

  return (
    <section 
      className="landing-scene scroll-snap-scene relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Video Background */}
      <div className="absolute inset-0 z-0 bg-[#0c0f14] flex items-center justify-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
          poster="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
        >
          <source src="/Animated_Logo_Splash_Screen_Creation.mp4" type="video/mp4" />
        </video>

        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-[1.1]"
          poster="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
        >
          <source src="/Animated_Logo_Splash_Screen_Creation.mp4" type="video/mp4" />
        </video>
        {/* Dark gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(12,15,20,0.5) 0%, rgba(12,15,20,0.82) 60%, rgba(12,15,20,0.97) 100%)"
          }}
        />
      </div>

      {/* Header Bar - Top Right */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-2 py-2 backdrop-blur-xl bg-[#0c0f14]/60 border border-blue-400/25 shadow-[0_0_26px_hsla(210,100%,65%,0.55)]"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {/* Login Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/login")}
          className="rounded-full border-blue-400/30 bg-[#0c0f14]/50 text-white/95 hover:text-white hover:bg-blue-500/10 hover:border-blue-300/50 transition-all duration-300 gap-1.5 px-4 h-9 backdrop-blur-sm shadow-[0_0_18px_hsla(210,100%,65%,0.35)] hover:shadow-[0_0_26px_hsla(210,100%,65%,0.55)]"
        >
          <span className="text-sm font-light tracking-wide">
            {isArabic ? "دخول" : "Login"}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>

        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="rounded-full text-white/95 hover:text-white bg-[#0c0f14]/50 hover:bg-blue-500/10 transition-all duration-300 h-9 px-3 font-medium border border-blue-400/25 shadow-[0_0_18px_hsla(210,100%,65%,0.30)] hover:shadow-[0_0_26px_hsla(210,100%,65%,0.50)]"
        >
          {currentLang === "en" ? "العربية" : "English"}
        </Button>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
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
          className="text-lg font-light text-white/80 mb-10 max-w-xs"
          style={{ letterSpacing: "0.05em" }}
        >
          {isArabic 
            ? "أذكى . أسرع . أسهل"
            : "SMARTER . FASTER . EASIER"
          }
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="flex flex-col items-center"
        >
          <Button
            onClick={() => navigate("/signup")}
            size="lg"
            className="px-10 py-6 rounded-full text-base font-semibold tracking-[0.05em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #e9ceb0 0%, #d4b896 50%, #e9ceb0 100%)",
              color: "#060541",
              boxShadow: "0 8px 32px rgba(233, 206, 176, 0.3)",
            }}
          >
            {isArabic ? "أنشئ حسابك" : "Create your account"}
          </Button>

          <button
            type="button"
            onClick={() => {
              const pricingEl = document.getElementById("pricing");
              pricingEl?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-4 text-xs font-light tracking-[0.2em] uppercase text-blue-200/80 hover:text-blue-100 transition-colors"
          >
            {isArabic ? "السعر" : "Price"}
          </button>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <ScrollIndicator className="absolute bottom-32 inset-x-0 z-10 flex justify-center" />
    </section>
  );
}
