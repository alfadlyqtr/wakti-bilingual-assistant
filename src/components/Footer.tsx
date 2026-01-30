
import { Link } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export function Footer() {
  const { language } = useTheme();

  return (
    <footer className="bg-muted/50 border-t py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-4 text-xs">
            <Link 
              to="/privacy-terms" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("privacyAndTerms", language)}
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link 
              to="/contact" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("contactUs", language)}
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              to="/login"
              className="rounded-full px-3 py-1 bg-[#0c0f14]/60 text-white/85 border border-blue-400/25 backdrop-blur-xl shadow-[0_0_18px_hsla(210,100%,65%,0.35)] hover:text-white hover:bg-blue-500/10 hover:border-blue-300/40 hover:shadow-[0_0_26px_hsla(210,100%,65%,0.55)] transition-all"
            >
              {language === "ar" ? "تسجيل الدخول" : "Sign in"}
            </Link>
            <span className="text-muted-foreground">•</span>
            <a 
              href="https://tmw.qa" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Made by TMW
            </a>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2025 WAKTI. {t("allRightsReserved", language)}
          </p>
        </div>
      </div>
    </footer>
  );
}
