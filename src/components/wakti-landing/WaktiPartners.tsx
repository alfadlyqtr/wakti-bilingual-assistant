import { motion } from "framer-motion";
import type { WaktiLang } from "./WaktiLayout";

const partners = [
  { name: "TMW", logoText: "TMW" },
  { name: "Qatar", logoText: "QA" },
  { name: "Partner 1", logoText: "P1" },
  { name: "Partner 2", logoText: "P2" },
  { name: "Partner 3", logoText: "P3" },
  { name: "Partner 4", logoText: "P4" },
];

interface Props {
  lang: WaktiLang;
}

export function WaktiPartners({ lang }: Props) {
  const isAr = lang === "ar";
  const doubled = [...partners, ...partners];

  return (
    <section className="py-16 overflow-hidden">
      <p className="text-center text-xs uppercase tracking-[0.3em] text-[#858384] mb-10">
        {isAr ? "شركاؤنا" : "Our Partners"}
      </p>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10"
          style={{ background: "linear-gradient(to right, #0c0f14, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10"
          style={{ background: "linear-gradient(to left, #0c0f14, transparent)" }} />

        <motion.div
          className="flex gap-16 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          {doubled.map((p, i) => (
            <div key={i} className="flex-shrink-0 w-24 h-12 rounded-lg border border-[#e9ceb0]/10 flex items-center justify-center">
              <span className="text-[#858384] text-sm font-medium tracking-wider">{p.logoText}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
