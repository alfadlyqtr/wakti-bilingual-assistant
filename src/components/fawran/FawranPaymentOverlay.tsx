
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { PlanSelection } from './PlanSelection';
import { PaymentInstructions } from './PaymentInstructions';
import { ScreenshotUpload } from './ScreenshotUpload';
import { PaymentProcessing } from './PaymentProcessing';
import { PaymentResult } from './PaymentResult';

export type PaymentStep = 'plan' | 'instructions' | 'upload' | 'processing' | 'result';
export type PlanType = 'monthly' | 'yearly';

interface FawranPaymentOverlayProps {
  userEmail: string;
  onClose: () => void;
}

export function FawranPaymentOverlay({ userEmail, onClose }: FawranPaymentOverlayProps) {
  const { language } = useTheme();
  const [currentStep, setCurrentStep] = useState<PaymentStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [paymentData, setPaymentData] = useState<{
    screenshotUrl: string;
    senderAlias: string;
    paymentId: string;
  } | null>(null);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    needsReview?: boolean;
    message?: string;
  } | null>(null);

  console.log('FawranPaymentOverlay - Current step:', currentStep);
  console.log('FawranPaymentOverlay - Selected plan:', selectedPlan);

  const handlePlanSelect = (plan: PlanType) => {
    console.log('Plan selected:', plan);
    setSelectedPlan(plan);
    setCurrentStep('instructions');
  };

  const handleContinueToUpload = () => {
    console.log('Continuing to upload step');
    setCurrentStep('upload');
  };

  const handleUploadComplete = (data: { screenshotUrl: string; senderAlias: string; paymentId: string }) => {
    console.log('Upload complete, moving to processing:', data);
    setPaymentData(data);
    setCurrentStep('processing');
  };

  const handleProcessingComplete = (result: { success: boolean; needsReview?: boolean; message?: string }) => {
    console.log('Processing complete:', result);
    setPaymentResult(result);
    setCurrentStep('result');
  };

  const handleBackToInstructions = () => {
    console.log('Going back to instructions');
    setCurrentStep('instructions');
  };

  const handleBackToPlan = () => {
    console.log('Going back to plan selection');
    setCurrentStep('plan');
  };

  const handleStartOver = () => {
    console.log('Starting over');
    setCurrentStep('plan');
    setPaymentData(null);
    setPaymentResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        {currentStep === 'plan' && (
          <PlanSelection onPlanSelect={handlePlanSelect} />
        )}
        
        {currentStep === 'instructions' && (
          <PaymentInstructions 
            selectedPlan={selectedPlan}
            onContinue={handleContinueToUpload}
            onBack={handleBackToPlan}
          />
        )}
        
        {currentStep === 'upload' && (
          <ScreenshotUpload
            userEmail={userEmail}
            selectedPlan={selectedPlan}
            onUploadComplete={handleUploadComplete}
            onBack={handleBackToInstructions}
          />
        )}
        
        {currentStep === 'processing' && paymentData && (
          <PaymentProcessing
            paymentId={paymentData.paymentId}
            onProcessingComplete={handleProcessingComplete}
          />
        )}
        
        {currentStep === 'result' && paymentResult && (
          <PaymentResult
            result={paymentResult}
            onStartOver={handleStartOver}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
