
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, CreditCard, RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface FawranPayment {
  id: string;
  user_id: string;
  email: string;
  plan_type: string;
  amount: number;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  screenshot_url: string;
  payment_reference_number?: string;
  transaction_reference_number?: string;
  review_notes?: string;
  time_validation_passed: boolean;
  tampering_detected: boolean;
  duplicate_detected: boolean;
  user_display_name?: string;
}

export default function AdminFawranPayments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<FawranPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<FawranPayment | null>(null);

  useEffect(() => {
    validateAdminSession();
    loadPayments();
  }, []);

  const validateAdminSession = async () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      navigate('/mqtr');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        navigate('/mqtr');
        return;
      }
    } catch (err) {
      navigate('/mqtr');
    }
  };

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      
      // Query pending_fawran_payments with left join to profiles
      const { data, error } = await supabase
        .from('pending_fawran_payments')
        .select(`
          *,
          profiles:user_id (
            display_name,
            email
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        toast.error('Failed to load Fawran payments');
        return;
      }

      // Process the data to handle missing profiles gracefully
      const processedPayments = (data || []).map(payment => ({
        ...payment,
        user_display_name: payment.profiles?.display_name || 'Unknown User',
        email: payment.email || payment.profiles?.email || 'No email'
      })) as FawranPayment[];

      setPayments(processedPayments);
    } catch (error) {
      console.error('Error loading Fawran payments:', error);
      toast.error('Failed to load Fawran payments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePayment = async (payment: FawranPayment) => {
    try {
      // Update payment status to approved
      const { error: updateError } = await supabase
        .from('pending_fawran_payments')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: 'Approved by admin'
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Activate subscription using the admin function
      const { error: activateError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: payment.plan_type,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
        p_paypal_subscription_id: null,
        p_fawran_payment_id: payment.id
      });

      if (activateError) throw activateError;

      toast.success(`Payment approved and subscription activated for ${payment.email}`);
      loadPayments();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error('Failed to approve payment');
    }
  };

  const handleRejectPayment = async (payment: FawranPayment) => {
    try {
      const { error } = await supabase
        .from('pending_fawran_payments')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_notes: 'Rejected by admin'
        })
        .eq('id', payment.id);

      if (error) throw error;

      toast.success(`Payment rejected for ${payment.email}`);
      loadPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-background min-h-screen p-4 flex items-center justify-center">
        <div className="text-foreground">Loading Fawran payments...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Header */}
      <AdminHeader
        title="Fawran Payments"
        subtitle={`${payments.filter(p => p.status === 'pending').length} pending payments`}
        icon={<CreditCard className="h-5 w-5 text-accent-purple" />}
      >
        <Button onClick={loadPayments} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <CreditCard className="h-4 w-4 mr-2 text-accent-purple" />
                Total Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">{payments.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-accent-orange" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-orange">
                {payments.filter(p => p.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <CheckCircle className="h-4 w-4 mr-2 text-accent-green" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-green">
                {payments.filter(p => p.status === 'approved').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-destructive/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {payments.filter(p => p.status === 'rejected').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">Payment Submissions</CardTitle>
            <CardDescription>Review and manage Fawran payment submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="bg-gradient-card border border-border/30 rounded-xl p-6 hover:border-border/50 transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-enhanced-heading text-base">
                            {payment.email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.user_display_name} • {payment.plan_type}
                          </div>
                        </div>
                        <Badge 
                          variant={
                            payment.status === 'pending' ? 'secondary' :
                            payment.status === 'approved' ? 'default' : 'destructive'
                          }
                          className="text-xs"
                        >
                          {payment.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="ml-2 font-medium">{payment.amount} QAR</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>
                          <span className="ml-2">{new Date(payment.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {payment.payment_reference_number && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reference:</span>
                          <span className="ml-2 font-mono">{payment.payment_reference_number}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        {payment.time_validation_passed && (
                          <Badge variant="outline" className="text-xs border-accent-green text-accent-green">
                            Time Valid
                          </Badge>
                        )}
                        {payment.tampering_detected && (
                          <Badge variant="destructive" className="text-xs">
                            Tampering
                          </Badge>
                        )}
                        {payment.duplicate_detected && (
                          <Badge variant="destructive" className="text-xs">
                            Duplicate
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {payment.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(payment.screenshot_url, '_blank')}
                          className="text-xs hover:bg-accent-blue/10"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleApprovePayment(payment)}
                          className="btn-enhanced text-xs hover:shadow-glow"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRejectPayment(payment)}
                          className="text-xs"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
