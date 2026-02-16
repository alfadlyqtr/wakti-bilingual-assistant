import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import { Check } from "lucide-react";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

const includedFeatures = {
  en: [
    "Unlimited Tasks & Subtasks",
    "Smart AI Assistant",
    "Voice Studio & TTS",
    "Unified Calendar",
    "Messaging & Contacts",
    "Event Design (Maw3d)",
    "Music Studio",
    "Games & Fun",
    "Analytics Dashboard",
    "Bilingual (EN/AR)",
    "Priority Support",
  ],
  ar: [
    "مهام وأجزاء مهام غير محدودة",
    "مساعد ذكي بالذكاء الاصطناعي",
    "استوديو الصوت والنطق",
    "تقويم موحد",
    "المراسلة وجهات الاتصال",
    "تصميم المواعيد (موعد)",
    "استوديو الموسيقى",
    "ألعاب وترفيه",
    "لوحة التحليلات",
    "ثنائي اللغة (عربي/إنجليزي)",
    "دعم مميز",
  ],
};

export default function WaktiPricingPage() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";
  const features = isAr ? includedFeatures.ar : includedFeatures.en;

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-lg mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "الأسعار" : "Pricing"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-[#858384] mb-12"
        >
          {isAr ? "خطة واحدة. كل شيء مشمول." : "One plan. Everything included."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl border border-[#e9ceb0]/15 p-8 text-center"
          style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.9), rgba(26,30,40,0.7))" }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-[#858384] mb-4">
            {isAr ? "الاشتراك الشهري" : "Monthly"}
          </p>
          <div className="mb-2">
            <span className="text-5xl font-bold text-[#e9ceb0]">95</span>
            <span className="text-[#858384] text-lg ms-2">
              {isAr ? "ر.ق / شهر" : "QAR / mo"}
            </span>
          </div>
          <p className="text-[#606062] text-xs mb-8">
            ≈ $24.99 USD
          </p>

          <div className={`text-${isAr ? "right" : "left"} space-y-3`}>
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check size={16} className="text-[#e9ceb0] flex-shrink-0" />
                <span className="text-[#858384] text-sm">{f}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
