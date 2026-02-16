import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, Clock, Users, Zap } from "lucide-react";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

const caseStudies = [
  {
    logoText: "TMW",
    titleEn: "TMW Creative Agency",
    titleAr: "وكالة TMW الإبداعية",
    descEn: "TMW leveraged WAKTI to streamline internal project management across their creative team, reducing task handoff delays and improving sprint delivery timelines.",
    descAr: "استخدمت TMW واكتي لتبسيط إدارة المشاريع الداخلية عبر فريقها الإبداعي، مما قلل من تأخيرات تسليم المهام وحسّن جداول التسليم.",
    metrics: [
      { icon: TrendingUp, valueEn: "40%", valueAr: "٤٠٪", labelEn: "Faster delivery", labelAr: "تسليم أسرع" },
      { icon: Clock, valueEn: "3hrs", valueAr: "٣ ساعات", labelEn: "Saved daily", labelAr: "توفير يومي" },
    ],
  },
  {
    logoText: "EDU",
    titleEn: "Qatar Education Hub",
    titleAr: "مركز التعليم القطري",
    descEn: "An educational institution adopted WAKTI to manage scheduling for 200+ instructors, integrating calendar sync and smart reminders to eliminate double-bookings.",
    descAr: "اعتمدت مؤسسة تعليمية واكتي لإدارة جداول أكثر من ٢٠٠ مدرّس، مع مزامنة التقويم والتذكيرات الذكية للقضاء على الحجوزات المزدوجة.",
    metrics: [
      { icon: Users, valueEn: "200+", valueAr: "٢٠٠+", labelEn: "Instructors managed", labelAr: "مدرّس يُدار" },
      { icon: Zap, valueEn: "0", valueAr: "٠", labelEn: "Double-bookings", labelAr: "حجوزات مزدوجة" },
    ],
  },
  {
    logoText: "FIN",
    titleEn: "Gulf Finance Co.",
    titleAr: "شركة الخليج المالية",
    descEn: "A financial services firm used WAKTI's AI assistant and voice transcription to automate meeting notes and action items, freeing analysts to focus on higher-value work.",
    descAr: "استخدمت شركة خدمات مالية مساعد واكتي الذكي والنسخ الصوتي لأتمتة ملاحظات الاجتماعات وبنود العمل، مما أتاح للمحللين التركيز على عمل أعلى قيمة.",
    metrics: [
      { icon: TrendingUp, valueEn: "65%", valueAr: "٦٥٪", labelEn: "Less manual notes", labelAr: "ملاحظات يدوية أقل" },
      { icon: Clock, valueEn: "2x", valueAr: "٢×", labelEn: "Faster follow-ups", labelAr: "متابعات أسرع" },
    ],
  },
];

export default function WaktiCaseStudies() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "دراسات الحالة" : "Case Studies"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-[#858384] mb-16 max-w-lg mx-auto"
        >
          {isAr
            ? "كيف تستخدم المؤسسات واكتي لتحقيق نتائج استثنائية."
            : "How organizations use WAKTI to achieve exceptional results."}
        </motion.p>

        <div className="space-y-8">
          {caseStudies.map((cs, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[#e9ceb0]/8 p-8 hover:border-[#e9ceb0]/15 transition-all duration-300"
              style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Logo */}
                <div className="flex-shrink-0 w-16 h-16 rounded-xl border border-[#e9ceb0]/15 flex items-center justify-center"
                  style={{ background: "rgba(233,206,176,0.06)" }}>
                  <span className="text-[#e9ceb0] text-sm font-bold tracking-wider">{cs.logoText}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-[#e9ceb0] text-xl font-semibold mb-3"
                    style={{ fontFamily: "'Georgia', serif" }}>
                    {isAr ? cs.titleAr : cs.titleEn}
                  </h2>
                  <p className="text-[#858384] text-sm leading-relaxed mb-6">
                    {isAr ? cs.descAr : cs.descEn}
                  </p>

                  {/* Metrics */}
                  <div className="flex flex-wrap gap-4">
                    {cs.metrics.map((m, j) => {
                      const Icon = m.icon;
                      return (
                        <div
                          key={j}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e9ceb0]/8"
                          style={{ background: "rgba(233,206,176,0.04)" }}
                        >
                          <Icon size={18} className="text-[#e9ceb0] flex-shrink-0" />
                          <div>
                            <span className="text-[#e9ceb0] text-lg font-bold block leading-none">
                              {isAr ? m.valueAr : m.valueEn}
                            </span>
                            <span className="text-[#606062] text-xs">
                              {isAr ? m.labelAr : m.labelEn}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
