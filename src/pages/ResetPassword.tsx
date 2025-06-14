
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get("access_token") || searchParams.get("token");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Translations
  const translations = {
    en: {
      title: "Reset Password",
      sub: "Enter your new password below.",
      password: "Enter New Password",
      submit: "Update Password",
      loading: "Updating...",
      error_invalid_token: "Invalid or expired reset link. Please request a new one.",
      success: "Password updated! Please log in.",
      back: "Back to Home",
      passwordPlaceholder: "New password"
    },
    ar: {
      title: "إعادة تعيين كلمة المرور",
      sub: "أدخل كلمة المرور الجديدة أدناه.",
      password: "أدخل كلمة المرور الجديدة",
      submit: "تحديث كلمة المرور",
      loading: "جارٍ التحديث...",
      error_invalid_token: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.",
      success: "تم تحديث كلمة المرور! يرجى تسجيل الدخول.",
      back: "العودة للرئيسية",
      passwordPlaceholder: "كلمة مرور جديدة"
    }
  };

  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!accessToken) {
      setErrorMsg(t.error_invalid_token);
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg(
        language === "en"
          ? "Password must be at least 6 characters."
          : "يجب أن تكون كلمة المرور 6 أحرف على الأقل."
      );
      return;
    }

    setIsLoading(true);

    try {
      // Set session using the access token from URL (Supabase requirement)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.auth as any).setSession({ access_token: accessToken, refresh_token: accessToken });

      // Now update the password
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || t.error_invalid_token);
      } else {
        navigate("/reset-success");
      }
    } catch (error: any) {
      setErrorMsg(error?.message || t.error_invalid_token);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-container bg-background min-h-screen flex flex-col">
      {/* Header */}
      <header className="mobile-header flex items-center border-b pb-1 px-4">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 mr-2"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs">{t.back}</span>
        </Button>
        <ThemeLanguageToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 px-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-md p-6 space-y-6">
          <div className="flex flex-col items-center mb-2">
            <div className="mb-3">
              <Logo3D size="md" />
            </div>
            <h1 className="text-xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t.sub}</p>
          </div>
          
          {errorMsg && (
            <div className="bg-red-100 text-red-700 rounded-lg text-sm py-2 px-3 text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-base font-medium">
                {t.password}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.passwordPlaceholder}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 py-6 text-base shadow-sm"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((x) => !x)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full text-base py-5 shadow-md hover:shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? t.loading : t.submit}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
