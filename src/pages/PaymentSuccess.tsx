
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Logo3D } from '@/components/Logo3D';
import { FawranService } from '@/services/fawranService';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const { language } = useTheme();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    const verifyPayment = async () => {
      const transactionId = searchParams.get('transaction_id');
      const planType = searchParams.get('plan_type') as 'monthly' | 'yearly';

      if (!transactionId || !planType || !user?.id) {
        setVerificationStatus('failed');
        setIsVerifying(false);
        return;
      }

      try {
        // Verify payment with Fawran
        const isValid = await FawranService.verifyPayment(transactionId);
        
        if (isValid) {
          // Activate subscription
          const activated = await FawranService.activateSubscription(user.id, planType, transactionId);
          
          if (activated) {
            await refreshProfile();
            setVerificationStatus('success');
          } else {
            setVerificationStatus('failed');
          }
        } else {
          setVerificationStatus('failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setVerificationStatus('failed');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, user?.id, refreshProfile]);

  const handleContinue = () => {
    navigate('/dashboard');
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Logo3D size="sm" />
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("verifyingPayment", language)}
            </CardTitle>
            <CardDescription>
              {t("pleaseWait", language)}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (verificationStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Logo3D size="sm" />
            <CardTitle className="text-destructive">
              {t("paymentFailed", language)}
            </CardTitle>
            <CardDescription>
              {t("paymentVerificationFailed", language)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              {t("returnToDashboard", language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo3D size="sm" />
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-green-600">
            {t("paymentSuccessful", language)}
          </CardTitle>
          <CardDescription>
            {t("subscriptionActivated", language)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-green-700 text-sm text-center">
              {t("welcomeToWaktiPro", language)}
            </p>
          </div>
          <Button onClick={handleContinue} className="w-full">
            {t("continueToDashboard", language)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
