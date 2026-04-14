import { useNavigate } from "react-router-dom";
import { BookOpen, MessageCircle, Brain, ChevronRight, Star } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

const tabs = [
  {
    id: "quran",
    labelEn: "Quran",
    labelAr: "القرآن",
    path: "/deen/quran",
    gradient: "from-sky-500 to-blue-700",
    glow: "hsla(210,100%,65%,0.5)",
    icon: BookOpen,
    descEn: "Read, listen & understand",
    descAr: "اقرأ، استمع وافهم",
  },
  {
    id: "hadith",
    labelEn: "Hadith",
    labelAr: "الحديث",
    path: "/deen/hadith",
    gradient: "from-emerald-500 to-green-700",
    glow: "hsla(142,76%,55%,0.5)",
    icon: Star,
    descEn: "Browse & understand Hadith",
    descAr: "تصفح وافهم الحديث",
  },
  {
    id: "ask",
    labelEn: "Ask",
    labelAr: "اسأل",
    path: "/deen/ask",
    gradient: "from-purple-500 to-violet-700",
    glow: "hsla(280,70%,65%,0.5)",
    icon: MessageCircle,
    descEn: "Ask with source-grounded answers",
    descAr: "اسأل بإجابات مستندة للمصدر",
  },
  {
    id: "study",
    labelEn: "Study",
    labelAr: "الدراسة",
    path: "/deen/study",
    gradient: "from-amber-500 to-orange-600",
    glow: "hsla(45,100%,60%,0.5)",
    icon: Brain,
    descEn: "Memorize, track & plan",
    descAr: "احفظ، تتبع وخطط",
  },
];

export default function Deen() {
  const navigate = useNavigate();
  const { language, theme } = useTheme();
  const isAr = language === "ar";
  const isDark = theme === "dark";

  const pageBg = isDark
    ? "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 25%, hsl(250 20% 8%) 50%, hsl(260 15% 9%) 75%, #0c0f14 100%)"
    : "linear-gradient(135deg, #fcfefd 0%, hsl(200 25% 95%) 50%, #fcfefd 100%)";
  const textPrimary = isDark ? "#f2f2f2" : "#060541";
  const textSecondary = isDark ? "#858384" : "#606062";
  const cardBg = isDark
    ? "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 100%)"
    : "linear-gradient(135deg, #fcfefd 0%, hsl(200 15% 96%) 100%)";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(6,5,65,0.09)";

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: pageBg }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(210 100% 65%) 0%, hsl(280 70% 65%) 100%)",
              boxShadow: "0 0 20px hsla(210,100%,65%,0.4), 0 0 40px hsla(280,70%,65%,0.2)",
            }}
          >
            <BookOpen className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide" style={{ color: textPrimary }}>Deen</h1>
            <p className="text-xs" style={{ color: textSecondary }}>
              {isAr ? "القرآن والحديث والفهم والحفظ" : "Quran, Hadith, understanding & memorization"}
            </p>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="px-5 mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: textSecondary }}>
          {isAr ? "ابدأ" : "Explore"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="relative overflow-hidden rounded-2xl p-4 text-left active:scale-95 transition-all duration-150 flex flex-col gap-2"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: `0 4px 24px ${tab.glow.replace("0.5", "0.15")}`,
                }}
              >
                {/* glow background */}
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${tab.glow}, transparent 70%)` }}
                />
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center`}
                  style={{ boxShadow: `0 0 16px ${tab.glow}` }}
                >
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: textPrimary }}>
                    {isAr ? tab.labelAr : tab.labelEn}
                  </p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: textSecondary }}>
                    {isAr ? tab.descAr : tab.descEn}
                  </p>
                </div>
                <ChevronRight
                  className="absolute bottom-3 right-3 w-4 h-4"
                  style={{ color: textSecondary, transform: isAr ? "rotate(180deg)" : undefined }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-5 mt-8">
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <p className="text-[11px] text-amber-400/80 leading-relaxed text-center">
            {isAr
              ? "⚠️ هذه الأداة للتعلم والفهم فقط. للفتاوى الشرعية، يُرجى الرجوع إلى الأوقاف أو عالم موثوق."
              : "⚠️ This tool is for learning and understanding only. For religious rulings, please consult your local Awqaf or a trusted scholar."}
          </p>
        </div>
      </div>
    </div>
  );
}

