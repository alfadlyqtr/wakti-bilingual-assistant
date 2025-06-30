
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Logo3D } from '@/components/Logo3D';

export default function PaymentCancelled() {
  const navigate = useNavigate();
  const { language } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo3D size="sm" />
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <X className="w-8 h-8 text-orange-600" />
          </div>
          <CardTitle className="text-orange-600">
            {t("paymentCancelled", language)}
          </CardTitle>
          <CardDescription>
            {t("paymentWasCancelled", language)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-orange-700 text-sm text-center">
              {t("subscriptionNotActivated", language)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/dashboard')} variant="outline" className="flex-1">
              {t("continueFree", language)}
            </Button>
            <Button onClick={() => navigate('/dashboard')} className="flex-1">
              {t("tryAgain", language)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
