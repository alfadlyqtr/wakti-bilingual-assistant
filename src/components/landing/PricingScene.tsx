import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";

interface PricingSceneProps {
  language?: "en" | "ar";
}

export function PricingScene({ language = "en" }: PricingSceneProps) {
  const navigate = useNavigate();
  const isArabic = language === "ar";

  return (
    <LandingScene 
      id="pricing"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 60% 40% at 50% 60%, rgba(233, 206, 176, 0.05) 0%, rgba(12,15,20,0.92) 55%, #0c0f14 100%)"
    >
      {/* Glassmorphic Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        whileInView={{ scale: 1, opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        {/* Card glow */}
        <div className="absolute -inset-1 bg-gradient-to-br from-[#e9ceb0]/30 via-[#e9ceb0]/10 to-transparent rounded-3xl blur-xl" />
        
        {/* Card */}
        <div 
          className="relative rounded-3xl p-8 backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, rgba(12,15,20,0.85) 0%, rgba(12,15,20,0.65) 100%)",
            border: "1px solid rgba(233, 206, 176, 0.28)",
            boxShadow: "0 18px 70px rgba(0,0,0,0.65)",
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-[#e9ceb0] text-sm font-medium tracking-[0.3em] uppercase mb-4"
            >
              {isArabic ? "اشتراك واحد" : "One Plan"}
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex items-baseline justify-center gap-1"
            >
              <span className="text-5xl font-extralight text-white">95</span>
              <span className="text-xl text-white/80 font-light">QAR</span>
              <span className="text-white/70 font-light">/</span>
              <span className="text-white/70 font-light">{isArabic ? "شهر" : "month"}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="text-white/70 text-sm mt-2"
            >
              ≈ $24.99 USD
            </motion.div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#e9ceb0]/30 to-transparent mb-8" />

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-2 text-white/80">
              <Check className="h-5 w-5 text-[#e9ceb0]" />
              <span className="font-light tracking-wide">
                {isArabic ? "جميع الميزات مضمنة" : "All Features Included"}
              </span>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
          >
            <Button
              onClick={() => navigate("/signup")}
              className="w-full py-6 rounded-full text-base font-semibold tracking-[0.05em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #e9ceb0 0%, #d4b896 50%, #e9ceb0 100%)",
                color: "#060541",
                boxShadow: "0 8px 32px rgba(233, 206, 176, 0.3)",
              }}
            >
              {isArabic ? "ابدأ الآن" : "Start Now"}
            </Button>
          </motion.div>

          {/* Trial note */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-white/70 text-xs mt-4 font-light"
          >
            {isArabic ? "تطبيق شامل مدعوم بالذكاء الاصطناعي" : "All-in-One AI-Powered App"}
          </motion.p>
        </div>
      </motion.div>
    </LandingScene>
  );
}
