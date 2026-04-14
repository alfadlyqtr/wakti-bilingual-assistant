import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Send, BookOpen, Star, Mic } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";

const PROMPT_SHORTCUTS = [
  { en: "What is the main message?", ar: "ما هي الرسالة الرئيسية؟" },
  { en: "Explain this simply", ar: "اشرح هذا بأسلوب بسيط" },
  { en: "What can I learn from this?", ar: "ماذا أتعلم من هذا؟" },
  { en: "Give me a summary", ar: "أعطني ملخصاً" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  source_ref?: string;
}

export default function DeenAsk() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const isAr = language === "ar";

  const [sourceType, setSourceType] = useState<"quran" | "hadith">("quran");
  const [sourceRef, setSourceRef] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleShortcut = (s: typeof PROMPT_SHORTCUTS[0]) => {
    setQuestion(isAr ? s.ar : s.en);
  };

  const handleSend = async () => {
    const q = question.trim();
    if (!q) return;
    if (!sourceRef.trim()) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: isAr
          ? "⚠️ يرجى إدخال مرجع المصدر أولاً (مثال: سورة البقرة 2:255 أو صحيح البخاري رقم 1)"
          : "⚠️ Please enter a source reference first (e.g. Al-Baqarah 2:255 or Bukhari #1)",
      }]);
      return;
    }
    if (!sourceText.trim()) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: isAr
          ? "⚠️ يرجى إدخال نص المصدر للحصول على إجابة دقيقة"
          : "⚠️ Please enter the source text to get an accurate answer",
      }]);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("deen-ask", {
        body: {
          question: q,
          source_type: sourceType,
          source_ref: sourceRef.trim(),
          source_text: sourceText.trim(),
          language,
        },
      });
      if (error) throw error;
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data?.answer ?? (isAr ? "حدث خطأ." : "An error occurred."),
        source_ref: data?.source_ref,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: isAr ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col pb-4"
      style={{ background: "linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)" }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: "rgba(12,15,20,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/deen")}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className="w-4 h-4 text-[#f2f2f2]" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-[#f2f2f2]">{isAr ? "اسأل" : "Ask"}</h1>
            <p className="text-[10px] text-[#858384]">
              {isAr ? "إجابات مستندة للمصدر فقط" : "Source-grounded answers only"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {/* Source type selector */}
        <div
          className="flex rounded-xl p-1 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(["quran", "hadith"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSourceType(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
              style={
                sourceType === t
                  ? {
                      background: t === "quran" ? "hsla(210,100%,65%,0.15)" : "hsla(142,76%,55%,0.15)",
                      color: t === "quran" ? "#7dd3fc" : "#4ade80",
                      border: `1px solid ${t === "quran" ? "hsla(210,100%,65%,0.3)" : "hsla(142,76%,55%,0.3)"}`,
                    }
                  : { color: "#858384" }
              }
            >
              {t === "quran" ? <BookOpen className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              {t === "quran" ? (isAr ? "قرآن" : "Quran") : (isAr ? "حديث" : "Hadith")}
            </button>
          ))}
        </div>

        {/* Source reference input */}
        <div className="mb-2">
          <label className="text-[10px] font-semibold text-[#858384] uppercase tracking-wider mb-1 block">
            {isAr ? "مرجع المصدر" : "Source Reference"}
          </label>
          <input
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder={isAr ? "مثال: البقرة 2:255" : "e.g. Al-Baqarah 2:255"}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-[#f2f2f2] outline-none placeholder:text-[#606062]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>

        {/* Source text input */}
        <div className="mb-4">
          <label className="text-[10px] font-semibold text-[#858384] uppercase tracking-wider mb-1 block">
            {isAr ? "نص المصدر" : "Source Text"}
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={isAr ? "الصق نص الآية أو الحديث هنا..." : "Paste the verse or hadith text here..."}
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-[#f2f2f2] outline-none placeholder:text-[#606062] resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>

        {/* Disclaimer */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}
        >
          <p className="text-[10px] text-amber-400/80 leading-relaxed">
            {isAr
              ? "⚠️ الإجابات للتعلم والفهم فقط. للفتاوى الشرعية، يُرجى الرجوع إلى الأوقاف أو عالم موثوق."
              : "⚠️ Answers are for learning & understanding only. For rulings, consult your local Awqaf or a trusted scholar."}
          </p>
        </div>

        {/* Shortcuts */}
        {messages.length === 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-[#858384] uppercase tracking-wider mb-2">
              {isAr ? "اقتراحات" : "Shortcuts"}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROMPT_SHORTCUTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleShortcut(s)}
                  className="text-xs px-3 py-1.5 rounded-full active:scale-95 transition-all"
                  style={{
                    background: "hsla(280,70%,65%,0.08)",
                    border: "1px solid hsla(280,70%,65%,0.2)",
                    color: "#c4b5fd",
                  }}
                >
                  {isAr ? s.ar : s.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-3 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? (isAr ? "justify-start" : "justify-end") : (isAr ? "justify-end" : "justify-start")}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-3"
                style={
                  msg.role === "user"
                    ? {
                        background: "hsla(210,100%,65%,0.12)",
                        border: "1px solid hsla(210,100%,65%,0.2)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                {msg.source_ref && (
                  <div
                    className="text-[9px] font-bold uppercase tracking-wider mb-2 px-2 py-0.5 rounded-full inline-block"
                    style={{ background: "hsla(280,70%,65%,0.12)", color: "#c4b5fd", border: "1px solid hsla(280,70%,65%,0.2)" }}
                  >
                    {msg.source_ref}
                  </div>
                )}
                <p className="text-sm text-[#f2f2f2] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="w-3 h-3 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
                <span className="text-xs text-[#858384]">{isAr ? "جار الشرح..." : "Thinking..."}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-safe">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          <MessageCircle className="w-4 h-4 text-[#606062] flex-shrink-0" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isAr ? "اطرح سؤالك..." : "Ask your question..."}
            className="flex-1 bg-transparent text-[#f2f2f2] text-sm outline-none placeholder:text-[#606062]"
            dir={isAr ? "rtl" : "ltr"}
          />
          <button
            onClick={handleSend}
            disabled={loading || !question.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(280 70% 65%) 0%, hsl(210 100% 65%) 100%)",
              boxShadow: "0 0 12px hsla(280,70%,65%,0.3)",
            }}
            title={isAr ? "إرسال" : "Send"}
          >
            <Send className="w-3.5 h-3.5 text-white" style={{ transform: isAr ? "rotate(180deg)" : undefined }} />
          </button>
        </div>
      </div>
    </div>
  );
}
