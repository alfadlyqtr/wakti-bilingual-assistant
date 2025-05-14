
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error(language === "en" ? "Please enter a valid email" : "يرجى إدخال بريد إلكتروني صالح");
      return;
    }
    
    setIsLoading(true);
    
    // Will implement with Supabase later
    setTimeout(() => {
      setIsSubmitted(true);
      setIsLoading(false);
    }, 1500);
  };

  // Translations
  const translations = {
    en: {
      appName: "WAKTI",
      forgotPassword: "Forgot Password",
      resetPassword: "Reset Password",
      backToLogin: "Back to Login",
      resetInstructions: "Enter your email address and we'll send you a link to reset your password.",
      email: "Email",
      sendResetLink: "Send Reset Link",
      loading: "Loading...",
      successTitle: "Reset Link Sent",
      successMessage: "If your email exists in our system, you will receive a password reset link shortly.",
      checkEmail: "Please check your email.",
    },
    ar: {
      appName: "وقتي",
      forgotPassword: "نسيت كلمة المرور",
      resetPassword: "إعادة تعيين كلمة المرور",
      backToLogin: "العودة إلى تسجيل الدخول",
      resetInstructions: "أدخل عنوان بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور الخاصة بك.",
      email: "البريد الإلكتروني",
      sendResetLink: "إرسال رابط إعادة التعيين",
      loading: "جاري التحميل...",
      successTitle: "تم إرسال رابط إعادة التعيين",
      successMessage: "إذا كان بريدك الإلكتروني موجودًا في نظامنا، فستتلقى رابط إعادة تعيين كلمة المرور قريبًا.",
      checkEmail: "يرجى التحقق من بريدك الإلكتروني.",
    }
  };

  const t = translations[language];

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <h1 className="text-2xl font-bold">{t.appName}</h1>
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
            <Button 
              variant="ghost" 
              className="mb-4 -ml-2 flex items-center gap-1"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.backToLogin}</span>
            </Button>
            
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold">{t.forgotPassword}</h1>
            </div>

            {!isSubmitted ? (
              <>
                <p className="mb-6 text-center text-muted-foreground">
                  {t.resetInstructions}
                </p>

                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base">{t.email}</Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Input
                        id="email"
                        placeholder="example@email.com"
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
                  
                  <Button
                    type="submit"
                    className="w-full text-base py-6 shadow-md hover:shadow-lg transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? t.loading : t.sendResetLink}
                  </Button>
                </form>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-center space-y-6 p-6 bg-secondary/20 rounded-lg shadow-md"
              >
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-8 w-8 text-green-500" 
                    viewBox="0 0 20 20" 
                    fill="currentColor"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">{t.successTitle}</h3>
                <p className="text-muted-foreground">
                  {t.successMessage}
                </p>
                <p className="font-medium">{t.checkEmail}</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/login')}
                >
                  {t.backToLogin}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
