
import { CheckCircle2 } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/LoginForm";
import { useNavigate } from "react-router-dom";

export default function ResetSuccess() {
  const { language } = useTheme();
  const navigate = useNavigate();

  const translations = {
    en: {
      success: "Your password has been updated. Please log in.",
      login: "Login",
      back: "Back to Home",
    },
    ar: {
      success: "تم تحديث كلمة المرور بنجاح. يرجى تسجيل الدخول.",
      login: "تسجيل الدخول",
      back: "العودة للرئيسية",
    },
  };
  const t = translations[language];

  return (
    <div className="mobile-container bg-background min-h-screen flex flex-col">
      {/* Header */}
      <header className="mobile-header flex items-center justify-between border-b px-4 py-2">
        <div
          className="cursor-pointer flex items-center"
          onClick={() => navigate("/home")}
        >
          <Logo3D size="sm" />
        </div>
        <ThemeLanguageToggle />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center py-4 px-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-md p-6 space-y-6">
          <div className="flex flex-col items-center">
            <CheckCircle2 className="h-14 w-14 text-green-500 my-4" />
            <div className="text-lg font-semibold text-center">{t.success}</div>
          </div>
          {/* Full login form below */}
          <LoginForm
            redirectTo="/dashboard"
            showForgotPassword={true}
            showSignupLink={true}
          />
        </div>
      </div>
    </div>
  );
}
