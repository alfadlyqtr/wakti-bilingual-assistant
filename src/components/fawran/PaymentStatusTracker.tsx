
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Upload, Eye, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentStatusTrackerProps {
  userId: string;
  onStatusChange?: (status: string) => void;
}

interface PaymentStatus {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  plan_type: string;
  amount: number;
}

export function PaymentStatusTracker({ userId, onStatusChange }: PaymentStatusTrackerProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkPaymentStatus();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('payment-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_fawran_payments',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('Payment status changed:', payload);
        checkPaymentStatus();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const checkPaymentStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_fawran_payments')
        .select('id, status, submitted_at, reviewed_at, plan_type, amount')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking payment status:', error);
        return;
      }

      setPaymentStatus(data);
      
      // Update progress based on status
      if (data) {
        switch (data.status) {
          case 'pending':
            setProgress(33);
            break;
          case 'approved':
            setProgress(100);
            break;
          case 'rejected':
            setProgress(100);
            break;
          default:
            setProgress(10);
        }
        
        onStatusChange?.(data.status);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentStatus) {
    return null;
  }

  const getStatusInfo = () => {
    switch (paymentStatus.status) {
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-amber-500 animate-pulse" />,
          badge: <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white animate-pulse">Processing</Badge>,
          title: 'Payment Being Processed',
          description: 'Our AI system is analyzing your payment screenshot. This usually takes 1-2 minutes.',
          bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
          borderColor: 'border-amber-200 dark:border-amber-800'
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          badge: <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">Approved</Badge>,
          title: 'Payment Approved!',
          description: 'Your subscription has been activated. Welcome to Wakti Premium!',
          bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'rejected':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          badge: <Badge variant="destructive">Rejected</Badge>,
          title: 'Payment Rejected',
          description: 'Your payment could not be verified. Please contact support or submit a new payment.',
          bgColor: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'refunded':
        return {
          icon: <AlertCircle className="h-5 w-5 text-blue-500" />,
          badge: <Badge className="bg-blue-500 text-white">Refunded</Badge>,
          title: 'Payment Refunded',
          description: 'This payment has been refunded due to a duplicate submission. Your subscription remains active.',
          bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      default:
        return {
          icon: <Upload className="h-5 w-5 text-gray-500" />,
          badge: <Badge variant="secondary">Unknown</Badge>,
          title: 'Payment Status Unknown',
          description: 'Please contact support for assistance.',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className={`${statusInfo.bgColor} ${statusInfo.borderColor} border-2 shadow-lg`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {statusInfo.icon}
            {statusInfo.title}
          </div>
          {statusInfo.badge}
        </CardTitle>
        <CardDescription className="text-foreground/70">
          {statusInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Payment Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Plan:</span>
            <div className="font-medium">{paymentStatus.plan_type} Plan</div>
          </div>
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <div className="font-medium">{paymentStatus.amount} QAR</div>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted:</span>
            <div className="font-medium">{new Date(paymentStatus.submitted_at).toLocaleString()}</div>
          </div>
          {paymentStatus.reviewed_at && (
            <div>
              <span className="text-muted-foreground">Reviewed:</span>
              <div className="font-medium">{new Date(paymentStatus.reviewed_at).toLocaleString()}</div>
            </div>
          )}
        </div>

        {paymentStatus.status === 'pending' && (
          <div className="flex items-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Please wait:</strong> Do not submit another payment while this one is being processed.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
