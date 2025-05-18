import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// Define the type for location state
interface LocationState {
  from?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useTheme();
  const { user, session, isLoading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  
  // Get the location state to know where to redirect after login
  const locationState = location.state as LocationState;
  const from = locationState?.from || "/dashboard";

  // Simplified auth check and redirect logic
  useEffect(() => {
    console.log("Login: Auth state check", { 
      user: !!user, 
      session: !!session, 
      authLoading,
      hasCheckedAuth,
      currentPath: location.pathname,
      redirectTo: from
    });
    
    // Only mark auth as checked once loading completes
    if (!authLoading && !hasCheckedAuth) {
      console.log("Login: Auth check completed");
      setHasCheckedAuth(true);
    }
    
    // Only redirect if:
    // 1. Auth check is complete
    // 2. User is authenticated
    // 3. Not currently loading
    if (hasCheckedAuth && user && session && !authLoading && !isLoading) {
      console.log("Login: User authenticated, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [user, session, authLoading, hasCheckedAuth, navigate, from, isLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (!email || !password) {
      setErrorMsg(language === 'en' ? 'Please fill in all fields' : 'يرجى تعبئة جميع الحقول');
      return;
    }
    
    setIsLoading(true);
    console.log("Login: Attempting login with email:", email);
    
    try {
      const error = await signIn(email, password);

      if (error) {
        console.error("Login: Login error:", error);
        setErrorMsg(error.message);
        toast({
          title: language === 'en' ? 'Login Failed' : 'فشل تسجيل الدخول',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        console.log("Login: Login successful");
        toast({
          title: language === 'en' ? 'Login Successful' : 'تم تسجيل الدخول بنجاح',
          description: language === 'en' ? 'Welcome back!' : 'مرحبا بعودتك!',
        });
        // The redirect will be handled by the useEffect when auth state updates
      }
    } catch (err) {
      console.error("Login: Unexpected error during login:", err);
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  // Translations
  const translations = {
    en: {
      appName: "WAKTI",
      login: "Login",
      email: "Email",
      password: "Password",
      forgotPassword: "Forgot Password?",
      loading: "Loading...",
      createAccount: "Don't have an account?",
      signup: "Sign Up",
      backToHome: "Back to Home",
      // Placeholders
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "Enter your password"
    },
    ar: {
      appName: "وقتي",
      login: "تسجيل الدخول",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      forgotPassword: "نسيت كلم�� المرور؟",
      loading: "جاري التحميل...",
      createAccount: "ليس لديك حساب؟",
      signup: "إنشاء حساب",
      backToHome: "العودة للرئيسية",
      // Placeholders
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "أدخل كلمة المرور"
    }
  };

  const t = translations[language];

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 mr-2"
            onClick={() => navigate("/home")}  // Updated to navigate to /home
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">{language === 'en' ? 'Back to Home' : 'العودة للرئيسية'}</span>
          </Button>
        </div>
        <ThemeLanguageToggle />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-[80vh] flex-col justify-center py-6 px-6 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="mb-8 text-center">
              {/* App logo with navigation to home */}
              <div 
                className="inline-block cursor-pointer mb-4"
                onClick={() => navigate("/home")}  // Updated to navigate to /home
              >
                <Logo3D size="lg" />
              </div>
              <h1 className="text-2xl font-bold">{t.login}</h1>
              
              {errorMsg && (
                <div className="mt-3 text-sm text-red-500">
                  {errorMsg}
                </div>
              )}
            </div>

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
                  <Button
                    variant="link"
                    className="px-0 font-normal text-sm"
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                  >
                    {t.forgotPassword}
                  </Button>
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
