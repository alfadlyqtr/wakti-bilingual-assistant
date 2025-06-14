
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { LoginForm } from "@/components/LoginForm";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { t } from "@/utils/translations";

export default function Confirmed() {
  const navigate = useNavigate();
  const { language } = useTheme();

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
            {/* Confirmation Success Section */}
            <div className="mb-8 text-center">
              {/* App logo */}
              <div 
                className="inline-block cursor-pointer mb-4"
                onClick={() => navigate("/home")}
              >
                <Logo3D size="lg" />
              </div>

              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center"
                >
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </motion.div>
              </div>

              {/* Confirmation Messages */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="space-y-2"
              >
                <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {t("emailConfirmed", language)}
                </h1>
                <p className="text-lg font-medium">
                  {t("thankYouForConfirming", language)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("proceedToLogin", language)}
                </p>
              </motion.div>
            </div>

            {/* Login Form Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg"
            >
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold">
                  {language === 'en' ? 'Login to Your Account' : 'تسجيل الدخول إلى حسابك'}
                </h2>
              </div>
              
              <LoginForm 
                redirectTo="/dashboard"
                showForgotPassword={true}
                showSignupLink={false}
              />
            </motion.div>

            {/* Additional Links */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {language === 'en' ? "Need to create an account?" : "تحتاج إلى إنشاء حساب؟"}{" "}
                <Button
                  variant="link"
                  className="px-0"
                  onClick={() => navigate("/signup")}
                >
                  {language === 'en' ? 'Sign Up' : 'إنشاء حساب'}
                </Button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
