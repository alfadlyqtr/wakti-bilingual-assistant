import { useState } from "react";
import { motion } from "framer-motion";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import type { WaktiLang } from "@/components/wakti-landing/WaktiLayout";

export default function WaktiContactPage() {
  const { lang } = useOutletContext<{ lang: WaktiLang }>();
  const isAr = lang === "ar";
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error(isAr ? "يرجى ملء جميع الحقول" : "Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from("contact_submissions").insert({
        name: form.name,
        email: form.email,
        message: form.message,
        submission_type: "wakti-landing",
      });
      if (error) throw error;
      toast.success(isAr ? "تم إرسال رسالتك بنجاح!" : "Message sent successfully!");
      setForm({ name: "", email: "", message: "" });
    } catch {
      toast.error(isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-24 pb-20 px-5">
      <div className="max-w-lg mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "#e9ceb0", fontFamily: "'Georgia', serif" }}
        >
          {isAr ? "تواصل معنا" : "Contact Us"}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-[#858384] mb-10"
        >
          {isAr ? "نحب أن نسمع منك" : "We'd love to hear from you"}
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#e9ceb0]/10 p-8 space-y-5"
          style={{ background: "linear-gradient(135deg, rgba(21,24,32,0.8), rgba(26,30,40,0.6))" }}
        >
          <div>
            <label className="text-[#858384] text-xs mb-1.5 block">
              {isAr ? "الاسم" : "Name"}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#e9ceb0]/10 text-sm text-[#e9ceb0] placeholder-[#606062] focus:outline-none focus:border-[#e9ceb0]/30 transition-colors"
              style={{ background: "rgba(12,15,20,0.6)" }}
            />
          </div>
          <div>
            <label className="text-[#858384] text-xs mb-1.5 block">
              {isAr ? "البريد الإلكتروني" : "Email"}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#e9ceb0]/10 text-sm text-[#e9ceb0] placeholder-[#606062] focus:outline-none focus:border-[#e9ceb0]/30 transition-colors"
              style={{ background: "rgba(12,15,20,0.6)" }}
            />
          </div>
          <div>
            <label className="text-[#858384] text-xs mb-1.5 block">
              {isAr ? "الرسالة" : "Message"}
            </label>
            <textarea
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#e9ceb0]/10 text-sm text-[#e9ceb0] placeholder-[#606062] focus:outline-none focus:border-[#e9ceb0]/30 transition-colors resize-none"
              style={{ background: "rgba(12,15,20,0.6)" }}
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#e9ceb0", color: "#0c0f14" }}
          >
            <Send size={16} />
            {sending
              ? isAr ? "جاري الإرسال..." : "Sending..."
              : isAr ? "إرسال" : "Send Message"}
          </button>
        </motion.form>

        <div className="mt-10 text-center">
          <a
            href="mailto:hello@wakti.ai"
            className="inline-flex items-center gap-2 text-[#858384] text-sm hover:text-[#e9ceb0] transition-colors"
          >
            <Mail size={16} />
            hello@wakti.ai
          </a>
        </div>
      </div>
    </div>
  );
}
