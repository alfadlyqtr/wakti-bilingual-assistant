import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { supabase } from "@/integrations/supabase/client";

/**
 * GoodbyeScreen - Displayed after successful account deletion
 * 
 * SOLID FLOW:
 * 1. Screen appears immediately after delete
 * 2. Session is killed right away (signOut called on mount)
 * 3. Screen stays visible for max 30 seconds with countdown
 * 4. User can click "Return to Home" anytime OR auto-redirect after 30s
 */
export default function GoodbyeScreen() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const isArabic = language === "ar";
  const signedOutRef = useRef(false);
  const [countdown, setCountdown] = useState(30);

  // Sign out after 2 seconds - gives time for screen to fully render
  // and prevents auth state change from triggering redirects too early
  useEffect(() => {
    if (signedOutRef.current) return;
    
    const signOutTimer = setTimeout(() => {
      signedOutRef.current = true;
      supabase.auth.signOut();
    }, 2000);
    
    return () => clearTimeout(signOutTimer);
  }, []);

  // Countdown timer: 30 seconds then auto-redirect to home
  // Using a ref to track if we've already navigated
  const navigatedRef = useRef(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1 && !navigatedRef.current) {
          navigatedRef.current = true;
          clearInterval(interval);
          // Use window.location for a hard redirect that bypasses React Router
          window.location.href = "/";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleReturnHome = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    // Use window.location for a hard redirect
    window.location.href = "/";
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted relative"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Language/Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeLanguageToggle />
      </div>
      {/* Wakti Logo */}
      <div className="mb-8">
        <img 
          src="/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png" 
          alt="Wakti" 
          className="h-20 w-auto opacity-60"
        />
      </div>

      {/* Sad Face Emoji */}
      <div className="text-7xl mb-6">😢</div>

      {/* Farewell Message */}
      <h1 className="text-2xl font-bold text-center mb-4 text-foreground">
        {isArabic ? "وداعاً" : "Goodbye"}
      </h1>

      <p className="text-center text-muted-foreground max-w-md mb-8 leading-relaxed">
        {isArabic 
          ? "تم حذف حسابك وجميع بياناتك بنجاح. نأسف لرؤيتك تغادر. إذا غيرت رأيك، يسعدنا دائماً أن نرحب بك مرة أخرى."
          : "Your account and all your data have been successfully deleted. We're sad to see you go. If you ever change your mind, we'd be happy to welcome you back."
        }
      </p>

      {/* Confirmation Badge */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 mb-8">
        <p className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-2">
          <span>✓</span>
          {isArabic ? "تم حذف جميع البيانات نهائياً" : "All data permanently deleted"}
        </p>
      </div>

      {/* Return Home Button */}
      <Button
        variant="outline"
        onClick={handleReturnHome}
        className="min-w-[200px]"
      >
        {isArabic ? "العودة للصفحة الرئيسية" : "Return to Home"}
      </Button>

      {/* Auto-redirect countdown */}
      <p className="text-xs text-muted-foreground mt-4">
        {isArabic 
          ? `سيتم توجيهك للصفحة الرئيسية خلال ${countdown} ثانية`
          : `Redirecting to home in ${countdown} seconds`
        }
      </p>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-1">
          {isArabic ? "💙 شكراً لكونك جزءاً من رحلتنا" : "💙 Thank you for being part of our journey"}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {isArabic ? "نتمنى لك كل التوفيق" : "We wish you all the best"}
        </p>
      </div>
    </div>
  );
}
