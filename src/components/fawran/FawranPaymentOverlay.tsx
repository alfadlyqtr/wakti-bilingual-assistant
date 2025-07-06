
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanSelection } from "./PlanSelection";
import { PaymentInstructions } from "./PaymentInstructions";
import { ScreenshotUpload } from "./ScreenshotUpload";
import { PaymentProcessing } from "./PaymentProcessing";
import { PaymentResult } from "./PaymentResult";
import { PaymentStatusTracker } from "./PaymentStatusTracker";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = 'monthly' | 'yearly';

interface FawranPaymentOverlayProps {
  userEmail: string;
  onClose: () => void;
}

type PaymentStep = 'plan' | 'instructions' | 'upload' | 'processing' | 'result' | 'status';

export function FawranPaymentOverlay({ userEmail, onClose }: FawranPaymentOverlayProps) {
  const [currentStep, setCurrentStep] = useState<PaymentStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);
  const [paymentId, setPaymentId] = useState<string>('');
  const { user } = useAuth();

  // Reset state when overlay opens
  useEffect(() => {
    setCurrentStep('plan');
    setSelectedPlan(null);
    setPaymentResult(null);
    setPaymentId('');
  }, [userEmail]);

  const handlePlanSelect = (plan: PlanType) => {
    setSelectedPlan(plan);
    setCurrentStep('instructions');
  };

  const handleContinueToUpload = () => {
    setCurrentStep('upload');
  };

  const handleUploadComplete = (data: { screenshotUrl: string; senderAlias: string; paymentId: string }) => {
    setPaymentId(data.paymentId);
    setCurrentStep('processing');
  };

  const handleProcessingComplete = (result: { success: boolean; message: string }) => {
    setPaymentResult(result);
    if (result.success) {
      setCurrentStep('status');
    } else {
      setCurrentStep('result');
    }
  };

  const handleStatusChange = (status: string) => {
    if (status === 'approved') {
      setPaymentResult({ success: true, message: 'Payment approved and subscription activated!' });
      setCurrentStep('result');
    } else if (status === 'rejected') {
      setPaymentResult({ success: false, message: 'Payment was rejected. Please contact support.' });
      setCurrentStep('result');
    }
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setPaymentResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="p-6">
          {currentStep === 'plan' && (
            <PlanSelection onPlanSelect={handlePlanSelect} />
          )}

          {currentStep === 'instructions' && selectedPlan && (
            <PaymentInstructions
              selectedPlan={selectedPlan}
              onContinue={handleContinueToUpload}
              onBack={() => setCurrentStep('plan')}
            />
          )}

          {currentStep === 'upload' && selectedPlan && (
            <ScreenshotUpload
              userEmail={userEmail}
              selectedPlan={selectedPlan}
              onUploadComplete={handleUploadComplete}
              onBack={() => setCurrentStep('instructions')}
            />
          )}

          {currentStep === 'processing' && paymentId && (
            <PaymentProcessing 
              paymentId={paymentId}
              onProcessingComplete={handleProcessingComplete} 
            />
          )}

          {currentStep === 'status' && user && paymentId && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-enhanced-heading mb-2">
                  Payment Submitted Successfully! 🎉
                </h2>
                <p className="text-muted-foreground">
                  Your payment is being processed. You can track the status below:
                </p>
              </div>
              
              <PaymentStatusTracker 
                userId={user.id} 
                onStatusChange={handleStatusChange}
              />
              
              <div className="text-center">
                <Button onClick={onClose} className="w-full">
                  Continue Using Wakti
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'result' && paymentResult && (
            <PaymentResult
              result={paymentResult}
              onStartOver={paymentResult.success ? undefined : handleStartOver}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
