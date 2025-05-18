
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import Loading from "@/components/ui/loading";

// Translations
const translations = {
  en: {
    appName: "WAKTI",
    login: "Login",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot Password?",
    loading: "Loading...",
    redirecting: "Redirecting to Dashboard...",
    createAccount: "Don't have an account?",
    signup: "Sign Up",
    backToHome: "Back to Home",
    loggingIn: "Logging in...",
    // Placeholders
    emailPlaceholder: "example@email.com",
    passwordPlaceholder: "Enter your password"
  },
  ar: {
    appName: "وقتي",
    login: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgotPassword: "نسيت كلم المرور؟",
    loading: "جاري التحميل...",
    redirecting: "جاري التوجيه إلى لوحة التحكم...",
    createAccount: "ليس لديك حساب؟",
    signup: "إنشاء حساب",
    backToHome: "العودة للرئيسية",
    loggingIn: "جاري تسجيل الدخول...",
    // Placeholders
    emailPlaceholder: "example@email.com",
    passwordPlaceholder: "أدخل كلمة المرور"
  }
};

// Maximum time to wait in loading state before auto-recovery (ms)
const MAX_LOADING_TIME = 8000;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { signIn, user, session, isLoading: authIsLoading, authInitialized } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  // Get translations for the current language
  const t = translations[language === 'ar' ? 'ar' : 'en'];
  
  // Single reference for tracking redirections
  const redirectStateRef = useRef({
    redirectAttempted: false,
    successToastShown: false,
    redirectTimer: null as NodeJS.Timeout | null
  });

  // Helper function for consistent log formatting
  const logWithTimestamp = (message: string, details?: any) => {
    console.log(
      `[${new Date().toISOString()}] Login: ${message}`,
      details || ""
    );
  };

  // Clean up function to clear timers
  const clearTimers = () => {
    logWithTimestamp("Cleaning up timers");
    if (redirectStateRef.current.redirectTimer) {
      clearTimeout(redirectStateRef.current.redirectTimer);
      redirectStateRef.current.redirectTimer = null;
    }
  };

  // Clear any loading timers when component unmounts
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      if (localLoading) {
        logWithTimestamp("Loading recovery triggered - resetting loading state");
        setLocalLoading(false);
        toast({
          title: language === 'en' ? 'Login Process Timeout' : 'انتهت مهلة عملية تسجيل الدخول',
          description: language === 'en' ? 
            'The login process is taking longer than expected. Please try again.' : 
            'عملية تسجيل الدخول تستغرق وقتًا أطول من المتوقع. يرجى المحاولة مرة أخرى.',
          variant: 'destructive',
          duration: 5000,
        });
      }
    }, MAX_LOADING_TIME);

    return () => {
      clearTimeout(loadingTimer);
      clearTimers();
      logWithTimestamp("Cleanup: component unmounting, clearing timers and flags");
    };
  }, [localLoading, language]);

  // Reset flags when component mounts
  useEffect(() => {
    logWithTimestamp("Component mounted, resetting all redirect flags");
    setLoginSuccess(false);
    redirectStateRef.current = {
      redirectAttempted: false,
      successToastShown: false,
      redirectTimer: null
    };
    
    return () => {
      logWithTimestamp("Component unmounting, final cleanup");
      clearTimers();
    };
  }, []);

  // This effect handles redirection ONLY when authentication state changes
  useEffect(() => {
    // Log auth state for debugging
    logWithTimestamp("Auth state check", {
      hasUser: !!user,
      hasSession: !!session, 
      authInitialized,
      authIsLoading,
      localLoading,
      loginSuccess,
      currentPath: location.pathname
    });
    
    // Only proceed with redirect if:
    // 1. Authentication is fully initialized 
    // 2. We have a user object and session
    // 3. We've just completed a successful login
    // 4. We're not in a loading state
    if (user && 
        session && 
        authInitialized && 
        !authIsLoading && 
        !localLoading && 
        loginSuccess && 
        !redirectStateRef.current.redirectAttempted) {
      
      logWithTimestamp("🔑 Auth redirect condition met - preparing redirection", {
        userId: user.id
      });
      
      // Mark that we've attempted a redirect to prevent multiple redirects
      redirectStateRef.current.redirectAttempted = true;
      
      // Show success toast only once per login flow
      if (!redirectStateRef.current.successToastShown) {
        redirectStateRef.current.successToastShown = true;
        toast({
          title: language === 'en' ? 'Login Successful' : 'تم تسجيل الدخول بنجاح',
          description: language === 'en' ? 'Welcome back!' : 'مرحبا بعودتك!',
          duration: 3000,
          variant: 'success',
        });
      }
      
      // Use a short delay to ensure all auth state propagation is complete
      // before attempting navigation
      redirectStateRef.current.redirectTimer = setTimeout(() => {
        // Get intended destination or default to dashboard
        const destination = location.state?.from?.pathname || "/dashboard";
        logWithTimestamp(`🚀 Executing navigation to ${destination}`);
        
        // Use replace to prevent back-button issues
        navigate(destination, { replace: true });
      }, 100);
    }
  }, [user, session, navigate, location, language, localLoading, authIsLoading, loginSuccess, authInitialized]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (!email || !password) {
      setErrorMsg(language === 'en' ? 'Please fill in all fields' : 'يرجى تعبئة جميع الحقول');
      return;
    }
    
    // Reset login state before new login attempt
    setLoginSuccess(false);
    redirectStateRef.current.redirectAttempted = false;
    redirectStateRef.current.successToastShown = false;
    clearTimers();
    
    setLocalLoading(true);
    logWithTimestamp("Attempting login with email:", email);
    
    try {
      const error = await signIn(email, password);

      if (error) {
        logWithTimestamp("Login error:", error);
        setErrorMsg(error.message);
        toast({
          title: language === 'en' ? 'Login Failed' : 'فشل تسجيل الدخول',
          description: error.message,
          variant: 'destructive',
          duration: 5000,
        });
        setLocalLoading(false);
      } else {
        logWithTimestamp("Login successful via form submission");
        setLoginSuccess(true); // Mark login as successful
        setLocalLoading(false);
        // Redirect will be handled by the useEffect when user state updates
      }
    } catch (err) {
      logWithTimestamp("Unexpected error during login:", err);
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
      setLocalLoading(false);
    }
  };

  // Show loading state when logging in
  if (localLoading) {
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-bold mb-2">{t.loggingIn}</h2>
          <p className="text-muted-foreground">
            {language === 'en' ? 'Please wait...' : 'يرجى الانتظار...'}
          </p>
        </div>
      </div>
    );
  }

  // If user is authenticated, show a message that we're redirecting
  if (user && session && loginSuccess) {
    logWithTimestamp("Showing redirect UI while waiting for navigation");
    return (
      <div className="mobile-container flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-bold mb-2">{t.redirecting}</h2>
          <p className="text-muted-foreground">
            {language === 'en' ? 'Please wait...' : 'يرجى الانتظار...'}
          </p>
        </div>
      </div>
    );
  }

  // Main login form (only shown when not logged in or when not in redirect state)
  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 mr-2"
            onClick={() => navigate("/home")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">{t.backToHome}</span>
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
                onClick={() => navigate("/home")}
              >
                <Logo3D size="lg" />
              </div>
              <h1 className="text-2xl font-bold">{t.login}</h1>
              
              {errorMsg && (
                <div className="mt-3 p-2 bg-red-50 text-red-500 rounded-md">
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
                    disabled={localLoading}
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
                    disabled={localLoading}
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
                    disabled={localLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 py-6 text-base shadow-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    disabled={localLoading}
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
                disabled={localLoading}
              >
                {localLoading ? t.loading : t.login}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t.createAccount}{" "}
                <Button
                  variant="link"
                  className="px-0"
                  onClick={() => navigate("/signup")}
                  disabled={localLoading}
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
