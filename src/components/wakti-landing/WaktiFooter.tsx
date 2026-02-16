import { Link } from "react-router-dom";
import type { WaktiLang } from "./WaktiLayout";

interface Props {
  lang: WaktiLang;
}

export function WaktiFooter({ lang }: Props) {
  const isAr = lang === "ar";

  return (
    <footer className="border-t border-[#e9ceb0]/10 py-12 px-5" style={{ background: "#0a0c10" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="text-center md:text-left">
            <span className="text-xl font-bold tracking-tight text-[#e9ceb0]"
              style={{ fontFamily: "'Georgia', serif" }}>
              WAKTI
            </span>
            <p className="text-[#858384] text-xs mt-1">
              {isAr ? "بواسطة TMW" : "by TMW"}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#858384]">
            <Link to="/wakti/features" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "المميزات" : "Features"}
            </Link>
            <Link to="/wakti/about" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "عن واكتي" : "About"}
            </Link>
            <Link to="/wakti/pricing" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "الأسعار" : "Pricing"}
            </Link>
            <Link to="/wakti/case-studies" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "دراسات الحالة" : "Case Studies"}
            </Link>
            <Link to="/wakti/blog" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "المدونة" : "Blog"}
            </Link>
            <Link to="/wakti/contact" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "تواصل" : "Contact"}
            </Link>
            <Link to="/privacy-terms" className="hover:text-[#e9ceb0] transition-colors">
              {isAr ? "الخصوصية والشروط" : "Privacy & Terms"}
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-[#606062]">
          © {new Date().getFullYear()} WAKTI.{" "}
          {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}
        </div>
      </div>
    </footer>
  );
}
