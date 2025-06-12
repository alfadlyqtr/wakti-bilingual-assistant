
import { Link } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export function Footer() {
  const { language } = useTheme();

  return (
    <footer className="bg-muted/50 border-t mt-8 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-6">
            <Link 
              to="/privacy-terms" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("privacyAndTerms", language)}
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link 
              to="/contact" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("contactUs", language)}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2025 WAKTI. {t("allRightsReserved", language)}
          </p>
        </div>
      </div>
    </footer>
  );
}
