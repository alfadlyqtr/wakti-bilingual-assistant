import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Logo3D } from '@/components/Logo3D';
import { motion } from 'framer-motion';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase can send params in query string OR hash fragment
        // Try query params first, then fall back to hash fragment
        let token_hash = searchParams.get('token_hash');
        let type = searchParams.get('type');
        let access_token = searchParams.get('access_token');
        let refresh_token = searchParams.get('refresh_token');

        // If not in query params, check hash fragment
        if (location.hash) {
          const hashParams = new URLSearchParams(location.hash.substring(1));
          
          // Check for error in hash (Supabase sends errors this way)
          const hashError = hashParams.get('error');
          const errorCode = hashParams.get('error_code');
          const errorDescription = hashParams.get('error_description');
          
          if (hashError || errorCode) {
            console.error('Auth error from hash:', { hashError, errorCode, errorDescription });
            setStatus('error');
            
            // Provide user-friendly error messages
            if (errorCode === 'otp_expired' || errorDescription?.includes('expired')) {
              setMessage(
                language === 'ar'
                  ? 'انتهت صلاحية الرابط. يرجى طلب رابط جديد.'
                  : 'This link has expired. Please request a new one.'
              );
            } else if (errorCode === 'access_denied') {
              setMessage(
                language === 'ar'
                  ? 'تم رفض الوصول. يرجى المحاولة مرة أخرى.'
                  : 'Access denied. Please try again.'
              );
            } else {
              setMessage(
                language === 'ar'
                  ? 'حدث خطأ. يرجى المحاولة مرة أخرى.'
                  : 'An error occurred. Please try again.'
              );
            }
            setTimeout(() => navigate('/forgot-password'), 3000);
            return;
          }
          
          // Get tokens from hash if not already set
          if (!token_hash && !access_token) {
            token_hash = hashParams.get('token_hash');
            type = type || hashParams.get('type');
            access_token = hashParams.get('access_token');
            refresh_token = hashParams.get('refresh_token');
          }
        }

        // If we have access_token (PKCE flow), set the session directly
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          
          if (error) {
            console.error('Session set error:', error);
            setStatus('error');
            setMessage(language === 'ar' ? 'فشل التحقق' : 'Verification failed');
            setTimeout(() => navigate('/login'), 3000);
            return;
          }
          
          // Determine where to redirect based on type or default to dashboard
          const redirectType = type || searchParams.get('type') || 'signup';
          if (redirectType === 'recovery') {
            setStatus('success');
            setMessage(language === 'ar' ? 'يمكنك الآن إعادة تعيين كلمة المرور' : 'You can now reset your password');
            setTimeout(() => navigate('/reset-password'), 2000);
          } else {
            setStatus('success');
            setMessage(language === 'ar' ? 'تم التحقق بنجاح!' : 'Verified successfully!');
            setTimeout(() => navigate('/dashboard'), 2000);
          }
          return;
        }

        // Original token_hash flow
        if (!token_hash || !type) {
          setStatus('error');
          setMessage(language === 'ar' ? 'رابط غير صالح' : 'Invalid link');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Verify the token with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
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

        // Ensure session is set (verifyOtp returns session data)
        if (data?.session) {
          console.log('Session set successfully after verifyOtp');
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
          // For recovery, navigate immediately since session is already set
          // Using replace to prevent back button issues
          setTimeout(() => {
            navigate('/reset-password', { replace: true });
          }, 1500);
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
  }, [searchParams, location.hash, navigate, language]);

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
