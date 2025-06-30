
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreditCard, Calendar, ExternalLink, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface SubscriptionRecord {
  id: string;
  plan_name: string;
  billing_amount: number;
  billing_currency: string;
  billing_cycle: string;
  status: string;
  start_date: string;
  next_billing_date: string;
  created_at: string;
}

export function BillingTab() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionHistory();
  }, [user]);

  const loadSubscriptionHistory = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('Loading subscription history for user:', user.id);

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading subscription history:', error);
        toast.error(language === "ar" 
          ? "فشل في تحميل سجل الاشتراكات" 
          : "Failed to load subscription history"
        );
        return;
      }

      console.log('Subscription history loaded:', data);
      setSubscriptionHistory(data || []);
      
    } catch (error) {
      console.error('Failed to load subscription history:', error);
      toast.error(language === "ar" 
        ? "فشل في تحميل سجل الاشتراكات" 
        : "Failed to load subscription history"
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {language === "ar" ? "حالة الاشتراك الحالي" : "Current Subscription"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionHistory.length > 0 ? (
            <div className="space-y-4">
              {subscriptionHistory.slice(0, 1).map((record) => (
                <div key={record.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{record.plan_name}</h3>
                    <Badge className={getStatusColor(record.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(record.status)}
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">
                        {language === "ar" ? "المبلغ" : "Amount"}
                      </p>
                      <p className="font-medium">
                        {record.billing_amount} {record.billing_currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {language === "ar" ? "دورة الفوترة" : "Billing Cycle"}
                      </p>
                      <p className="font-medium capitalize">{record.billing_cycle}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {language === "ar" ? "تاريخ البداية" : "Start Date"}
                      </p>
                      <p className="font-medium">{formatDate(record.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {language === "ar" ? "الفوترة التالية" : "Next Billing"}
                      </p>
                      <p className="font-medium">{formatDate(record.next_billing_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {language === "ar" ? "لا يوجد اشتراك نشط" : "No active subscription"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {language === "ar" ? "سجل الاشتراكات" : "Subscription History"}
          </CardTitle>
          <CardDescription>
            {language === "ar" 
              ? "سجل جميع اشتراكاتك السابقة"
              : "Track all your subscription history"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : subscriptionHistory.length > 0 ? (
            <div className="space-y-4">
              {subscriptionHistory.map((record) => (
                <div key={record.id} className="p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                    <p>{language === "ar" ? "دورة الفوترة:" : "Billing Cycle:"} {record.billing_cycle}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {language === "ar" ? "لا يوجد سجل اشتراكات" : "No subscription history"}
              </h3>
              <p className="text-muted-foreground">
                {language === "ar" 
                  ? "ستظهر اشتراكاتك هنا"
                  : "Your subscriptions will appear here"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Support */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar" ? "دعم الفوترة" : "Billing Support"}
          </CardTitle>
          <CardDescription>
            {language === "ar" 
              ? "هل تحتاج إلى مساعدة في الفوترة أو الاشتراك؟"
              : "Need help with billing or subscriptions?"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="mailto:billing@wakti.qa">
                <ExternalLink className="h-4 w-4 mr-2" />
                {language === "ar" ? "التواصل مع دعم الفوترة" : "Contact Billing Support"}
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => window.open('/contact', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {language === "ar" ? "إرسال استفسار" : "Submit Inquiry"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
