
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LoginFormProps {
  redirectTo?: string;
  showForgotPassword?: boolean;
  showSignupLink?: boolean;
}

export function LoginForm({ 
  redirectTo = "/dashboard", 
  showForgotPassword = true, 
  showSignupLink = true 
}: LoginFormProps) {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { setUser: setAuthUser, setSession: setAuthSession, setLoading: setAuthLoading, setLastLoginTimestamp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Navigation is now state-driven by the router/AuthContext. No side-effects here.

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (!email || !password) {
      setErrorMsg(language === 'en' ? 'Please fill in all fields' : 'يرجى تعبئة جميع الحقول');
      return;
    }
    
    setIsLoading(true);
    console.log("LoginForm: Attempting login with email:", email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("LoginForm: Login error:", error);
        setErrorMsg(error.message);
        toast.error(language === 'en' ? 'Login Failed: ' + error.message : 'فشل تسجيل الدخول: ' + error.message);
      } else if (data?.user) {
        console.log("LoginForm: Login successful, user:", data.user.id);
        toast.success(language === 'en' ? 'Login Successful: Welcome back!' : 'تم تسجيل الدخول بنجاح: مرحبا بعودتك!');
        const loginTimestamp = Date.now();
        // Store in both localStorage and sessionStorage for maximum compatibility
        try { localStorage.setItem('wakti_recent_login', String(loginTimestamp)); } catch {}
        try { sessionStorage.setItem('wakti_recent_login', String(loginTimestamp)); } catch {}
        try {
          const at = (data as any)?.session?.access_token;
          const rt = (data as any)?.session?.refresh_token;
          if (at && rt) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
            
            // === SET MANUAL AUTH LOCK ===
            // Set a 5-second "lock" to ignore bad auth events
            try { (window as any).__MANUAL_AUTH_LOCK = true; } catch {}
            
            // Manually update AuthContext because onAuthStateChange is not firing in iOS WebView
            console.log("LoginForm: Manually updating AuthContext.");
            try { setAuthUser(data.user); } catch {}
            try { setAuthSession((data as any)?.session ?? null); } catch {}
            try { setAuthLoading(false); } catch {}
            try { setLastLoginTimestamp(loginTimestamp); } catch {}
            
            // === DELAYED NAVIGATION ===
            // Small delay to let React finish state update before ProtectedRoute checks
            console.log("LoginForm: Scheduling navigation to", redirectTo);
            setTimeout(() => {
              console.log("LoginForm: Navigating now to", redirectTo);
              navigate(redirectTo);
            }, 100);
          }
        } catch (err) {
          console.error("LoginForm: Error during setSession or context update", err);
        }
      }
    } catch (err) {
      console.error("LoginForm: Unexpected error during login:", err);
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    console.log("LoginForm: Attempting Apple login");
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        }
      });

      if (error) {
        console.error("LoginForm: Apple login error:", error);
        setErrorMsg(error.message);
        toast.error(language === 'en' ? 'Apple Login Failed: ' + error.message : 'فشل تسجيل الدخول عبر Apple: ' + error.message);
      }
      // Note: Successful OAuth redirect happens automatically
    } catch (err) {
      console.error("LoginForm: Unexpected error during Apple login:", err);
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
    } finally {
      // Don't turn off loading immediately if redirecting
      setTimeout(() => setIsLoading(false), 2000);
    }
  };

  // Translations
  const translations = {
    en: {
      login: "Login",
      appleLogin: "Sign in with Apple",
      orContinueWith: "Or continue with",
      email: "Email",
      password: "Password",
      forgotPassword: "Forgot Password?",
      loading: "Loading...",
      createAccount: "Don't have an account?",
      signup: "Sign Up",
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "Enter your password"
    },
    ar: {
      login: "تسجيل الدخول",
      appleLogin: "تسجيل الدخول عبر Apple",
      orContinueWith: "أو تابع باستخدام",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      forgotPassword: "نسيت كلمة المرور؟",
      loading: "جاري التحميل...",
      createAccount: "ليس لديك حساب؟",
      signup: "إنشاء حساب",
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "أدخل كلمة المرور"
    }
  };

  const t = translations[language];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      {errorMsg && (
        <div className="mb-4 text-sm text-red-500 text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">{t.email}</Label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              id="email"
              placeholder={t.emailPlaceholder}
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 py-6 text-base shadow-sm"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-base">{t.password}</Label>
            {showForgotPassword && (
              <Button
                variant="link"
                className="px-0 font-normal text-sm"
                type="button"
                onClick={() => navigate("/forgot-password")}
              >
                {t.forgotPassword}
              </Button>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t.passwordPlaceholder}
              autoCapitalize="none"
              autoComplete="current-password"
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 py-6 text-base shadow-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
          className="w-full text-base py-6 shadow-md hover:shadow-lg transition-all"
          disabled={isLoading}
        >
          {isLoading ? t.loading : t.login}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t.orContinueWith}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full mt-4 py-6 text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
          onClick={handleAppleLogin}
          disabled={isLoading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.127 3.675-.552 9.12 1.519 12.12 1.014 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.99 3.915-.99 1.832 0 2.383.99 3.929.94 1.57-.063 2.568-1.427 3.537-2.85 1.106-1.626 1.556-3.204 1.588-3.286-.035-.017-3.082-1.177-3.113-4.695-.031-2.935 2.538-4.34 2.653-4.421-1.445-2.116-3.678-2.349-4.463-2.386-2.03-.049-3.736 1.159-4.436 1.159m3.422-5.446c.85-1.03 1.423-2.45 1.267-3.87-1.223.05-2.705.815-3.585 1.841-.783.912-1.472 2.391-1.286 3.82 1.36.109 2.753-.76 3.604-1.791" />
          </svg>
          {t.appleLogin}
        </Button>
      </div>

      {showSignupLink && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t.createAccount}{" "}
            <Button
              variant="link"
              className="px-0"
              onClick={() => navigate("/signup")}
            >
              {t.signup}
            </Button>
          </p>
        </div>
      )}
    </motion.div>
  );
}
