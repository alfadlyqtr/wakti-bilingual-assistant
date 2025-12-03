import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";

/**
 * GoodbyeScreen - Displayed after successful account deletion
 * Shows a branded farewell message with option to return home (landing page)
 * Session is already cleared before navigating here (in Account.tsx)
 * This screen stays visible until user clicks "Return to Home"
 */
export default function GoodbyeScreen() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const isArabic = language === "ar";

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted relative"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Language/Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeLanguageToggle />
      </div>
      {/* Wakti Logo */}
      <div className="mb-8">
        <img 
          src="/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png" 
          alt="Wakti" 
          className="h-20 w-auto opacity-60"
        />
      </div>

      {/* Sad Face Emoji */}
      <div className="text-7xl mb-6">😢</div>

      {/* Farewell Message */}
      <h1 className="text-2xl font-bold text-center mb-4 text-foreground">
        {isArabic ? "وداعاً" : "Goodbye"}
      </h1>

      <p className="text-center text-muted-foreground max-w-md mb-8 leading-relaxed">
        {isArabic 
          ? "تم حذف حسابك وجميع بياناتك بنجاح. نأسف لرؤيتك تغادر. إذا غيرت رأيك، يسعدنا دائماً أن نرحب بك مرة أخرى."
          : "Your account and all your data have been successfully deleted. We're sad to see you go. If you ever change your mind, we'd be happy to welcome you back."
        }
      </p>

      {/* Confirmation Badge */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 mb-8">
        <p className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2">
          <span>✓</span>
          {isArabic ? "تم حذف جميع البيانات نهائياً" : "All data permanently deleted"}
        </p>
      </div>

      {/* Return Home Button */}
      <Button
        variant="outline"
        onClick={() => navigate("/")}
        className="min-w-[200px]"
      >
        {isArabic ? "العودة للصفحة الرئيسية" : "Return to Home"}
      </Button>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-12">
        {isArabic ? "شكراً لاستخدامك Wakti" : "Thank you for using Wakti"}
      </p>
    </div>
  );
}
