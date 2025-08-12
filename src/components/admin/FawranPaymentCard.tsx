
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, Clock, Brain } from "lucide-react";
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

interface FawranPaymentCardProps {
  payment: FawranPayment;
  onReview: (payment: FawranPayment) => void;
}

export const FawranPaymentCard = ({ payment, onReview }: FawranPaymentCardProps) => {
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

  const aiAnalysis = payment.review_notes ? getAIAnalysis(payment.review_notes) : null;

  return (
    <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {payment.profiles?.display_name || 'Unknown User'}
          </CardTitle>
          {getStatusBadge(payment.status)}
        </div>
        <CardDescription>{payment.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Plan:</span> {payment.plan_type} Plan
          </div>
          <div>
            <span className="font-medium">Amount:</span> {payment.amount} QAR
          </div>
          <div className="col-span-2">
            <span className="font-medium">Submitted:</span> {format(new Date(payment.submitted_at), 'MMM dd, yyyy HH:mm')}
          </div>
        </div>

        {aiAnalysis && (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">AI Analysis</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Confidence: {aiAnalysis.confidence}%</div>
              <div>Valid: {aiAnalysis.isValid ? '✅' : '❌'}</div>
              <div>Fawran: {aiAnalysis.isFawranPayment ? '✅' : '❌'}</div>
              <div>Recommendation: {aiAnalysis.recommendation}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onReview(payment)}
            className="flex-shrink-0"
          >
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
