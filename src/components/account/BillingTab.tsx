
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { BillingHistoryCard } from "./BillingHistoryCard";

export function BillingTab() {
  const { language } = useTheme();
  const { profile } = useAuth();

  const isArabic = language === "ar";

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isArabic ? "حالة الاشتراك" : "Subscription Status"}
          </CardTitle>
          <CardDescription>
            {isArabic 
              ? "معلومات اشتراكك الحالي" 
              : "Your current subscription information"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">
                  {isArabic ? "الحالة:" : "Status:"}
                </span>
                <Badge variant={profile?.is_subscribed ? "default" : "secondary"}>
                  {profile?.is_subscribed 
                    ? (isArabic ? "نشط" : "Active")
                    : (isArabic ? "غير نشط" : "Inactive")
                  }
                </Badge>
              </div>
              {profile?.is_subscribed && profile?.plan_name && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">
                    {isArabic ? "الخطة:" : "Plan:"}
                  </span>{" "}
                  {profile.plan_name}
                </div>
              )}
              {profile?.next_billing_date && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">
                    {isArabic ? "التجديد التالي:" : "Next billing:"}
                  </span>{" "}
                  {new Date(profile.next_billing_date).toLocaleDateString(
                    isArabic ? "ar-QA" : "en-US"
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <BillingHistoryCard />
    </div>
  );
}
