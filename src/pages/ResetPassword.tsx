
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock } from "lucide-react";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { session } = useAuth();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user came from a valid recovery flow
  // Handle both: session already set OR tokens in URL hash (fallback)
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    const setSessionFromHash = async () => {
      // Check if there are tokens in the URL hash (PKCE flow fallback)
      if (location.hash) {
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        
        if (access_token && refresh_token) {
          console.log('Found tokens in hash, setting session...');
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          
          if (!error && isMounted) {
            setIsAuthorized(true);
            setIsCheckingAuth(false);
            // Clear the hash from URL for security
            window.history.replaceState(null, '', window.location.pathname);
            return true;
          }
        }
      }
      return false;
    };
    
    const checkAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession && isMounted) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
        return true;
      }
      return false;
    };
    
    const initAuth = async () => {
      // First try to get existing session
      let success = await checkAuth();
      
      if (!success) {
        // Try to set session from hash if present
        success = await setSessionFromHash();
      }
      
      if (!success && isMounted) {
        // Poll a few times for session (may still be propagating)
        let attempts = 0;
        const maxAttempts = 8;
        
        intervalId = setInterval(async () => {
          attempts++;
          const found = await checkAuth();
          
          if (found || attempts >= maxAttempts) {
            if (intervalId) clearInterval(intervalId);
            if (isMounted) {
              setIsCheckingAuth(false);
              if (!found) {
                setErrorMsg(
                  language === "en"
                    ? "Invalid or expired reset link. Please request a new one."
                    : "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد."
                );
              }
            }
          }
        }, 500);
      }
    };
    
    initAuth();
    
    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && isMounted) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
      }
    });
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      subscription.unsubscribe();
    };
  }, [language, location.hash]);

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

    if (!isAuthorized) {
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
      // User is already authenticated via the recovery flow (verifyOtp in AuthConfirm)
      // Just update the password directly
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || t.error_invalid_token);
      } else {
        // Sign out after password reset so user logs in fresh
        await supabase.auth.signOut();
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
          {isCheckingAuth && (
            <div className="text-center text-muted-foreground py-4">
              {language === "en" ? "Verifying..." : "جاري التحقق..."}
            </div>
          )}
          {errorMsg && !isCheckingAuth && (
            <div className="bg-red-100 text-red-700 rounded-lg text-sm py-2 px-3 text-center">
              {errorMsg}
            </div>
          )}
          {!isCheckingAuth && <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
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
              disabled={isLoading || !isAuthorized}
            >
              {isLoading ? t.loading : t.submit}
            </Button>
          </form>}
        </div>
      </div>
    </div>
  );
}
