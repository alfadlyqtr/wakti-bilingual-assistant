
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentAnalysisResult {
  paymentValid: boolean;
  amount?: number;
  senderAlias?: string;
  referenceNumber?: string;
  timeValidationPassed: boolean;
  tamperingDetected: boolean;
  duplicateDetected: boolean;
  confidence: number;
  issues: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId } = await req.json();
    
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    console.log('🔄 ENHANCED FAWRAN ANALYSIS - Starting for payment:', paymentId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment not found:', paymentError);
      throw new Error('Payment not found');
    }

    console.log('📊 Analyzing payment:', {
      id: payment.id,
      email: payment.email,
      amount: payment.amount,
      plan_type: payment.plan_type
    });

    // BULLETPROOF ANALYSIS - Multiple validation layers
    const analysisResult = await performEnhancedAnalysis(payment);
    
    console.log('🧠 Analysis result:', analysisResult);

    // Determine final status
    let finalStatus = 'pending';
    let reviewNotes = '';

    if (analysisResult.paymentValid && analysisResult.confidence >= 0.8) {
      finalStatus = 'approved';
      reviewNotes = `✅ AUTOMATED APPROVAL - High confidence validation (${Math.round(analysisResult.confidence * 100)}%)`;
      
      // Activate subscription immediately for high-confidence approvals
      try {
        await supabase.rpc('admin_activate_subscription', {
          p_user_id: payment.user_id,
          p_plan_name: payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan',
          p_billing_amount: payment.amount,
          p_billing_currency: 'QAR',
          p_payment_method: 'fawran',
          p_fawran_payment_id: payment.id
        });
        console.log('✅ Subscription activated automatically');
      } catch (activationError) {
        console.error('❌ Auto-activation failed:', activationError);
        finalStatus = 'pending'; // Fallback to manual review
        reviewNotes = `⚠️ Payment valid but auto-activation failed - Manual review required`;
      }
    } else if (analysisResult.confidence < 0.3 || analysisResult.tamperingDetected) {
      finalStatus = 'rejected';
      reviewNotes = `❌ AUTOMATED REJECTION - ${analysisResult.issues.join(', ')}`;
    } else {
      finalStatus = 'pending';
      reviewNotes = `🔍 MANUAL REVIEW REQUIRED - Medium confidence (${Math.round(analysisResult.confidence * 100)}%) - Issues: ${analysisResult.issues.join(', ')}`;
    }

    // Update payment record
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: finalStatus,
        reviewed_at: finalStatus !== 'pending' ? new Date().toISOString() : null,
        review_notes: reviewNotes,
        time_validation_passed: analysisResult.timeValidationPassed,
        tampering_detected: analysisResult.tamperingDetected,
        duplicate_detected: analysisResult.duplicateDetected,
        payment_reference_number: analysisResult.referenceNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('❌ Failed to update payment:', updateError);
      throw updateError;
    }

    // Send notification to user
    if (finalStatus === 'approved') {
      try {
        await supabase.rpc('queue_notification', {
          p_user_id: payment.user_id,
          p_notification_type: 'payment_approved',
          p_title: '🎉 Payment Approved!',
          p_body: 'Your Fawran payment has been approved and your subscription is now active.',
          p_data: {
            payment_id: paymentId,
            plan_type: payment.plan_type,
            amount: payment.amount
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });
      } catch (notificationError) {
        console.warn('⚠️ Notification failed (non-critical):', notificationError);
      }
    }

    console.log('✅ ENHANCED FAWRAN ANALYSIS COMPLETE:', {
      paymentId,
      finalStatus,
      confidence: analysisResult.confidence,
      autoProcessed: finalStatus !== 'pending'
    });

    return new Response(JSON.stringify({
      success: true,
      paymentId,
      status: finalStatus,
      confidence: analysisResult.confidence,
      analysis: analysisResult,
      autoProcessed: finalStatus !== 'pending'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 CRITICAL FAWRAN ANALYSIS ERROR:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      paymentId: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performEnhancedAnalysis(payment: any): Promise<PaymentAnalysisResult> {
  const issues: string[] = [];
  let confidence = 1.0;
  
  // 1. BASIC VALIDATION
  if (!payment.screenshot_url) {
    issues.push('No screenshot provided');
    confidence *= 0.1;
  }
  
  if (!payment.sender_alias) {
    issues.push('No sender alias provided');
    confidence *= 0.7;
  }
  
  // 2. TIME VALIDATION - Check if payment was submitted within reasonable time
  const submittedAt = new Date(payment.submitted_at);
  const now = new Date();
  const timeDiff = now.getTime() - submittedAt.getTime();
  const hoursAgo = timeDiff / (1000 * 60 * 60);
  
  const timeValidationPassed = hoursAgo <= 24; // Allow up to 24 hours
  if (!timeValidationPassed) {
    issues.push('Payment too old');
    confidence *= 0.3;
  }
  
  // 3. AMOUNT VALIDATION
  const expectedAmount = payment.plan_type === 'monthly' ? 60 : 600;
  const amountValid = payment.amount === expectedAmount;
  if (!amountValid) {
    issues.push(`Amount mismatch - Expected ${expectedAmount}, got ${payment.amount}`);
    confidence *= 0.2;
  }
  
  // 4. DUPLICATE DETECTION - Enhanced check
  let duplicateDetected = false;
  try {
    // Check for multiple payments from same user with same amount in last 24 hours
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: duplicates } = await supabase
      .from('pending_fawran_payments')
      .select('id')
      .eq('user_id', payment.user_id)
      .eq('amount', payment.amount)
      .gte('submitted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .neq('id', payment.id);
    
    duplicateDetected = (duplicates && duplicates.length > 0);
    if (duplicateDetected) {
      issues.push('Duplicate payment detected');
      confidence *= 0.1;
    }
  } catch (dupError) {
    console.warn('⚠️ Duplicate check failed:', dupError);
  }
  
  // 5. TAMPERING DETECTION - Basic checks
  let tamperingDetected = false;
  
  // Check for suspicious patterns in screenshot URL
  if (payment.screenshot_url && payment.screenshot_url.includes('localhost')) {
    tamperingDetected = true;
    issues.push('Suspicious screenshot source');
    confidence *= 0.1;
  }
  
  // 6. SENDER ALIAS VALIDATION
  if (payment.sender_alias) {
    // Basic format validation for Qatar banking aliases
    const aliasPattern = /^[a-zA-Z0-9]{3,20}$/;
    if (!aliasPattern.test(payment.sender_alias)) {
      issues.push('Invalid sender alias format');
      confidence *= 0.6;
    }
  }
  
  // 7. CONFIDENCE CALCULATION
  const baseConfidence = 0.8; // Start with high confidence
  const finalConfidence = Math.max(0, Math.min(1, confidence * baseConfidence));
  
  // 8. PAYMENT VALIDITY DETERMINATION
  const paymentValid = finalConfidence >= 0.3 && !tamperingDetected && amountValid;
  
  console.log('🔍 Enhanced analysis details:', {
    timeValidationPassed,
    amountValid,
    duplicateDetected,
    tamperingDetected,
    confidence: finalConfidence,
    issues: issues.length,
    paymentValid
  });
  
  return {
    paymentValid,
    amount: payment.amount,
    senderAlias: payment.sender_alias,
    referenceNumber: payment.sender_alias, // Use alias as reference for now
    timeValidationPassed,
    tamperingDetected,
    duplicateDetected,
    confidence: finalConfidence,
    issues
  };
}
