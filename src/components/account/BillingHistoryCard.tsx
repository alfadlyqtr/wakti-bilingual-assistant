
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface PaymentRecord {
  id: string;
  paypal_subscription_id: string;
  paypal_plan_id: string;
  plan_name: string;
  billing_amount: number;
  billing_currency: string;
  billing_cycle: string;
  status: string;
  start_date: string;
  next_billing_date: string;
  created_at: string;
}

interface BillingHistoryCardProps {
  paymentHistory: PaymentRecord[];
  isLoading: boolean;
}

export function BillingHistoryCard({ paymentHistory, isLoading }: BillingHistoryCardProps) {
  const { language } = useTheme();

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled':
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(language === "ar" ? "ar-QA" : "en-US", {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {language === "ar" ? "سجل المدفوعات" : "Payment History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {language === "ar" ? "سجل المدفوعات" : "Payment History"}
        </CardTitle>
        <CardDescription>
          {language === "ar" 
            ? "سجل جميع معاملات الاشتراك الخاصة بك"
            : "Track all your subscription transactions"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {paymentHistory.length > 0 ? (
          <div className="space-y-4">
            {paymentHistory.map((record) => (
              <div key={record.id} className="p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{record.plan_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {record.billing_amount} {record.billing_currency}
                    </p>
                    <Badge className={getStatusColor(record.status)} variant="outline">
                      <span className="flex items-center gap-1">
                        {getStatusIcon(record.status)}
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </Badge>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{language === "ar" ? "معرف PayPal:" : "PayPal ID:"} {record.paypal_subscription_id}</p>
                  {record.paypal_plan_id && (
                    <p>{language === "ar" ? "معرف الخطة:" : "Plan ID:"} {record.paypal_plan_id}</p>
                  )}
                  <p>{language === "ar" ? "دورة الفوترة:" : "Billing Cycle:"} {record.billing_cycle}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {language === "ar" ? "لا يوجد سجل مدفوعات" : "No payment history"}
            </h3>
            <p className="text-muted-foreground">
              {language === "ar" 
                ? "ستظهر معاملات الاشتراك الخاصة بك هنا"
                : "Your subscription transactions will appear here"
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
