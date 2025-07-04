
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, UserCog, Gift } from "lucide-react";

interface PaymentMethodDistributionProps {
  distribution: {
    fawran: number;
    manual: number;
    gift: number;
  };
  isLoading: boolean;
}

export function PaymentMethodDistribution({ distribution, isLoading }: PaymentMethodDistributionProps) {
  if (isLoading) {
    return (
      <Card className="enhanced-card">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-40 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-6 bg-muted rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  
  const paymentMethods = [
    {
      key: 'fawran',
      label: 'Fawran (AI Verified)',
      count: distribution.fawran,
      icon: Smartphone,
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
      description: 'AI-verified bank transfers'
    },
    {
      key: 'manual',
      label: 'Manual Admin',
      count: distribution.manual,
      icon: UserCog,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      description: 'Admin-activated accounts'
    },
    {
      key: 'gift',
      label: 'Gift Subscriptions',
      count: distribution.gift,
      icon: Gift,
      color: 'text-accent-purple',
      bgColor: 'bg-accent-purple/10',
      description: 'Gifted by admin'
    }
  ];

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="text-enhanced-heading flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-accent-blue" />
          Payment Method Distribution
        </CardTitle>
        <CardDescription>
          {total} total active subscribers across all payment methods
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {paymentMethods.map((method) => {
            const percentage = total > 0 ? Math.round((method.count / total) * 100) : 0;
            const Icon = method.icon;
            
            return (
              <div key={method.key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${method.bgColor}`}>
                    <Icon className={`h-4 w-4 ${method.color}`} />
                  </div>
                  <div>
                    <div className="font-medium text-enhanced-heading">{method.label}</div>
                    <div className="text-xs text-muted-foreground">{method.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-enhanced-heading">{method.count}</div>
                  <Badge variant="secondary" className="text-xs">
                    {percentage}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        
        {distribution.fawran > 0 && (
          <div className="mt-4 p-3 bg-accent-green/5 border border-accent-green/20 rounded-lg">
            <div className="flex items-center space-x-2 text-accent-green">
              <Smartphone className="h-4 w-4" />
              <span className="text-sm font-medium">
                Fawran AI System: {Math.round((distribution.fawran / total) * 100)}% of subscriptions verified automatically
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
