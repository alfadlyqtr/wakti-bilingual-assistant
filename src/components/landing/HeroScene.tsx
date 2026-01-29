import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { ScrollIndicator } from "./ScrollIndicator";
import { LogIn } from "lucide-react";

interface HeroSceneProps {
  language?: "en" | "ar";
}

export function HeroScene({ language = "en" }: HeroSceneProps) {
  const navigate = useNavigate();
  const isArabic = language === "ar";

  return (
    <section 
      className="landing-scene scroll-snap-scene relative flex flex-col items-center justify-center h-[100dvh] w-full overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
        >
          <source src="/Animated_Logo_Splash_Screen_Creation.mp4" type="video/mp4" />
        </video>
        {/* Dark gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(12,15,20,0.3) 0%, rgba(12,15,20,0.7) 60%, rgba(12,15,20,0.95) 100%)"
          }}
        />
      </div>

      {/* Login Button - Top Right */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="absolute top-6 right-6 z-20"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/login")}
          className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 gap-2"
        >
          <LogIn className="h-4 w-4" />
          <span className="text-sm font-light tracking-wide">
            {isArabic ? "دخول" : "Login"}
          </span>
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
            ? "مساعدك الذكي للحياة اليومية"
            : "Your Intelligent Life Companion"
          }
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
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
            {isArabic ? "ابدأ الآن" : "Begin Your Journey"}
          </Button>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <ScrollIndicator className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10" />
    </section>
  );
}
