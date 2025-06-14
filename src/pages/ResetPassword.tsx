
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock } from "lucide-react";
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

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Translations
  const translations = {
    en: {
      title: "Reset Password",
      sub: "Enter your new password below.",
      password: "Enter New Password",
      confirmPassword: "Confirm New Password",
      submit: "Update Password",
      loading: "Updating...",
      error_invalid_token: "Invalid or expired reset link. Please request a new one.",
      error_password_mismatch: "Passwords do not match.",
      success: "Password updated! Please log in.",
      back: "Back to Home",
      passwordPlaceholder: "New password",
      confirmPasswordPlaceholder: "Re-enter new password"
    },
    ar: {
      title: "إعادة تعيين كلمة المرور",
      sub: "أدخل كلمة المرور الجديدة أدناه.",
      password: "أدخل كلمة المرور الجديدة",
      confirmPassword: "تأكيد كلمة المرور الجديدة",
      submit: "تحديث كلمة المرور",
      loading: "جارٍ التحديث...",
      error_invalid_token: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.",
      error_password_mismatch: "كلمات المرور غير متطابقة.",
      success: "تم تحديث كلمة المرور! يرجى تسجيل الدخول.",
      back: "العودة للرئيسية",
      passwordPlaceholder: "كلمة مرور جديدة",
      confirmPasswordPlaceholder: "أعد إدخال كلمة المرور الجديدة"
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
    if (!confirmPassword || password !== confirmPassword) {
      setErrorMsg(t.error_password_mismatch);
      return;
    }

    setIsLoading(true);

    try {
      await (supabase.auth as any).setSession({ access_token: accessToken, refresh_token: accessToken });
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
      <header className="mobile-header flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center">
          <div
            className="cursor-pointer flex items-center"
            onClick={() => navigate("/home")}
          >
            <Logo3D size="sm" />
          </div>
        </div>
        <ThemeLanguageToggle />
      </header>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 px-4">
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-md p-6 space-y-6">
          <div className="flex flex-col items-center mb-2">
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

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="block text-base font-medium">
                {t.confirmPassword}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t.confirmPasswordPlaceholder}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 py-6 text-base shadow-sm"
                  required
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((x) => !x)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showConfirmPassword ? (
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
