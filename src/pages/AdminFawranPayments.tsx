
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, CreditCard, RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle, Brain, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  sender_alias?: string;
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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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
      
      console.log('🔄 Loading Fawran payments...');
      
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
        console.error('❌ Database error loading payments:', error);
        toast.error('Failed to load Fawran payments');
        return;
      }

      console.log('✅ Successfully loaded payments:', data?.length || 0);

      // Process the data to handle missing profiles gracefully
      const processedPayments = (data || []).map(payment => ({
        ...payment,
        user_display_name: payment.profiles?.display_name || 'Unknown User',
        email: payment.email || payment.profiles?.email || 'No email'
      })) as FawranPayment[];

      setPayments(processedPayments);
    } catch (error) {
      console.error('❌ Error loading Fawran payments:', error);
      toast.error('Failed to load Fawran payments');
    } finally {
      setIsLoading(false);
    }
  };

  // ENHANCED: Force analyze stuck payment
  const handleForceAnalyze = async (payment: FawranPayment) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(payment.id);
      console.log('🔥 Force analyzing payment:', payment.id);

      const { data, error } = await supabase.functions.invoke('manual-process-fawran-payment', {
        body: { 
          paymentId: payment.id,
          action: 'force_analyze'
        }
      });

      if (error) throw error;

      toast.success('Analysis triggered successfully!');
      
      // Reload payments after a short delay
      setTimeout(() => {
        loadPayments();
      }, 2000);

    } catch (error: any) {
      console.error('❌ Force analyze error:', error);
      toast.error(`Failed to analyze: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  // ENHANCED: Manual approval with subscription activation
  const handleManualApprove = async (payment: FawranPayment) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(payment.id);
      console.log('✅ Manually approving payment:', payment.id);

      const { data, error } = await supabase.functions.invoke('manual-process-fawran-payment', {
        body: { 
          paymentId: payment.id,
          action: 'approve'
        }
      });

      if (error) throw error;

      toast.success(`Payment approved and subscription activated for ${payment.email}`);
      loadPayments();
      
    } catch (error: any) {
      console.error('❌ Manual approval error:', error);
      toast.error(`Failed to approve: ${error.message}`);
    } finally {
      setIsProcessing(null);
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

      // Activate subscription using the clean admin function (NO PayPal parameters)
      const { error: activateError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan',
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
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

  const handleViewDetails = (payment: FawranPayment) => {
    setSelectedPayment(payment);
    setShowDetailModal(true);
  };

  // ENHANCED: Process all stuck payments
  const handleProcessStuckPayments = async () => {
    try {
      console.log('🔄 Processing all stuck payments...');
      toast.info('Processing stuck payments...');

      const { data, error } = await supabase.functions.invoke('process-stuck-fawran-payments', {
        body: {}
      });

      if (error) throw error;

      toast.success(`Processed ${data.processed} stuck payments (${data.successful} successful)`);
      loadPayments();
      
    } catch (error: any) {
      console.error('❌ Process stuck payments error:', error);
      toast.error(`Failed to process stuck payments: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  // Check if payment is stuck (pending for more than 5 minutes)
  const isPaymentStuck = (payment: FawranPayment) => {
    if (payment.status !== 'pending') return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(payment.submitted_at) < fiveMinutesAgo;
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
        <div className="flex gap-2">
          <Button onClick={handleProcessStuckPayments} variant="outline" size="sm" className="text-xs">
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Process Stuck</span>
          </Button>
          <Button onClick={loadPayments} variant="outline" size="sm" className="text-xs">
            <RefreshCw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
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
                <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                Stuck/Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {payments.filter(p => isPaymentStuck(p)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id} className={`bg-gradient-card border-border/50 hover:border-border/70 transition-all duration-300 ${isPaymentStuck(payment) ? 'border-red-500/50' : ''}`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-enhanced-heading text-base flex items-center gap-2">
                          {payment.email}
                          {isPaymentStuck(payment) && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              STUCK
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.user_display_name} • {payment.plan_type} Plan
                        </div>
                        {payment.sender_alias && (
                          <div className="text-sm text-muted-foreground">
                            Sender: {payment.sender_alias}
                          </div>
                        )}
                      </div>
                      {getStatusBadge(payment.status)}
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
                    
                    {(payment.payment_reference_number || payment.transaction_reference_number) && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Reference:</span>
                        <span className="ml-2 font-mono text-xs">
                          {payment.payment_reference_number || payment.transaction_reference_number}
                        </span>
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
                  
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewDetails(payment)}
                      className="text-xs hover:bg-accent-blue/10"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </Button>
                    
                    {payment.status === 'pending' && (
                      <>
                        {isPaymentStuck(payment) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleForceAnalyze(payment)}
                            disabled={isProcessing === payment.id}
                            className="text-xs hover:bg-accent-blue/10 border-blue-500 text-blue-600"
                          >
                            {isProcessing === payment.id ? (
                              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <Brain className="h-3 w-3 mr-1" />
                            )}
                            Force Analyze
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          onClick={() => handleManualApprove(payment)}
                          disabled={isProcessing === payment.id}
                          className="btn-enhanced text-xs hover:shadow-glow"
                        >
                          {isProcessing === payment.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <Zap className="h-3 w-3 mr-1" />
                          )}
                          Manual Approve
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRejectPayment(payment)}
                          disabled={isProcessing === payment.id}
                          className="text-xs"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {payments.length === 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No payments found</h3>
              <p className="text-muted-foreground">Fawran payment submissions will appear here.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Review payment submission from {selectedPayment?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">User:</span>
                  <p>{selectedPayment.user_display_name}</p>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <p>{selectedPayment.email}</p>
                </div>
                <div>
                  <span className="font-medium">Plan:</span>
                  <p>{selectedPayment.plan_type} Plan</p>
                </div>
                <div>
                  <span className="font-medium">Amount:</span>
                  <p>{selectedPayment.amount} QAR</p>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                </div>
                <div>
                  <span className="font-medium">Submitted:</span>
                  <p>{new Date(selectedPayment.submitted_at).toLocaleString()}</p>
                </div>
                {selectedPayment.sender_alias && (
                  <div className="col-span-2">
                    <span className="font-medium">Fawran Sender Alias:</span>
                    <p>{selectedPayment.sender_alias}</p>
                  </div>
                )}
                {(selectedPayment.payment_reference_number || selectedPayment.transaction_reference_number) && (
                  <div className="col-span-2">
                    <span className="font-medium">Reference Number:</span>
                    <p className="font-mono text-xs">
                      {selectedPayment.payment_reference_number || selectedPayment.transaction_reference_number}
                    </p>
                  </div>
                )}
              </div>

              {/* Security Checks */}
              <div>
                <h4 className="font-medium mb-2">Security Validation</h4>
                <div className="grid grid-cols-3 gap-2">
                  <Badge variant={selectedPayment.time_validation_passed ? "default" : "secondary"} className="justify-center">
                    {selectedPayment.time_validation_passed ? "✅" : "⏳"} Time Check
                  </Badge>
                  <Badge variant={selectedPayment.tampering_detected ? "destructive" : "default"} className="justify-center">
                    {selectedPayment.tampering_detected ? "⚠️" : "✅"} Integrity
                  </Badge>
                  <Badge variant={selectedPayment.duplicate_detected ? "destructive" : "default"} className="justify-center">
                    {selectedPayment.duplicate_detected ? "⚠️" : "✅"} Unique
                  </Badge>
                </div>
              </div>

              {/* Screenshot */}
              <div>
                <h4 className="font-medium mb-2">Payment Screenshot</h4>
                <div className="border rounded-lg overflow-hidden">
                  <img 
                    src={selectedPayment.screenshot_url} 
                    alt="Payment screenshot"
                    className="w-full h-auto max-h-96 object-contain bg-gray-50 dark:bg-gray-900"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(selectedPayment.screenshot_url, '_blank')}
                  className="mt-2 w-full"
                >
                  Open Full Size
                </Button>
              </div>

              {/* Review Notes */}
              {selectedPayment.review_notes && (
                <div>
                  <h4 className="font-medium mb-2">Review Notes</h4>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    {selectedPayment.review_notes}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedPayment.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t">
                  {isPaymentStuck(selectedPayment) && (
                    <Button 
                      onClick={() => {
                        handleForceAnalyze(selectedPayment);
                        setShowDetailModal(false);
                      }}
                      disabled={isProcessing === selectedPayment.id}
                      className="flex-1 btn-enhanced"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Force Analyze
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => {
                      handleManualApprove(selectedPayment);
                      setShowDetailModal(false);
                    }}
                    disabled={isProcessing === selectedPayment.id}
                    className="flex-1 btn-enhanced"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Manual Approve & Activate
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      handleRejectPayment(selectedPayment);
                      setShowDetailModal(false);
                    }}
                    disabled={isProcessing === selectedPayment.id}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Payment
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
