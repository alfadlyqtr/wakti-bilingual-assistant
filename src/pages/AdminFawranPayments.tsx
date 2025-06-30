
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Eye, CheckCircle, XCircle, Clock, Brain, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface FawranPayment {
  id: string;
  user_id: string;
  email: string;
  plan_type: 'monthly' | 'yearly';
  amount: number;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  profiles?: {
    display_name: string;
    email: string;
  };
}

export default function AdminFawranPayments() {
  const [payments, setPayments] = useState<FawranPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<FawranPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
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

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payment submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentAction = async (paymentId: string, action: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-fawran-payment', {
        body: {
          paymentId,
          action,
          adminNotes: adminNotes.trim() || undefined
        }
      });

      if (error) throw error;

      toast.success(`Payment ${action} successfully`);
      setSelectedPayment(null);
      setAdminNotes("");
      await loadPayments();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(`Failed to ${action} payment`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getAIAnalysis = (reviewNotes: string) => {
    try {
      const parsed = JSON.parse(reviewNotes);
      return parsed.ai_analysis || null;
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <AdminHeader 
          title="Fawran Payments" 
          subtitle="Review and manage payment submissions"
          icon={<CreditCard className="h-5 w-5 text-accent-blue" />}
        />
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">Loading payment submissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <AdminHeader 
        title="Fawran Payments" 
        subtitle={`${payments.length} payment submissions`}
        icon={<CreditCard className="h-5 w-5 text-accent-blue" />}
      />

      <div className="p-3 sm:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <div className="text-2xl font-bold text-yellow-600">
                {payments.filter(p => p.status === 'pending').length}
              </div>
            </CardHeader>
          </Card>
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <div className="text-2xl font-bold text-green-600">
                {payments.filter(p => p.status === 'approved').length}
              </div>
            </CardHeader>
          </Card>
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <div className="text-2xl font-bold text-red-600">
                {payments.filter(p => p.status === 'rejected').length}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle>Payment Submissions</CardTitle>
            <CardDescription>Review Fawran payment screenshots and manage approvals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>AI Analysis</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const aiAnalysis = payment.review_notes ? getAIAnalysis(payment.review_notes) : null;
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.profiles?.display_name || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">{payment.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.plan_type === 'yearly' ? 'Yearly' : 'Monthly'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{payment.amount} QAR</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>
                          {format(new Date(payment.submitted_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {aiAnalysis && (
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-blue-500" />
                              <Badge 
                                variant={aiAnalysis.confidence > 80 ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {aiAnalysis.confidence}% confidence
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Payment Submission</DialogTitle>
            <DialogDescription>
              Analyze the payment screenshot and approve or reject the submission
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div><strong>User:</strong> {selectedPayment.profiles?.display_name || 'Unknown'}</div>
                    <div><strong>Email:</strong> {selectedPayment.email}</div>
                    <div><strong>Plan:</strong> {selectedPayment.plan_type} Plan</div>
                    <div><strong>Amount:</strong> {selectedPayment.amount} QAR</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedPayment.status)}</div>
                    <div><strong>Submitted:</strong> {format(new Date(selectedPayment.submitted_at), 'PPpp')}</div>
                  </CardContent>
                </Card>

                {/* AI Analysis */}
                {selectedPayment.review_notes && (() => {
                  const aiAnalysis = getAIAnalysis(selectedPayment.review_notes);
                  return aiAnalysis && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Brain className="h-5 w-5 text-blue-500" />
                          AI Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div><strong>Validity:</strong> {aiAnalysis.isValid ? '✅ Valid' : '❌ Invalid'}</div>
                        <div><strong>Fawran Payment:</strong> {aiAnalysis.isFawranPayment ? '✅ Yes' : '❌ No'}</div>
                        <div><strong>Amount Match:</strong> {aiAnalysis.extractedAmount || 'N/A'}</div>
                        <div><strong>Recipient:</strong> {aiAnalysis.extractedRecipient || 'N/A'}</div>
                        <div><strong>Confidence:</strong> {aiAnalysis.confidence}%</div>
                        <div><strong>Recommendation:</strong> 
                          <Badge className={`ml-2 ${
                            aiAnalysis.recommendation === 'approve' ? 'bg-green-100 text-green-800' : 
                            aiAnalysis.recommendation === 'reject' ? 'bg-red-100 text-red-800' : 
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {aiAnalysis.recommendation}
                          </Badge>
                        </div>
                        {aiAnalysis.issues && aiAnalysis.issues.length > 0 && (
                          <div>
                            <strong>Issues:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {aiAnalysis.issues.map((issue: string, index: number) => (
                                <li key={index} className="text-sm text-red-600">{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>

              {/* Screenshot */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Payment Screenshot
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageModal(true)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Full Size
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={selectedPayment.screenshot_url}
                    alt="Payment Screenshot"
                    className="w-full max-w-md mx-auto border rounded-lg shadow-sm"
                  />
                </CardContent>
              </Card>

              {/* Admin Notes */}
              {selectedPayment.status === 'pending' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Admin Notes (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add any notes about this payment review..."
                      className="min-h-20"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              {selectedPayment.status === 'pending' && (
                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handlePaymentAction(selectedPayment.id, 'rejected')}
                    disabled={isProcessing}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Payment
                  </Button>
                  <Button
                    onClick={() => handlePaymentAction(selectedPayment.id, 'approved')}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Activate Subscription
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Size Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Payment Screenshot - Full Size</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="overflow-auto max-h-[80vh]">
              <img
                src={selectedPayment.screenshot_url}
                alt="Payment Screenshot Full Size"
                className="w-full h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
