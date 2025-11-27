
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


  // Translations
  const translations = {
    en: {
      login: "Login",
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
