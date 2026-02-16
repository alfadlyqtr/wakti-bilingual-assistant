import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import { WaktiPartners } from "@/components/wakti-landing/WaktiPartners";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";
import RippleGrid from "@/components/wakti-landing/RippleGrid";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function WaktiLanding() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-5 overflow-hidden">
        {/* RippleGrid Background */}
        <div className="absolute inset-0 z-0">
          <RippleGrid
            gridColor="#e9ceb0"
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
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{ background: "linear-gradient(to top, #0c0f14, transparent)" }} />
        </div>

        <motion.div
          className="relative z-10 text-center max-w-2xl mx-auto"
          initial="hidden"
          animate="visible"
        >
          <motion.p
            custom={0}
            variants={fadeUp}
            className="text-xs uppercase tracking-[0.4em] text-[#8a1538] mb-6"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.3)" }}
          >
            {isAr ? "إدارة ذكية للوقت" : "Smart Time Management"}
          </motion.p>

          <motion.h1
            custom={1}
            variants={fadeUp}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            style={{ color: "#8a1538", fontFamily: "'Georgia', serif", textShadow: "0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.3)" }}
          >
            WAKTI
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            className="text-lg md:text-xl text-[#8a1538] leading-relaxed max-w-lg mx-auto mb-8"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.3)" }}
          >
            {isAr
              ? "تطبيقك الذكي لإدارة المهام والمواعيد والتذكيرات — كل شيء في مكان واحد."
              : "Your intelligent companion for tasks, events, reminders, and everything in between — all in one place."}
          </motion.p>

          <motion.div
            custom={3}
            variants={fadeUp}
            className="flex justify-center gap-4"
          >
            <div className="h-px w-16 bg-[#8a1538]/30 self-center" />
            <span className="text-[#8a1538]/60 text-xs tracking-[0.3em] uppercase" style={{ textShadow: "0 0 12px rgba(255,255,255,0.5)" }}>
              {isAr ? "أذكى. أسرع. أسهل." : "Smarter. Faster. Easier."}
            </span>
            <div className="h-px w-16 bg-[#8a1538]/30 self-center" />
          </motion.div>
        </motion.div>
      </section>

      {/* App showcase images */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="aspect-[9/16] rounded-2xl border border-[#e9ceb0]/10 overflow-hidden"
                style={{ background: "linear-gradient(135deg, #151820, #1a1e28)" }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[#606062] text-sm">
                    {isAr ? `لقطة ${i}` : `Screenshot ${i}`}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <WaktiPartners lang={lang} />

      {/* Minimal about teaser */}
      <section className="py-24 px-5">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <p className="text-[#8a1538] text-base leading-relaxed" style={{ textShadow: "0 0 12px rgba(255,255,255,0.5), 0 0 24px rgba(255,255,255,0.3)" }}>
            {isAr
              ? "واكتي هو تطبيق شامل مصمم لمساعدتك على تنظيم حياتك بطريقة ذكية وسلسة. من المهام والمواعيد إلى التذكيرات والذكاء الاصطناعي — واكتي هو رفيقك اليومي."
              : "WAKTI is a comprehensive app designed to help you organize your life intelligently and seamlessly. From tasks and events to reminders and AI — WAKTI is your daily companion."}
          </p>
        </motion.div>
      </section>
    </div>
  );
}
