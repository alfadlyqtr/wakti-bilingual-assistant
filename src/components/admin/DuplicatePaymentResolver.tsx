import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, CheckCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuplicatePayment {
  id: string;
  user_id: string;
  email: string;
  plan_type: string;
  amount: number;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
}

interface DuplicatePaymentResolverProps {
  duplicates: DuplicatePayment[];
  onResolved: () => void;
}

export function DuplicatePaymentResolver({ duplicates, onResolved }: DuplicatePaymentResolverProps) {
  const [isResolving, setIsResolving] = useState<string | null>(null);

  const handleResolveDuplicate = async (keepPayment: DuplicatePayment, refundPayment: DuplicatePayment) => {
    if (isResolving) return;
    
    try {
      setIsResolving(keepPayment.email);
      
      console.log('🔄 Resolving duplicate payments:', {
        keep: keepPayment.id,
        refund: refundPayment.id,
        email: keepPayment.email
      });

      const { data, error } = await supabase.functions.invoke('resolve-duplicate-subscription', {
        body: {
          userEmail: keepPayment.email,
          keepPaymentId: keepPayment.id,
          refundPaymentId: refundPayment.id
        }
      });

      if (error) {
        console.error('❌ Resolve duplicate error:', error);
        throw error;
      }

      console.log('✅ Duplicate resolved successfully:', data);
      toast.success(`✅ Duplicate payment resolved for ${keepPayment.email}! Refund processed.`);
      
      onResolved();
      
    } catch (error: any) {
      console.error('❌ Failed to resolve duplicate:', error);
      toast.error(`❌ Failed to resolve duplicate: ${error.message}`);
    } finally {
      setIsResolving(null);
    }
  };

  // Group duplicates by email
  const groupedDuplicates = duplicates.reduce((acc, payment) => {
    if (!acc[payment.email]) {
      acc[payment.email] = [];
    }
    acc[payment.email].push(payment);
    return acc;
  }, {} as Record<string, DuplicatePayment[]>);

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-5 w-5" />
            Duplicate Payment Detection
          </CardTitle>
          <CardDescription className="text-orange-600 dark:text-orange-400">
            {Object.keys(groupedDuplicates).length} users have duplicate payments that need resolution
          </CardDescription>
        </CardHeader>
      </Card>

      {Object.entries(groupedDuplicates).map(([email, payments]) => {
        if (payments.length < 2) return null;
        
        // Sort by submission date - keep the first one, refund the rest
        const sortedPayments = payments.sort((a, b) => 
          new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        );
        
        const keepPayment = sortedPayments[0];
        const refundPayments = sortedPayments.slice(1);

        return (
          <Card key={email} className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-red-600" />
                  <span className="text-red-700 dark:text-red-300">{email}</span>
                </div>
                <Badge variant="destructive" className="animate-pulse">
                  {payments.length} Payments
                </Badge>
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                Total charged: {payments.reduce((sum, p) => sum + p.amount, 0)} QAR 
                (should be {keepPayment.amount} QAR)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <div className="font-medium text-green-800 dark:text-green-200">
                      ✅ Keep: {keepPayment.amount} QAR ({keepPayment.plan_type})
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Submitted: {new Date(keepPayment.submitted_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge className="bg-green-500 text-white">Keep Active</Badge>
                </div>
                
                {refundPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                    <div>
                      <div className="font-medium text-red-800 dark:text-red-200">
                        💰 Refund: {payment.amount} QAR ({payment.plan_type})
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">
                        Submitted: {new Date(payment.submitted_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="destructive">Refund</Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                {refundPayments.map((refundPayment) => (
                  <Button
                    key={refundPayment.id}
                    onClick={() => handleResolveDuplicate(keepPayment, refundPayment)}
                    disabled={isResolving === email}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                  >
                    {isResolving === email ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Resolve Duplicate (Refund {refundPayment.amount} QAR)
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
