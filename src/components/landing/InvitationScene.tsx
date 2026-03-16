import { motion } from "framer-motion";
import { LandingScene } from "./LandingScene";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Star } from "lucide-react";

interface InvitationSceneProps {
  language?: "en" | "ar";
}

export function InvitationScene({ language = "en" }: InvitationSceneProps) {
  const navigate = useNavigate();
  const isArabic = language === "ar";

  const featureChips = isArabic
    ? ["🤖 AI Chat", "🎨 توليد صور", "💻 مبرمج AI", "🎙️ استنساخ صوت", "🌐 ترجمة", "✅ مهام", "📅 تقويم", "❤️ صحة", "🎮 ألعاب", "🎬 فيديو", "+ أكثر"]
    : ["🤖 AI Chat", "🎨 Image Gen", "💻 AI Coder", "🎙️ Voice Clone", "🌐 Translation", "✅ Tasks", "📅 Calendar", "❤️ Vitality", "🎮 Games", "🎬 Studio", "+ more"];

  return (
    <LandingScene
      id="invitation"
      className="bg-[#0c0f14]"
      gradient="radial-gradient(ellipse 80% 60% at 50% 40%, rgba(233,206,176,0.07) 0%, transparent 65%)"
    >
      <div className="flex flex-col items-center text-center w-full max-w-sm">

        {/* ── 23+ badge ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mb-5"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(233,206,176,0.16) 0%, rgba(196,164,126,0.1) 100%)",
              border: "1px solid rgba(233,206,176,0.3)",
              boxShadow: "0 0 30px rgba(233,206,176,0.12)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#e9ceb0]" />
            <span className="text-[#e9ceb0] text-[11px] font-bold tracking-[0.2em] uppercase">
              {isArabic ? "٢٣+ ميزة AI بريميوم" : "23+ Premium AI Features"}
            </span>
          </div>
        </motion.div>

        {/* ── Headline ── */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.08 }}
          className="font-extralight tracking-[0.06em] text-white mb-2"
          style={{ fontSize: 28, lineHeight: 1.25 }}
        >
          {isArabic ? "انضم إلى الآلاف" : "Join Thousands"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="text-white/55 font-light text-[15px] mb-5 max-w-[260px] leading-relaxed"
        >
          {isArabic
            ? "مستخدمون حول العالم يستمتعون بتجربة وقتي كل يوم"
            : "Already enjoying the WAKTI experience every day"}
        </motion.p>

        {/* ── Social proof row ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#e9ceb0]" />
            <span className="text-white/60 text-[11px] font-medium">
              {isArabic ? "آلاف المستخدمين" : "Thousands of users"}
            </span>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className="w-2.5 h-2.5 text-[#e9ceb0] fill-[#e9ceb0]" />
            ))}
          </div>
        </motion.div>

        {/* ── Feature chips scroll ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="w-full mb-7 overflow-hidden"
        >
          <div
            className="flex gap-2 flex-wrap justify-center"
            style={{ maxHeight: 72, overflow: "hidden" }}
          >
            {featureChips.map((chip, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.03 }}
                className="text-[10.5px] font-medium px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.65)",
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* ── App Store Badges ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex items-center gap-3 mb-6"
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
              className="h-9 opacity-75 hover:opacity-100 transition-opacity"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
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
              className="h-9 opacity-75 hover:opacity-100 transition-opacity"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </a>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.42 }}
          className="w-full"
        >
          <Button
            onClick={() => navigate("/signup")}
            className="w-full py-6 rounded-full text-sm font-bold tracking-[0.07em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #e9ceb0 0%, #c5a47e 50%, #e9ceb0 100%)",
              color: "#060541",
              boxShadow: "0 8px 36px rgba(233,206,176,0.38), 0 0 60px rgba(233,206,176,0.12)",
            }}
          >
            <span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 55%)" }}
            />
            <span className="relative z-10">
              {isArabic ? "ابدأ وقتي مجاناً" : "START WAKTI FOR FREE"}
            </span>
          </Button>

          <p className="text-white/35 text-[10px] mt-3 font-light tracking-wide text-center">
            {isArabic ? "لا بطاقة ائتمان مطلوبة · ابدأ مجاناً" : "No credit card required · Start free today"}
          </p>
        </motion.div>
      </div>
    </LandingScene>
  );
}
