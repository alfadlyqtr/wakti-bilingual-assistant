import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ScrollIndicator } from "./ScrollIndicator";
import { useTheme } from "@/providers/ThemeProvider";
import { ArrowRight } from "lucide-react";
import RippleGrid from "@/components/landing/RippleGrid";

interface HeroSceneProps {
  language?: "en" | "ar";
}

export function HeroScene({ language = "en" }: HeroSceneProps) {
  const navigate = useNavigate();
  const { language: currentLang, setLanguage } = useTheme();
  const isArabic = language === "ar";
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const gridY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  const toggleLanguage = () => {
    setLanguage(currentLang === "en" ? "ar" : "en");
  };

  return (
    <section 
      ref={sectionRef}
      className="landing-scene scroll-snap-scene relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* RippleGrid Background with parallax */}
      <motion.div className="absolute inset-0 z-0" style={{ y: gridY }}>
        <div className="absolute inset-0 bg-[#0c0f14]" />
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
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-2 py-2 backdrop-blur-xl bg-[#0c0f14]/60 border border-blue-400/25 shadow-[0_0_26px_hsla(210,100%,65%,0.55)]"
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
          className="rounded-full text-[#e9ceb0] hover:text-white bg-[#0c0f14]/50 hover:bg-[#e9ceb0]/10 transition-all duration-300 h-9 px-4 font-medium border border-[#e9ceb0]/25 shadow-[0_0_14px_rgba(233,206,176,0.2)] hover:shadow-[0_0_22px_rgba(233,206,176,0.4)]"
        >
          <span className="text-sm font-light tracking-wide">
            {isArabic ? "الأسعار" : "Pricing"}
          </span>
        </Button>

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

      {/* Main Content with parallax */}
      <motion.div className="relative z-10 flex flex-col items-center text-center px-6" style={{ y: contentY }}>
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
            className="px-10 py-6 rounded-full text-base font-semibold tracking-[0.05em] uppercase transition-all duration-300 active:scale-[0.96] relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #e9ceb0 0%, #d4b896 50%, #e9ceb0 100%)",
              color: "#060541",
              boxShadow: "0 12px 40px rgba(233, 206, 176, 0.6), 0 0 80px rgba(233, 206, 176, 0.4), 0 0 120px rgba(233, 206, 176, 0.2), inset 0 1px 0 rgba(255,255,255,0.4)",
              animation: "cta-breathe 2s ease-in-out infinite"
            }}
          >
            {/* Constant pulsing glow ring */}
            <span 
              className="absolute -inset-2 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(233,206,176,0.8), rgba(245,230,211,0.6), rgba(233,206,176,0.8))",
                filter: "blur(12px)",
                zIndex: -1,
                animation: "cta-pulse 1.5s ease-in-out infinite"
              }}
            />
            {/* Inner shine */}
            <span 
              className="absolute inset-0 rounded-full opacity-60"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 50%)",
              }}
            />
            {isArabic ? (
              <span dir="rtl" style={{ unicodeBidi: 'embed' }} className="relative z-10 drop-shadow-sm">
                جرب وقتي AI <span style={{ color: '#1e3a5f', fontWeight: 800 }}>مجاناً</span>
              </span>
            ) : (
              <span className="relative z-10 drop-shadow-sm">Try Wakti AI for <span style={{ color: '#1e3a5f', fontWeight: 800 }}>Free</span></span>
            )}
          </Button>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <ScrollIndicator className="absolute bottom-32 inset-x-0 z-10 flex justify-center" language={language} />
    </section>
  );
}
