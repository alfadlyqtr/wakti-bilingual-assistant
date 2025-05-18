
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    
    if (!email) {
      setErrorMsg(language === 'en' ? 'Please enter your email' : 'يرجى إدخال بريدك الإلكتروني');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const error = await forgotPassword(email);
      
      if (error) {
        toast({
          title: language === 'en' ? "Password reset failed" : "فشل إعادة تعيين كلمة المرور",
          description: error.error.message,
          variant: "destructive",
        });
        setErrorMsg(error.error.message);
      } else {
        setIsSubmitted(true);
        toast({
          title: language === 'en' ? "Password reset link sent" : "تم إرسال رابط إعادة تعيين كلمة المرور",
          description: language === 'en' ? "Check your email for the reset link" : "تحقق من بريدك الإلكتروني للحصول على رابط إعادة التعيين",
          variant: "success",
        });
      }
    } catch (error: any) {
      toast({
        title: language === 'en' ? "Password reset failed" : "فشل إعادة تعيين كلمة المرور",
        description: language === 'en' ? "An unexpected error occurred" : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
      setErrorMsg(language === 'en' ? "An unexpected error occurred" : "حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  // Translations
  const translations = {
    en: {
      appName: "WAKTI",
      forgotPassword: "Forgot Password",
      email: "Email",
      resetInstructions: "Enter your email to receive reset instructions",
      loading: "Loading...",
      resetPassword: "Reset Password",
      backToLogin: "Back to Login",
      resetLinkSent: "Reset link sent",
      resetEmailSent: "A password reset link has been sent to your email.",
      checkEmail: "Please check your inbox.",
      backToHome: "Back to Home",
      // Placeholders
      emailPlaceholder: "example@email.com"
    },
    ar: {
      appName: "وقتي",
      forgotPassword: "نسيت كلمة المرور",
      email: "البريد الإلكتروني",
      resetInstructions: "أدخل بريدك الإلكتروني لتلقي تعليمات إعادة تعيين كلمة المرور",
      loading: "جاري التحميل...",
      resetPassword: "إعادة تعيين كلمة المرور",
      backToLogin: "العودة إلى تسجيل الدخول",
      resetLinkSent: "تم إرسال رابط إعادة التعيين",
      resetEmailSent: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.",
      checkEmail: "يرجى التحقق من صندوق الوارد الخاص بك.",
      backToHome: "العودة للرئيسية",
      // Placeholders
      emailPlaceholder: "example@email.com"
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
              <h1 className="text-2xl font-bold mb-2">{t.forgotPassword}</h1>
              {!isSubmitted && (
                <p className="text-sm text-muted-foreground">
                  {t.resetInstructions}
                </p>
              )}
              
              {errorMsg && (
                <div className="mt-3 text-sm text-red-500">
                  {errorMsg}
                </div>
              )}
            </div>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-6">
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
                
                <Button
                  type="submit"
                  className="w-full text-base py-6 shadow-md hover:shadow-lg transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? t.loading : t.resetPassword}
                </Button>
                
                <div className="mt-4 text-center">
                  <Button
                    variant="link"
                    className="px-0"
                    onClick={() => navigate("/login")}
                  >
                    {t.backToLogin}
                  </Button>
                </div>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h2 className="text-xl font-medium mb-2">
                  {t.resetLinkSent}
                </h2>
                <p className="text-muted-foreground mb-2">
                  {t.resetEmailSent}
                </p>
                <p className="text-muted-foreground mb-6">
                  {t.checkEmail}
                </p>
                <Button
                  variant="outline"
                  className="mb-4 w-full"
                  onClick={() => navigate("/login")}
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
