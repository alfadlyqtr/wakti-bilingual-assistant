import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PricingSceneProps {
  language?: "en" | "ar";
}

export function PricingScene({ language = "en" }: PricingSceneProps) {
  const navigate = useNavigate();
  const { signInAnonymously } = useAuth();
  const isArabic = language === "ar";
  const [showQAR, setShowQAR] = useState(true);
  const [isGuestSigningIn, setIsGuestSigningIn] = useState(false);

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

  return (
    <LandingScene
      id="pricing"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 70% 55% at 50% 55%, rgba(233,206,176,0.07) 0%, rgba(12,15,20,0.88) 55%, #0c0f14 100%)"
    >
      <style>{`
        @keyframes pricing-spark-sweep {
          0% {
            transform: translateX(-140%) rotate(18deg);
            opacity: 0;
          }
          14% { opacity: 0.12; }
          42% { opacity: 0.4; }
          70% { opacity: 0.2; }
          100% {
            transform: translateX(180%) rotate(18deg);
            opacity: 0;
          }
        }

        .pricing-spark-sweep {
          animation: pricing-spark-sweep 4.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
          will-change: transform, opacity;
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

          {/* Spark sweep + ambient highlights (soft, no harsh cut) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[1.6rem]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.09) 0%, transparent 58%), radial-gradient(85% 70% at 12% 100%, rgba(233,206,176,0.08) 0%, transparent 72%)",
              }}
            />
            <div
              className="pricing-spark-sweep absolute -top-[24%] -bottom-[24%] left-[-40%] w-[74%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 26%, rgba(255,255,255,0.12) 45%, rgba(233,206,176,0.28) 50%, rgba(255,255,255,0.12) 55%, rgba(255,255,255,0.02) 74%, transparent 100%)",
                filter: "blur(8px)",
                mixBlendMode: "screen",
                WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 14%, black 86%, transparent 100%)",
                maskImage: "linear-gradient(180deg, transparent 0%, black 14%, black 86%, transparent 100%)",
              }}
            />
            <div
              className="pricing-spark-sweep absolute -top-[14%] -bottom-[14%] left-[-34%] w-[54%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 34%, rgba(233,206,176,0.3) 50%, rgba(255,255,255,0.05) 66%, transparent 100%)",
                filter: "blur(2px)",
                mixBlendMode: "screen",
                animationDelay: "1.05s",
                WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)",
                maskImage: "linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)",
              }}
            />
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
                <span>QAR</span>
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
                <span>USD</span>
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
              className="w-full flex flex-col items-center gap-2.5"
            >
              <Button
                onClick={handleGuestAccess}
                disabled={isGuestSigningIn}
                className="w-full py-6 rounded-full text-sm font-bold tracking-[0.07em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #e9ceb0 0%, #c5a47e 50%, #e9ceb0 100%)",
                  color: "#060541",
                  boxShadow: "0 8px 32px rgba(233,206,176,0.38), 0 0 60px rgba(233,206,176,0.15)",
                }}
              >
                <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 55%)" }} />
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  <span>
                    {isGuestSigningIn
                      ? (isArabic ? "جارٍ الدخول كضيف..." : "STARTING GUEST MODE...")
                      : (isArabic ? "ابدأ وقتي مجاناً" : "START WAKTI FOR FREE")}
                  </span>
                  <ArrowRight className={isArabic ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
                </span>
              </Button>

              <button
                type="button"
                onClick={() => navigate("/signup", { state: { authTab: "login" } })}
                className="w-[92%] rounded-full px-8 py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-[#0c0f14]/70 text-white border border-blue-300/35 backdrop-blur-xl shadow-[0_0_18px_hsla(210,100%,65%,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] hover:text-white hover:bg-blue-500/18 hover:border-blue-200/55 hover:shadow-[0_0_30px_hsla(210,100%,65%,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]"
              >
                {isArabic ? "إنشاء حساب / تسجيل الدخول" : "Create Account / Sign in"}
              </button>
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
