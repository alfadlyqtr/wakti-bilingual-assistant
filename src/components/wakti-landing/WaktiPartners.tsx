import { motion } from "framer-motion";
import type { WaktiLang } from "./WaktiLayout";
import mcitLogo from "@/assets/partners/mcit-logo.jpg";
import qstpLogo from "@/assets/partners/qstp-logo.png";
import websummitLogo from "@/assets/partners/websummit-logo.webp";

const partners = [
  { name: "MCIT", logo: mcitLogo },
  { name: "QSTP", logo: qstpLogo },
  { name: "Web Summit Qatar", logo: websummitLogo },
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
            <div key={i} className="flex-shrink-0 h-16 px-4 flex items-center justify-center">
              <img src={p.logo} alt={p.name} className="h-12 w-auto object-contain brightness-0 invert opacity-70" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
