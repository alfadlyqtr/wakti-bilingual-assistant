import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useTheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const token = searchParams.get('token') || '';
    if (!token) {
      setStatus('error');
      return;
    }

    supabase.functions
      .invoke('confirm-email', { body: { token } })
      .then(({ data, error }) => {
        setStatus(!error && data?.ok ? 'success' : 'error');
      })
      .catch(() => setStatus('error'));
  }, [searchParams]);

  const copy = language === 'ar'
    ? {
        loading: 'جاري تأكيد بريدك الإلكتروني...',
        successTitle: 'تم تأكيد بريدك الإلكتروني!',
        successBody: 'كل شيء مفتوح الآن — كلمة المرور وإعدادات الحساب والمزيد.',
        errorTitle: 'الرابط غير صالح أو منتهي',
        errorBody: 'افتح صفحة الحساب وأعد إرسال بريد التأكيد.',
        toDashboard: 'الانتقال إلى لوحة التحكم',
        toAccount: 'الذهاب إلى الحساب',
      }
    : {
        loading: 'Confirming your email...',
        successTitle: 'Email confirmed!',
        successBody: 'Everything is unlocked now — password, account settings, and more.',
        errorTitle: 'Invalid or expired link',
        errorBody: 'Open your Account page and resend the confirmation email.',
        toDashboard: 'Go to Dashboard',
        toAccount: 'Go to Account',
      };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute top-3 right-3">
        <ThemeLanguageToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full rounded-2xl border border-border/50 bg-card p-8 flex flex-col items-center gap-4 text-center shadow-2xl"
      >
        <Logo3D size="md" />
        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{copy.loading}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <h1 className="text-xl font-bold">{copy.successTitle}</h1>
            <p className="text-sm text-muted-foreground">{copy.successBody}</p>
            <Button className="w-full mt-2" onClick={() => navigate('/dashboard')}>
              {copy.toDashboard}
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold">{copy.errorTitle}</h1>
            <p className="text-sm text-muted-foreground">{copy.errorBody}</p>
            <Button className="w-full mt-2" variant="outline" onClick={() => navigate('/account')}>
              {copy.toAccount}
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
