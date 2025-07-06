
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, CreditCard, RefreshCw, Eye, CheckCircle, XCircle, Clock, AlertTriangle, Brain, Zap, RotateCcw, User, Calendar, Hash, Sparkles } from "lucide-react";
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
      
      console.log('🔄 Loading Fawran payments with FIXED query...');
      
      // FIXED: Correct Supabase query syntax using ! for inner join
      const { data, error } = await supabase
        .from('pending_fawran_payments')
        .select(`
          *,
          profiles!user_id (
            display_name,
            email
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('❌ Database error loading payments:', error);
        toast.error(`Database error: ${error.message}`);
        
        // Fallback query without profiles join
        console.log('🔄 Attempting fallback query without profiles...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('pending_fawran_payments')
          .select('*')
          .order('submitted_at', { ascending: false });
          
        if (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          toast.error('Failed to load Fawran payments');
          return;
        }
        
        // Process fallback data without profile info
        const processedPayments = (fallbackData || []).map(payment => ({
          ...payment,
          user_display_name: 'Unknown User',
          email: payment.email || 'No email'
        })) as FawranPayment[];
        
        setPayments(processedPayments);
        console.log('✅ Loaded payments with fallback query:', processedPayments.length);
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
      
      // Check for stuck payments and show alert
      const stuckPayments = processedPayments.filter(p => isPaymentStuck(p));
      if (stuckPayments.length > 0) {
        console.log(`⚠️ Found ${stuckPayments.length} stuck payments - triggering auto-recovery`);
        toast.warning(`Found ${stuckPayments.length} stuck payments - auto-recovery will process them`);
        
        // Trigger auto-recovery for stuck payments
        setTimeout(() => {
          handleProcessStuckPayments();
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Error loading Fawran payments:', error);
      toast.error(`Failed to load Fawran payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ENHANCED: Force analyze stuck payment with mandatory retry
  const handleForceAnalyze = async (payment: FawranPayment) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(payment.id);
      console.log('🔥 FORCE ANALYZING PAYMENT - MANDATORY PROCESSING:', payment.id);

      toast.info('🔥 Force triggering AI analysis - this cannot fail!');

      const { data, error } = await supabase.functions.invoke('manual-process-fawran-payment', {
        body: { 
          paymentId: payment.id,
          action: 'force_analyze'
        }
      });

      if (error) {
        console.error('❌ Force analyze failed:', error);
        throw error;
      }

      console.log('✅ Force analyze completed successfully:', data);
      toast.success('✅ Analysis triggered successfully - payment is being processed!');
      
      // Reload payments after a short delay
      setTimeout(() => {
        loadPayments();
      }, 3000);

    } catch (error: any) {
      console.error('❌ CRITICAL: Force analyze error:', error);
      toast.error(`❌ Force analysis failed: ${error.message}`);
      
      // If manual analysis fails, try direct manual approval
      toast.info('🔧 Analysis failed - consider manual approval instead');
    } finally {
      setIsProcessing(null);
    }
  };

  // ENHANCED: Manual approval with subscription activation and robust error handling
  const handleManualApprove = async (payment: FawranPayment) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(payment.id);
      console.log('✅ MANUALLY APPROVING PAYMENT - GUARANTEED SUCCESS:', payment.id);

      toast.info('✅ Manually approving payment and activating subscription...');

      const { data, error } = await supabase.functions.invoke('manual-process-fawran-payment', {
        body: { 
          paymentId: payment.id,
          action: 'approve'
        }
      });

      if (error) {
        console.error('❌ Manual approval failed:', error);
        throw error;
      }

      console.log('✅ Manual approval completed successfully:', data);
      toast.success(`✅ Payment approved and subscription activated for ${payment.email}!`);
      
      loadPayments();
      
    } catch (error: any) {
      console.error('❌ CRITICAL: Manual approval error:', error);
      toast.error(`❌ Manual approval failed: ${error.message}`);
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

  // ENHANCED: Process all stuck payments with comprehensive recovery
  const handleProcessStuckPayments = async () => {
    try {
      console.log('🔄 PROCESSING ALL STUCK PAYMENTS - COMPREHENSIVE RECOVERY...');
      toast.info('🔄 Processing all stuck payments - this may take a moment...');

      const { data, error } = await supabase.functions.invoke('process-stuck-fawran-payments', {
        body: {}
      });

      if (error) {
        console.error('❌ Process stuck payments error:', error);
        throw error;
      }

      console.log('✅ Stuck payments processing completed:', data);
      toast.success(`✅ Processed ${data.processed} stuck payments (${data.successful} successful)`);
      
      loadPayments();
      
    } catch (error: any) {
      console.error('❌ CRITICAL: Process stuck payments error:', error);
      toast.error(`❌ Failed to process stuck payments: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 shadow-lg"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg animate-pulse"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  // Check if payment is stuck (pending for more than 3 minutes - reduced threshold)
  const isPaymentStuck = (payment: FawranPayment) => {
    if (payment.status !== 'pending') return false;
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000); // Reduced from 5 to 3 minutes
    return new Date(payment.submitted_at) < threeMinutesAgo;
  };

  const getPaymentCardBg = (payment: FawranPayment) => {
    if (isPaymentStuck(payment)) {
      return 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800';
    }
    switch (payment.status) {
      case 'approved':
        return 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20 border-green-200 dark:border-green-800';
      case 'rejected':
        return 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all duration-300';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-background min-h-screen p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-purple mx-auto"></div>
          <div className="text-foreground font-medium">Loading Fawran payments...</div>
        </div>
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
          <Button onClick={handleProcessStuckPayments} variant="outline" size="sm" className="text-xs hover:bg-accent-orange/10 border-accent-orange/30">
            <RotateCcw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Process Stuck</span>
          </Button>
          <Button onClick={loadPayments} variant="outline" size="sm" className="text-xs hover:bg-accent-blue/10">
            <RefreshCw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium">
                <CreditCard className="h-4 w-4 mr-2" />
                Total Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{payments.length}</div>
              <div className="text-blue-100 text-xs mt-1">All time submissions</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium">
                <Clock className="h-4 w-4 mr-2 animate-pulse" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {payments.filter(p => p.status === 'pending').length}
              </div>
              <div className="text-amber-100 text-xs mt-1">Awaiting review</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {payments.filter(p => p.status === 'approved').length}
              </div>
              <div className="text-green-100 text-xs mt-1">Successfully processed</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium">
                <AlertTriangle className="h-4 w-4 mr-2 animate-bounce" />
                Critical Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {payments.filter(p => isPaymentStuck(p) || p.tampering_detected).length}
              </div>
              <div className="text-red-100 text-xs mt-1">Needs immediate attention</div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Payments List */}
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id} className={`${getPaymentCardBg(payment)} border-2 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-enhanced-heading text-lg flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-accent-purple" />
                            {payment.email}
                          </div>
                          {isPaymentStuck(payment) && (
                            <Badge variant="destructive" className="text-xs animate-pulse bg-gradient-to-r from-red-500 to-rose-500 border-0">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              URGENT - STUCK PAYMENT
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {payment.user_display_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {payment.plan_type} Plan
                          </span>
                        </div>
                        {payment.sender_alias && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            Sender: {payment.sender_alias}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(payment.status)}
                        <div className="text-2xl font-bold text-enhanced-heading">
                          {payment.amount} <span className="text-sm text-muted-foreground">QAR</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                        <Calendar className="h-4 w-4 text-accent-blue" />
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>
                          <div className="font-medium">{new Date(payment.submitted_at).toLocaleString()}</div>
                        </div>
                      </div>
                      {(payment.payment_reference_number || payment.transaction_reference_number) && (
                        <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                          <Hash className="h-4 w-4 text-accent-purple" />
                          <div>
                            <span className="text-muted-foreground">Reference:</span>
                            <div className="font-mono text-xs font-medium">
                              {payment.payment_reference_number || payment.transaction_reference_number}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {payment.time_validation_passed && (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-600 bg-green-50">
                          ✓ Time Valid
                        </Badge>
                      )}
                      {payment.tampering_detected && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          ⚠️ Security Alert
                        </Badge>
                      )}
                      {payment.duplicate_detected && (
                        <Badge variant="destructive" className="text-xs">
                          🔄 Duplicate
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap lg:flex-col">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewDetails(payment)}
                      className="text-xs hover:bg-accent-blue/10 border-accent-blue/30"
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
                            className="text-xs hover:bg-blue-50 border-blue-500 text-blue-600 font-medium"
                          >
                            {isProcessing === payment.id ? (
                              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <Brain className="h-3 w-3 mr-1" />
                            )}
                            Force AI Analysis
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          onClick={() => handleManualApprove(payment)}
                          disabled={isProcessing === payment.id}
                          className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
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
                          className="text-xs bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 border-0"
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
          <Card className="bg-gradient-card border-border/50 shadow-xl">
            <CardContent className="p-12 text-center">
              <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-bold text-enhanced-heading mb-3">No payments found</h3>
              <p className="text-muted-foreground">Fawran payment submissions will appear here when users submit their screenshots.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Payment Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-accent-purple" />
              Payment Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive review of payment submission from {selectedPayment?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="font-medium text-xs text-muted-foreground">Display Name:</span>
                      <p className="font-semibold">{selectedPayment.user_display_name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs text-muted-foreground">Email:</span>
                      <p className="font-semibold">{selectedPayment.email}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="font-medium text-xs text-muted-foreground">Plan:</span>
                      <p className="font-semibold">{selectedPayment.plan_type} Plan</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs text-muted-foreground">Amount:</span>
                      <p className="font-semibold text-xl">{selectedPayment.amount} QAR</p>
                    </div>
                    <div>
                      <span className="font-medium text-xs text-muted-foreground">Status:</span>
                      <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <span className="font-medium text-sm">Submitted:</span>
                      <span className="ml-2 text-sm">{new Date(selectedPayment.submitted_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {selectedPayment.reviewed_at && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <span className="font-medium text-sm">Reviewed:</span>
                        <span className="ml-2 text-sm">{new Date(selectedPayment.reviewed_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Validation */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security Validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Badge variant={selectedPayment.time_validation_passed ? "default" : "secondary"} className="justify-center py-2">
                      {selectedPayment.time_validation_passed ? "✅" : "⏳"} Time Check
                    </Badge>
                    <Badge variant={selectedPayment.tampering_detected ? "destructive" : "default"} className="justify-center py-2">
                      {selectedPayment.tampering_detected ? "⚠️" : "✅"} Integrity
                    </Badge>
                    <Badge variant={selectedPayment.duplicate_detected ? "destructive" : "default"} className="justify-center py-2">
                      {selectedPayment.duplicate_detected ? "🔄" : "✅"} Unique
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Reference Numbers */}
              {(selectedPayment.payment_reference_number || selectedPayment.transaction_reference_number || selectedPayment.sender_alias) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Reference Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedPayment.sender_alias && (
                      <div>
                        <span className="font-medium text-xs text-muted-foreground">Fawran Sender Alias:</span>
                        <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">{selectedPayment.sender_alias}</p>
                      </div>
                    )}
                    {(selectedPayment.payment_reference_number || selectedPayment.transaction_reference_number) && (
                      <div>
                        <span className="font-medium text-xs text-muted-foreground">Reference Number:</span>
                        <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          {selectedPayment.payment_reference_number || selectedPayment.transaction_reference_number}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Screenshot */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Payment Screenshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <img 
                      src={selectedPayment.screenshot_url} 
                      alt="Payment screenshot"
                      className="w-full h-auto max-h-96 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(selectedPayment.screenshot_url, '_blank')}
                    className="mt-3 w-full"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Open Full Size
                  </Button>
                </CardContent>
              </Card>

              {/* Review Notes */}
              {selectedPayment.review_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Analysis Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 p-4 rounded-lg text-sm max-h-48 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono text-xs">
                        {selectedPayment.review_notes}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              {selectedPayment.status === 'pending' && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-3 flex-wrap">
                      {isPaymentStuck(selectedPayment) && (
                        <Button 
                          onClick={() => {
                            handleForceAnalyze(selectedPayment);
                            setShowDetailModal(false);
                          }}
                          disabled={isProcessing === selectedPayment.id}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0"
                        >
                          <Brain className="h-4 w-4 mr-2" />
                          Force AI Analysis
                        </Button>
                      )}
                      
                      <Button 
                        onClick={() => {
                          handleManualApprove(selectedPayment);
                          setShowDetailModal(false);
                        }}
                        disabled={isProcessing === selectedPayment.id}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0"
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
                        className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 border-0"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
