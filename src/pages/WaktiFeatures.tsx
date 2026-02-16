import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import {
  CheckSquare, Calendar, Bell, MessageCircle, Brain,
  Mic, FileText, Palette, Shield, BarChart3,
  Globe, Gamepad2, Music, Heart,
} from "lucide-react";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

const features = [
  { icon: CheckSquare, en: "Smart Tasks", ar: "مهام ذكية", descEn: "Create, prioritize, and share tasks with AI-powered suggestions.", descAr: "أنشئ المهام ورتّبها وشاركها مع اقتراحات الذكاء الاصطناعي." },
  { icon: Calendar, en: "Unified Calendar", ar: "تقويم موحد", descEn: "See tasks, events, and reminders all in one calendar view.", descAr: "شاهد المهام والمواعيد والتذكيرات في تقويم واحد." },
  { icon: Bell, en: "Smart Reminders", ar: "تذكيرات ذكية", descEn: "Time-based and recurring reminders that never let you forget.", descAr: "تذكيرات زمنية ومتكررة لن تنسى شيئاً بعد اليوم." },
  { icon: MessageCircle, en: "Messaging", ar: "المراسلة", descEn: "Chat with contacts — text, voice, and images.", descAr: "تواصل مع جهات الاتصال — نصوص وصوت وصور." },
  { icon: Brain, en: "AI Assistant", ar: "مساعد ذكي", descEn: "Powered by advanced AI for task generation, summaries, and more.", descAr: "مدعوم بالذكاء الاصطناعي لتوليد المهام والملخصات والمزيد." },
  { icon: Mic, en: "Voice Studio", ar: "استوديو الصوت", descEn: "Voice transcription, text-to-speech, and audio summaries.", descAr: "نسخ صوتي وتحويل النص لصوت وملخصات صوتية." },
  { icon: FileText, en: "Text Generator", ar: "مولد النصوص", descEn: "Generate and translate text with AI precision.", descAr: "أنشئ وترجم النصوص بدقة الذكاء الاصطناعي." },
  { icon: Palette, en: "Event Design", ar: "تصميم المواعيد", descEn: "Create beautiful invitations and RSVP-enabled events.", descAr: "أنشئ دعوات جميلة ومواعيد مع خاصية الحضور." },
  { icon: Shield, en: "Privacy First", ar: "الخصوصية أولاً", descEn: "Your data is yours. Full control over privacy settings.", descAr: "بياناتك ملكك. تحكم كامل في إعدادات الخصوصية." },
  { icon: BarChart3, en: "Analytics", ar: "التحليلات", descEn: "Track your productivity with insightful charts.", descAr: "تتبع إنتاجيتك برسوم بيانية ذكية." },
  { icon: Globe, en: "Bilingual", ar: "ثنائي اللغة", descEn: "Full Arabic and English support throughout the app.", descAr: "دعم كامل للعربية والإنجليزية في التطبيق." },
  { icon: Gamepad2, en: "Games", ar: "ألعاب", descEn: "Fun word games to play with friends in real-time.", descAr: "ألعاب كلمات ممتعة للعب مع الأصدقاء في الوقت الحقيقي." },
  { icon: Music, en: "Music Studio", ar: "استوديو الموسيقى", descEn: "Create and share AI-generated music tracks.", descAr: "أنشئ وشارك مقطوعات موسيقية بالذكاء الاصطناعي." },
  { icon: Heart, en: "Vitality", ar: "الحيوية", descEn: "Track fitness and wellness with connected wearables.", descAr: "تتبع اللياقة والعافية مع الأجهزة القابلة للارتداء." },
];

export default function WaktiFeatures() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "المميزات" : "Features"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-center text-[#858384] mb-16 max-w-lg mx-auto"
        >
          {isAr
            ? "كل ما تحتاجه لتنظيم حياتك — في تطبيق واحد."
            : "Everything you need to organize your life — in one app."}
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-[#e9ceb0]/8 p-6 hover:border-[#e9ceb0]/20 transition-all duration-300 group"
                style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border border-[#e9ceb0]/15 group-hover:border-[#e9ceb0]/30 transition-colors"
                  style={{ background: "rgba(233,206,176,0.06)" }}>
                  <Icon size={20} className="text-[#e9ceb0]" />
                </div>
                <h3 className="text-[#e9ceb0] font-semibold mb-2 text-base">
                  {isAr ? f.ar : f.en}
                </h3>
                <p className="text-[#858384] text-sm leading-relaxed">
                  {isAr ? f.descAr : f.descEn}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
