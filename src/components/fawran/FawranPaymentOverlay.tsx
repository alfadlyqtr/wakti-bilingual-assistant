
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanSelection } from "./PlanSelection";
import { PaymentInstructions } from "./PaymentInstructions";
import { ScreenshotUpload } from "./ScreenshotUpload";
import { PaymentProcessing } from "./PaymentProcessing";
import { PaymentResult } from "./PaymentResult";
import { PaymentStatusTracker } from "./PaymentStatusTracker";
import { useAuthStore } from "@/store/authStore";

interface FawranPaymentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentStep = 'plan' | 'instructions' | 'upload' | 'processing' | 'result' | 'status';

export function FawranPaymentOverlay({ isOpen, onClose }: FawranPaymentOverlayProps) {
  const [currentStep, setCurrentStep] = useState<PaymentStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState<{ type: 'monthly' | 'yearly'; amount: number } | null>(null);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string } | null>(null);
  const { user } = useAuthStore();

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('plan');
      setSelectedPlan(null);
      setPaymentResult(null);
    }
  }, [isOpen]);

  const handlePlanSelect = (plan: { type: 'monthly' | 'yearly'; amount: number }) => {
    setSelectedPlan(plan);
    setCurrentStep('instructions');
  };

  const handleContinueToUpload = () => {
    setCurrentStep('upload');
  };

  const handleUploadComplete = () => {
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

  const handleTryAgain = () => {
    setCurrentStep('upload');
    setPaymentResult(null);
  };

  if (!isOpen) return null;

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
              plan={selectedPlan}
              onContinue={handleContinueToUpload}
              onBack={() => setCurrentStep('plan')}
            />
          )}

          {currentStep === 'upload' && selectedPlan && (
            <ScreenshotUpload
              plan={selectedPlan}
              onUploadComplete={handleUploadComplete}
              onBack={() => setCurrentStep('instructions')}
            />
          )}

          {currentStep === 'processing' && (
            <PaymentProcessing onComplete={handleProcessingComplete} />
          )}

          {currentStep === 'status' && user && (
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
              onTryAgain={paymentResult.success ? undefined : handleTryAgain}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
