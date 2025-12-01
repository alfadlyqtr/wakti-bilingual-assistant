import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Logo3D } from '@/components/Logo3D';
import { motion } from 'framer-motion';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (!token_hash || !type) {
          setStatus('error');
          setMessage(language === 'ar' ? 'رابط غير صالح' : 'Invalid link');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Verify the token with Supabase
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        });

        if (error) {
          console.error('Auth callback error:', error);
          setStatus('error');
          setMessage(
            language === 'ar'
              ? 'فشل التحقق. قد يكون الرابط منتهي الصلاحية.'
              : 'Verification failed. The link may have expired.'
          );
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Success!
        setStatus('success');
        
        // Set appropriate success message based on type
        if (type === 'signup') {
          setMessage(
            language === 'ar'
              ? 'تم تأكيد بريدك الإلكتروني بنجاح!'
              : 'Email confirmed successfully!'
          );
          setTimeout(() => navigate('/dashboard'), 2000);
        } else if (type === 'recovery') {
          setMessage(
            language === 'ar'
              ? 'يمكنك الآن إعادة تعيين كلمة المرور'
              : 'You can now reset your password'
          );
          setTimeout(() => navigate('/reset-password'), 2000);
        } else if (type === 'email_change') {
          setMessage(
            language === 'ar'
              ? 'تم تغيير بريدك الإلكتروني بنجاح!'
              : 'Email changed successfully!'
          );
          setTimeout(() => navigate('/dashboard'), 2000);
        } else if (type === 'magiclink') {
          setMessage(
            language === 'ar'
              ? 'تم تسجيل الدخول بنجاح!'
              : 'Signed in successfully!'
          );
          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          setMessage(
            language === 'ar'
              ? 'تم التحقق بنجاح!'
              : 'Verified successfully!'
          );
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        setStatus('error');
        setMessage(
          language === 'ar'
            ? 'حدث خطأ غير متوقع'
            : 'An unexpected error occurred'
        );
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, language]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo3D size="md" />
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-16 h-16 text-primary" />
              </motion.div>
            )}
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center"
              >
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </motion.div>
            )}
            {status === 'error' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center"
              >
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </motion.div>
            )}
          </div>

          {/* Status Message */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold">
              {status === 'loading' &&
                (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')}
              {status === 'success' &&
                (language === 'ar' ? 'نجح!' : 'Success!')}
              {status === 'error' &&
                (language === 'ar' ? 'خطأ' : 'Error')}
            </h2>
            <p className="text-muted-foreground">{message}</p>
            {status !== 'loading' && (
              <p className="text-sm text-muted-foreground mt-4">
                {language === 'ar'
                  ? 'جاري إعادة التوجيه...'
                  : 'Redirecting...'}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
