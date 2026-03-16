import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";

// Landing components
import { HeroScene } from "@/components/landing/HeroScene";
import { PricingScene } from "@/components/landing/PricingScene";
import { InvitationScene } from "@/components/landing/InvitationScene";
import { SectionA, SectionB, SectionC, SectionD, SectionE } from "@/components/landing/BentoFeatureSection";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Add landing-page class to body
  useEffect(() => {
    document.body.classList.add("landing-page");
    return () => {
      document.body.classList.remove("landing-page");
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const pct = maxScroll <= 0 ? 0 : el.scrollTop / maxScroll;
      setShowScrollTop(pct >= 0.25);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const lang = language as "en" | "ar";

  return (
    <div 
      ref={containerRef}
      className="scroll-snap-container scrollbar-hide"
      style={{ 
        height: "100dvh",
        overflowY: "scroll",
        overflowX: "hidden",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        paddingBottom: "72px",
      }}
    >
      {showScrollTop && (
        <button
          type="button"
          onClick={() => {
            containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-[#0c0f14]/70 border border-blue-400/25 backdrop-blur-xl text-blue-100 shadow-[0_0_26px_hsla(210,100%,65%,0.45)] transition-all duration-300 hover:shadow-[0_0_34px_hsla(210,100%,65%,0.65)] hover:bg-blue-500/10 active:scale-95"
          aria-label="Scroll to top"
        >
          <span className="block text-lg leading-none">^</span>
        </button>
      )}

      {/* Scene 1: Hero */}
      <HeroScene language={lang} />

      {/* Scenes 2–6: Grouped Bento Feature Sections */}
      <SectionA language={lang} />
      <SectionB language={lang} />
      <SectionC language={lang} />
      <SectionD language={lang} />
      <SectionE language={lang} />

      {/* Scene 6: Pricing */}
      <PricingScene language={lang} />

      {/* Scene 7: Invitation / Final CTA */}
      <InvitationScene language={lang} />

      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="w-full border-t border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-3 flex flex-col items-center gap-2.5">
            {/* Line 1: Sign in CTA (stretched & centered) */}
            <Link
              to="/login"
              className="rounded-full w-48 py-1.5 text-center bg-[#0c0f14]/60 text-white/90 border border-blue-400/30 backdrop-blur-xl shadow-[0_0_15px_hsla(210,100%,65%,0.3)] hover:text-white hover:bg-blue-500/15 hover:border-blue-300/50 hover:shadow-[0_0_25px_hsla(210,100%,65%,0.5)] transition-all text-[13px] font-medium tracking-wide"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Sign in"}
            </Link>
            
            {/* Line 2: Links */}
            <div className="flex flex-row flex-wrap items-center justify-center gap-2 text-[10px] md:text-[11px] text-white/60">
              <Link to="/privacy-terms" className="hover:text-white transition-colors">
                {lang === "ar" ? "الخصوصية والشروط" : "Privacy & Terms"}
              </Link>
              <span className="text-white/30">•</span>
              <Link to="/contact" className="hover:text-white transition-colors">
                {lang === "ar" ? "تواصل معنا" : "Contact Us"}
              </Link>
              <span className="text-white/30">•</span>
              <a
                href="https://wakti.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                {lang === "ar" ? "صنع بواسطة شركة وقتي" : "Made by WAKTI AI LLC"}
              </a>
            </div>
            
            {/* Line 3: Copyright */}
            <div className="text-center text-[9px] md:text-[10px] text-white/40">
              © 2026 WAKTI. {lang === "ar" ? "جميع الحقوق محفوظة" : "All Rights Reserved"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
