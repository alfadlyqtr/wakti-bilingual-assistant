
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FawranPayment {
  id: string;
  plan_type: 'monthly' | 'yearly';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
}

export function FawranPaymentStatus() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<FawranPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPayments();
    }
  }, [user]);

  const loadPayments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('pending_fawran_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error("Failed to load payment status");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Under Review</Badge>;
    }
  };

  const getStatusMessage = (payment: FawranPayment) => {
    switch (payment.status) {
      case 'approved':
        return `Your ${payment.plan_type} plan subscription has been activated!`;
      case 'rejected':
        return 'Payment could not be verified. Please try again with a clearer screenshot.';
      default:
        return 'Your payment is being reviewed by our team. This usually takes 1-2 business days.';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Payment Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            No Payment Submissions
          </CardTitle>
          <CardDescription>
            You haven't submitted any Fawran payments yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Payment Status</h3>
        <Button variant="outline" size="sm" onClick={loadPayments}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {payments.map((payment) => (
        <Card key={payment.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                {getStatusIcon(payment.status)}
                {payment.plan_type.charAt(0).toUpperCase() + payment.plan_type.slice(1)} Plan - {payment.amount} QAR
              </CardTitle>
              {getStatusBadge(payment.status)}
            </div>
            <CardDescription>
              Submitted on {format(new Date(payment.submitted_at), 'PPpp')}
              {payment.reviewed_at && (
                <span className="block mt-1">
                  Reviewed on {format(new Date(payment.reviewed_at), 'PPpp')}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {getStatusMessage(payment)}
            </p>

            {payment.status === 'approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 font-medium">
                  ✅ Your subscription is now active! You can now enjoy all premium features.
                </p>
              </div>
            )}

            {payment.status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">
                  ❌ Payment verification failed. Please contact support or submit a new payment with a clearer screenshot.
                </p>
              </div>
            )}

            {payment.status === 'pending' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  ⏳ Your payment is being reviewed. We'll notify you once it's processed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
