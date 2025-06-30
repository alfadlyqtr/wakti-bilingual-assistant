
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface BillingHistory {
  id: string;
  plan_name: string;
  billing_amount: number;
  billing_currency: string;
  status: string;
  start_date: string;
  created_at: string;
}

export function BillingHistoryCard() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const isArabic = language === "ar";

  useEffect(() => {
    const fetchBillingHistory = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id, plan_name, billing_amount, billing_currency, status, start_date, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching billing history:', error);
        } else {
          setBillingHistory(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingHistory();
  }, [user?.id]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isArabic ? "سجل الفواتير" : "Billing History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            {isArabic ? "جاري التحميل..." : "Loading..."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isArabic ? "سجل الفواتير" : "Billing History"}
        </CardTitle>
        <CardDescription>
          {isArabic 
            ? "سجل جميع معاملاتك السابقة" 
            : "History of all your past transactions"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {billingHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isArabic 
              ? "لا يوجد سجل فواتير" 
              : "No billing history found"
            }
          </div>
        ) : (
          <div className="space-y-4">
            {billingHistory.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{item.plan_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString(
                      isArabic ? "ar-QA" : "en-US"
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {item.billing_amount} {item.billing_currency}
                  </div>
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
