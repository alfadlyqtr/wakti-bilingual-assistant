import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface InvitationSceneProps {
  language?: "en" | "ar";
}

export function InvitationScene({ language = "en" }: InvitationSceneProps) {
  const navigate = useNavigate();
  const isArabic = language === "ar";

  return (
    <LandingScene 
      id="invitation"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 50% at 50% 40%, rgba(233, 206, 176, 0.06) 0%, transparent 60%)"
    >
      {/* Main Content */}
      <div className="flex flex-col items-center text-center">
        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-extralight tracking-[0.1em] text-white mb-4"
        >
          {isArabic ? "انضم إلى الآلاف" : "Join Thousands"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-white/60 font-light text-lg mb-10 max-w-xs"
        >
          {isArabic 
            ? "مستخدمون حول العالم يستمتعون بتجربة وقتي"
            : "Already enjoying the WAKTI experience"
          }
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-10"
        >
          <Button
            onClick={() => navigate("/signup")}
            size="lg"
            className="px-10 py-7 rounded-full text-base font-semibold tracking-[0.05em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
            style={{
              background: "linear-gradient(135deg, #e9ceb0 0%, #d4b896 50%, #e9ceb0 100%)",
              color: "#060541",
              boxShadow: "0 8px 40px rgba(233, 206, 176, 0.35)",
            }}
          >
            {isArabic ? "ابدأ رحلتك" : "Begin Your Journey"}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* App Store Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex items-center gap-4 mb-12"
        >
          <a 
            href="https://apps.apple.com/qa/app/wakti-ai/id6738048874" 
            target="_blank" 
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <img 
              src="/assets/app-store-badge.svg" 
              alt="Download on App Store"
              className="h-10 opacity-80 hover:opacity-100 transition-opacity"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </a>
          <a 
            href="https://play.google.com/store/apps/details?id=app.lovable.wakti5332ebb76fae483fa0cc4262a2a445a1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <img 
              src="/assets/google-play-badge.svg" 
              alt="Get it on Google Play"
              className="h-10 opacity-80 hover:opacity-100 transition-opacity"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </a>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex items-center gap-6 text-white/30 text-xs font-light"
        >
          <a 
            href="/privacy-terms" 
            className="hover:text-white/60 transition-colors"
          >
            {isArabic ? "الخصوصية" : "Privacy"}
          </a>
          <span>•</span>
          <a 
            href="/contact" 
            className="hover:text-white/60 transition-colors"
          >
            {isArabic ? "تواصل معنا" : "Contact"}
          </a>
          <span>•</span>
          <a 
            href="/help" 
            className="hover:text-white/60 transition-colors"
          >
            {isArabic ? "المساعدة" : "Help"}
          </a>
        </motion.div>

        {/* Copyright */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-white/20 text-xs mt-6 font-light"
        >
          © 2025 WAKTI. All rights reserved.
        </motion.p>
      </div>
    </LandingScene>
  );
}
