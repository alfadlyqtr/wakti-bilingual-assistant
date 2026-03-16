import { motion } from "framer-motion";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";

interface PricingSceneProps {
  language?: "en" | "ar";
}

export function PricingScene({ language = "en" }: PricingSceneProps) {
  const navigate = useNavigate();
  const isArabic = language === "ar";
  const [showQAR, setShowQAR] = useState(true);

  return (
    <LandingScene
      id="pricing"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 55% at 50% 55%, rgba(233,206,176,0.07) 0%, rgba(12,15,20,0.88) 55%, #0c0f14 100%)"
    >
      <style>{`
        @keyframes pricing-shimmer {
          0%   { transform: translateX(-110%) rotate(25deg); }
          100% { transform: translateX(210%) rotate(25deg); }
        }
        .pricing-shimmer-sweep {
          animation: pricing-shimmer 3.5s ease-in-out infinite;
          animation-delay: 1.2s;
        }
      `}</style>

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 36 }}
        whileInView={{ scale: 1, opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.85, ease: "easeOut" }}
        className="relative w-full max-w-xs"
      >
        {/* Outer glow */}
        <div className="absolute -inset-2 rounded-[2rem] blur-2xl pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(233,206,176,0.22) 0%, transparent 70%)" }} />

        {/* ── Platinum Card ── */}
        <div
          className="relative rounded-[1.6rem] overflow-hidden"
          style={{
            background: "linear-gradient(160deg, rgba(18,22,30,0.96) 0%, rgba(12,15,20,0.92) 60%, rgba(16,20,28,0.96) 100%)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.75), 0 2px 0 rgba(255,255,255,0.06) inset",
          }}
        >
          {/* Glass border */}
          <div className="absolute inset-0 rounded-[1.6rem] pointer-events-none" style={{ border: "1.5px solid transparent", backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(233,206,176,0.35) 30%, rgba(255,255,255,0.06) 60%, rgba(233,206,176,0.18))", WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "destination-out", maskComposite: "exclude" }} />

          {/* Shimmer sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.6rem]">
            <div className="pricing-shimmer-sweep absolute inset-y-0" style={{ width: "45%", background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 45%, rgba(233,206,176,0.12) 50%, rgba(255,255,255,0.07) 55%, transparent 100%)" }} />
          </div>

          <div className="relative z-10 p-7 flex flex-col items-center">
            {/* "One Plan" label */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-[#e9ceb0] text-sm font-medium tracking-[0.3em] uppercase mb-5"
            >
              {isArabic ? "اشتراك واحد" : "One Plan"}
            </motion.p>

            {/* ── Flag Toggle ── */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.28 }}
              className="flex items-center gap-0 mb-5 rounded-full overflow-hidden"
              style={{ border: "1px solid rgba(233,206,176,0.25)", background: "rgba(233,206,176,0.06)" }}
            >
              <button
                type="button"
                onClick={() => setShowQAR(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold tracking-wide transition-all duration-200"
                style={{
                  background: showQAR ? "rgba(233,206,176,0.22)" : "transparent",
                  color: showQAR ? "#e9ceb0" : "rgba(255,255,255,0.38)",
                  boxShadow: showQAR ? "0 0 0 1px rgba(233,206,176,0.35) inset" : "none",
                }}
              >
                <span className="text-[15px] leading-none">🇶🇦</span>
                <span>QA</span>
                <span className="text-[10px] font-semibold opacity-80">QAR</span>
              </button>
              <div style={{ width: 1, height: 18, background: "rgba(233,206,176,0.18)", flexShrink: 0 }} />
              <button
                type="button"
                onClick={() => setShowQAR(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold tracking-wide transition-all duration-200"
                style={{
                  background: !showQAR ? "rgba(233,206,176,0.22)" : "transparent",
                  color: !showQAR ? "#e9ceb0" : "rgba(255,255,255,0.38)",
                  boxShadow: !showQAR ? "0 0 0 1px rgba(233,206,176,0.35) inset" : "none",
                }}
              >
                <span className="text-[15px] leading-none">🇺🇸</span>
                <span>US</span>
                <span className="text-[10px] font-semibold opacity-80">USD</span>
              </button>
            </motion.div>

            {/* ── Price Display ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35 }}
              className="text-center mb-3"
            >
              <div className="flex items-baseline justify-center gap-1.5">
                <span
                  className="text-6xl font-extralight"
                  style={{
                    background: "linear-gradient(135deg, #e9ceb0 0%, #fff 50%, #e9ceb0 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}
                >
                  {showQAR ? "92" : "$24.99"}
                </span>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[#e9ceb0] text-base font-semibold">{showQAR ? "QAR" : "USD"}</span>
                  <span className="text-white/50 text-[10px] font-light">{isArabic ? "/ شهرياً" : "/ monthly"}</span>
                </div>
              </div>
            </motion.div>

            {/* Divider */}
            <div className="w-full h-px my-4" style={{ background: "linear-gradient(90deg, transparent, rgba(233,206,176,0.3), transparent)" }} />

            {/* Everything Included badge */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.45 }}
              className="flex items-center justify-center gap-2 mb-6"
            >
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full" style={{ background: "linear-gradient(135deg, rgba(233,206,176,0.15) 0%, rgba(196,164,126,0.08) 100%)", border: "1px solid rgba(233,206,176,0.25)" }}>
                <Sparkles className="w-3.5 h-3.5 text-[#e9ceb0]" />
                <span className="text-[#e9ceb0] text-[11px] font-bold tracking-[0.2em] uppercase">
                  {isArabic ? "كل شيء مضمن" : "Everything Included"}
                </span>
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.55 }}
              className="w-full"
            >
              <Button
                onClick={() => navigate("/signup")}
                className="w-full py-6 rounded-full text-sm font-bold tracking-[0.07em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #e9ceb0 0%, #c5a47e 50%, #e9ceb0 100%)",
                  color: "#060541",
                  boxShadow: "0 8px 32px rgba(233,206,176,0.38), 0 0 60px rgba(233,206,176,0.15)",
                }}
              >
                <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 55%)" }} />
                <span className="relative z-10">{isArabic ? "ابدأ وقتي مجاناً" : "START WAKTI FOR FREE"}</span>
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.65 }}
              className="text-center text-white/40 text-[10px] mt-3 font-light tracking-wide"
            >
              {isArabic ? "تطبيق شامل مدعوم بالذكاء الاصطناعي" : "All-in-One AI-Powered App · No hidden fees"}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </LandingScene>
  );
}
