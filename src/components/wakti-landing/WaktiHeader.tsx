import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WaktiLang } from "./WaktiLayout";

// Detect if on wakti.ai root domain — use clean paths
function isWaktiDomain() {
  const h = window.location.hostname;
  return h === 'wakti.ai' || h === 'www.wakti.ai';
}

const prefix = isWaktiDomain() ? "" : "/wakti";

const navItems = [
  { path: `${prefix}/`, labelEn: "Home", labelAr: "الرئيسية" },
  { path: `${prefix}/features`, labelEn: "Features", labelAr: "المميزات" },
  { path: `${prefix}/about`, labelEn: "About", labelAr: "عن واكتي" },
  { path: `${prefix}/pricing`, labelEn: "Pricing", labelAr: "الأسعار" },
  { path: `${prefix}/case-studies`, labelEn: "Case Studies", labelAr: "دراسات الحالة" },
  { path: `${prefix}/blog`, labelEn: "Blog", labelAr: "المدونة" },
  { path: `${prefix}/contact`, labelEn: "Contact", labelAr: "تواصل" },
];

interface Props {
  lang: WaktiLang;
  setLang: (l: WaktiLang) => void;
}

export function WaktiHeader({ lang, setLang }: Props) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isActive = (path: string) => {
    if (path === `${prefix}/`) return location.pathname === path || location.pathname === prefix;
    return location.pathname === path;
  };

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      toggleRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus first link when menu opens
  useEffect(() => {
    if (open && menuRef.current) {
      const firstLink = menuRef.current.querySelector("a");
      firstLink?.focus();
    }
  }, [open]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-[#e9ceb0]/10"
      style={{ background: "rgba(12,15,20,0.88)" }}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={`${prefix}/`} className="flex items-center gap-2">
          <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="WAKTI" className="h-9 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item.path) ? "page" : undefined}
              className={`text-sm tracking-wide transition-colors duration-200 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e9ceb0] ${
                isActive(item.path)
                  ? "text-[#e9ceb0]"
                  : "text-[#858384] hover:text-[#e9ceb0]"
              }`}
            >
              {lang === "ar" ? item.labelAr : item.labelEn}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            aria-label={lang === "en" ? "Switch to Arabic" : "Switch to English"}
            className="text-xs px-3 py-1.5 rounded-full border border-[#e9ceb0]/30 text-[#e9ceb0] hover:bg-[#e9ceb0]/10 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e9ceb0]"
          >
            {lang === "en" ? "العربية" : "English"}
          </button>

          {/* Mobile hamburger */}
          <button
            ref={toggleRef}
            className="md:hidden text-[#e9ceb0] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e9ceb0]"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            ref={menuRef}
            id="mobile-nav-menu"
            role="navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden overflow-y-auto max-h-[70vh] border-b border-[#e9ceb0]/10"
            style={{ background: "rgba(12,15,20,0.98)" }}
          >
            <ul className="flex flex-col items-center gap-4 py-6 px-5 list-none" role="list">
              {navItems.map((item, i) => (
                <motion.li
                  key={item.path}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={item.path}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.path) ? "page" : undefined}
                    className={`text-lg font-light tracking-widest transition-colors block py-1 px-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e9ceb0] focus-visible:bg-[#e9ceb0]/10 ${
                      isActive(item.path) ? "text-white" : "text-[#e9ceb0] hover:text-white"
                    }`}
                  >
                    {lang === "ar" ? item.labelAr : item.labelEn}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
