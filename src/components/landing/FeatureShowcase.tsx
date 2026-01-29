import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { LandingScene } from "./LandingScene";

interface FeatureShowcaseProps {
  icon: LucideIcon;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  accentColor: string;
  glowColor: string;
  language?: "en" | "ar";
  id?: string;
}

export function FeatureShowcase({
  icon: Icon,
  title,
  titleAr,
  description,
  descriptionAr,
  accentColor,
  glowColor,
  language = "en",
  id,
}: FeatureShowcaseProps) {
  const displayTitle = language === "ar" && titleAr ? titleAr : title;
  const displayDescription = language === "ar" && descriptionAr ? descriptionAr : description;

  return (
    <LandingScene 
      id={id}
      className="bg-[#0c0f14]"
      gradient={`radial-gradient(ellipse 80% 50% at 50% 50%, ${accentColor}15 0%, transparent 70%)`}
    >
      {/* Floating Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        whileInView={{ scale: 1, opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-8"
      >
        <motion.div
          animate={{ 
            y: [0, -12, 0],
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          {/* Glow effect */}
          <div 
            className="absolute inset-0 blur-3xl opacity-40 rounded-full"
            style={{ background: glowColor }}
          />
          
          {/* Icon container */}
          <div 
            className="relative p-8 rounded-3xl"
            style={{ 
              background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}05 100%)`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            <Icon 
              className="h-20 w-20" 
              style={{ color: accentColor }}
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-3xl font-light tracking-[0.15em] text-white text-center mb-4"
        style={{ 
          textShadow: `0 0 40px ${accentColor}40`,
        }}
      >
        {displayTitle}
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-lg font-light text-white/70 text-center max-w-xs leading-relaxed"
      >
        {displayDescription}
      </motion.p>
    </LandingScene>
  );
}
