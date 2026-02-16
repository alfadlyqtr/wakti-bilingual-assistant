import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

export default function WaktiAbout() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-3xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-6"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "عن واكتي" : "About WAKTI"}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-8 text-[#858384] leading-relaxed"
        >
          <div className="rounded-2xl border border-[#e9ceb0]/8 p-8"
            style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}>
            <h2 className="text-[#e9ceb0] text-xl font-semibold mb-4">
              {isAr ? "رؤيتنا" : "Our Vision"}
            </h2>
            <p>
              {isAr
                ? "نسعى لجعل إدارة الوقت سهلة وذكية وممتعة. واكتي ليس مجرد تطبيق — إنه رفيق يومي يفهم احتياجاتك ويساعدك على تحقيق أهدافك بكفاءة."
                : "We strive to make time management easy, intelligent, and enjoyable. WAKTI is more than an app — it's a daily companion that understands your needs and helps you achieve your goals efficiently."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e9ceb0]/8 p-8"
            style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}>
            <h2 className="text-[#e9ceb0] text-xl font-semibold mb-4">
              {isAr ? "مهمتنا" : "Our Mission"}
            </h2>
            <p>
              {isAr
                ? "بناء أدوات إنتاجية تجمع بين الذكاء الاصطناعي والتصميم الأنيق لمساعدة الأفراد والفرق في المنطقة العربية والعالم."
                : "Build productivity tools that combine artificial intelligence with elegant design to help individuals and teams across the Arab world and beyond."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e9ceb0]/8 p-8"
            style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}>
            <h2 className="text-[#e9ceb0] text-xl font-semibold mb-4">
              {isAr ? "من نحن" : "Who We Are"}
            </h2>
            <p>
              {isAr
                ? "واكتي من تطوير TMW — فريق شغوف بالتكنولوجيا والتصميم، مقره في قطر. نؤمن بأن الأدوات الجيدة تصنع فارقاً حقيقياً في حياة الناس."
                : "WAKTI is developed by TMW — a team passionate about technology and design, based in Qatar. We believe great tools make a real difference in people's lives."}
            </p>
          </div>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <h2 className="text-[#e9ceb0] text-xl font-semibold text-center mb-10"
            style={{ fontFamily: "'Georgia', serif" }}>
            {isAr ? "المراحل" : "Milestones"}
          </h2>
          <div className="space-y-6">
            {[
              { year: "2024", en: "WAKTI concept & development begins", ar: "بداية تطوير فكرة واكتي" },
              { year: "2025", en: "Beta launch with core features", ar: "إطلاق النسخة التجريبية" },
              { year: "2025", en: "AI integration & public launch", ar: "تكامل الذكاء الاصطناعي والإطلاق العام" },
            ].map((m, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-[#e9ceb0] text-sm font-mono mt-0.5">{m.year}</span>
                <div className="w-px h-6 bg-[#e9ceb0]/20 mt-1" />
                <p className="text-[#858384] text-sm">{isAr ? m.ar : m.en}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
