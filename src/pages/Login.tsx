
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const { language } = useTheme();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  console.log("[LOGIN] Render Login page");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    
    console.log("[LOGIN] Attempting login");
    
    try {
      const authResult = await signIn(email, password);
      
      if (authResult?.error) {
        console.error("[LOGIN] Login error:", authResult.error);
        
        // Set user-friendly error message
        const errorMessage = language === 'en' 
          ? 'Invalid email or password'
          : 'بريد إلكتروني أو كلمة مرور غير صالحة';
          
        setErrorMessage(errorMessage);
        setIsLoading(false);
      } else {
        console.log("[LOGIN] Login successful, navigating to dashboard");
        
        toast({
          title: language === 'en' ? 'Login successful' : 'تم تسجيل الدخول بنجاح',
          description: language === 'en' ? 'Welcome back!' : 'مرحبًا بعودتك!',
          variant: "success",
          duration: 3000,
        });
        
        // Navigate to dashboard after successful login
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("[LOGIN] Unexpected login error:", error);
      setErrorMessage(language === 'en' ? 'An unexpected error occurred' : 'حدث خطأ غير متوقع');
      setIsLoading(false);
    }
  };

  // Translations
  const t = {
    appName: language === 'en' ? "WAKTI" : "وقتي",
    login: language === 'en' ? "Login" : "تسجيل الدخول",
    email: language === 'en' ? "Email" : "البريد الإلكتروني",
    password: language === 'en' ? "Password" : "كلمة المرور",
    forgotPassword: language === 'en' ? "Forgot password?" : "نسيت كلمة المرور؟",
    noAccount: language === 'en' ? "Don't have an account?" : "ليس لديك حساب؟",
    signUp: language === 'en' ? "Sign up" : "اشتراك",
    loading: language === 'en' ? "Logging in..." : "جاري تسجيل الدخول...",
    backToHome: language === 'en' ? "Back to Home" : "العودة للرئيسية",
    // Placeholders
    emailPlaceholder: language === 'en' ? "example@email.com" : "example@email.com",
    passwordPlaceholder: language === 'en' ? "Enter your password" : "أدخل كلمة المرور",
  };

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 mr-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">{t.backToHome}</span>
          </Button>
        </div>
        <ThemeLanguageToggle />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-[80vh] flex-col justify-center py-12 px-6 sm:px-6 lg:px-8">
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
                onClick={() => navigate("/")}
              >
                <img 
                  src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" 
                  alt={t.appName}
                  className="w-24 h-24 mx-auto object-contain" 
                />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t.login}</h1>
              
              {errorMessage && (
                <div className="mt-3 text-sm text-red-500">
                  {errorMessage}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    id="email"
                    placeholder={t.email}
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
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input
                    id="password"
                    placeholder={t.password}
                    type="password"
                    autoCapitalize="none"
                    autoComplete="current-password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 py-6 text-base shadow-sm"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary font-medium transition-colors hover:text-primary/80"
                  >
                    {t.forgotPassword}
                  </Link>
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full text-base py-6 shadow-md hover:shadow-lg transition-all"
                disabled={isLoading}
              >
                {isLoading ? t.loading : t.login}
              </Button>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t.noAccount}{" "}
                  <Link
                    to="/signup"
                    className="text-primary font-medium transition-colors hover:text-primary/80"
                  >
                    {t.signUp}
                  </Link>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
