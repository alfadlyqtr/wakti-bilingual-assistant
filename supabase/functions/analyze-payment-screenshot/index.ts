
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CRITICAL FIX: Add OpenAI Vision API for actual screenshot analysis
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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
  visionAnalysis?: any; // NEW: Vision analysis results
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
      plan_type: payment.plan_type,
      has_screenshot: !!payment.screenshot_url
    });

    // ENHANCED ANALYSIS - Multiple validation layers with Vision AI
    const analysisResult = await performEnhancedAnalysisWithVision(payment);
    
    console.log('🧠 Analysis result:', analysisResult);

    // Determine final status
    let finalStatus = 'pending';
    let reviewNotes = '';

    if (analysisResult.paymentValid && analysisResult.confidence >= 0.8) {
      finalStatus = 'approved';
      reviewNotes = `✅ AUTOMATED APPROVAL - High confidence validation (${Math.round(analysisResult.confidence * 100)}%)${analysisResult.visionAnalysis ? ' with Vision AI verification' : ''}`;
      
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
      autoProcessed: finalStatus !== 'pending',
      visionUsed: !!analysisResult.visionAnalysis
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
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      paymentId: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performEnhancedAnalysisWithVision(payment: any): Promise<PaymentAnalysisResult> {
  const issues: string[] = [];
  let confidence = 1.0;
  let visionAnalysis = null;
  
  // 1. VISION AI ANALYSIS (NEW FEATURE)
  if (payment.screenshot_url && OPENAI_API_KEY) {
    console.log('🔍 VISION AI: Analyzing screenshot with OpenAI Vision API');
    try {
      visionAnalysis = await analyzeScreenshotWithVision(payment.screenshot_url, payment.amount, payment.plan_type);
      
      if (visionAnalysis.success) {
        console.log('✅ VISION AI: Analysis successful', visionAnalysis.findings);
        
        // Adjust confidence based on vision analysis
        if (visionAnalysis.confidence_score >= 0.8) {
          confidence *= 1.2; // Boost confidence for good vision analysis
        } else if (visionAnalysis.confidence_score < 0.3) {
          confidence *= 0.3; // Reduce confidence for poor vision analysis
          issues.push('Vision AI detected suspicious screenshot content');
        }
        
        // Check for specific vision findings
        if (visionAnalysis.findings?.amount_mismatch) {
          issues.push('Vision AI detected amount mismatch in screenshot');
          confidence *= 0.2;
        }
        
        if (visionAnalysis.findings?.tampered_detected) {
          issues.push('Vision AI detected potential tampering');
          confidence *= 0.1;
        }
      } else {
        console.warn('⚠️ VISION AI: Analysis failed, falling back to basic validation');
        issues.push('Vision AI analysis failed');
        confidence *= 0.8; // Slight penalty for failed vision analysis
      }
    } catch (visionError) {
      console.error('❌ VISION AI: Error during analysis:', visionError);
      issues.push('Vision AI processing error');
      confidence *= 0.8;
    }
  } else if (!OPENAI_API_KEY) {
    console.warn('⚠️ VISION AI: OpenAI API key not configured, skipping Vision analysis');
  }
  
  // 2. BASIC VALIDATION (existing logic)
  if (!payment.screenshot_url) {
    issues.push('No screenshot provided');
    confidence *= 0.1;
  }
  
  if (!payment.sender_alias) {
    issues.push('No sender alias provided');
    confidence *= 0.7;
  }
  
  // 3. TIME VALIDATION - Check if payment was submitted within reasonable time
  const submittedAt = new Date(payment.submitted_at);
  const now = new Date();
  const timeDiff = now.getTime() - submittedAt.getTime();
  const hoursAgo = timeDiff / (1000 * 60 * 60);
  
  const timeValidationPassed = hoursAgo <= 24; // Allow up to 24 hours
  if (!timeValidationPassed) {
    issues.push('Payment too old');
    confidence *= 0.3;
  }
  
  // 4. AMOUNT VALIDATION
  const expectedAmount = payment.plan_type === 'monthly' ? 60 : 600;
  const amountValid = payment.amount === expectedAmount;
  if (!amountValid) {
    issues.push(`Amount mismatch - Expected ${expectedAmount}, got ${payment.amount}`);
    confidence *= 0.2;
  }
  
  // 5. DUPLICATE DETECTION - Enhanced check
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
    
    duplicateDetected = Boolean(duplicates && duplicates.length > 0);
    if (duplicateDetected) {
      issues.push('Duplicate payment detected');
      confidence *= 0.1;
    }
  } catch (dupError) {
    console.warn('⚠️ Duplicate check failed:', dupError);
  }
  
  // 6. TAMPERING DETECTION - Basic checks
  let tamperingDetected = false;
  
  // Check for suspicious patterns in screenshot URL
  if (payment.screenshot_url && payment.screenshot_url.includes('localhost')) {
    tamperingDetected = true;
    issues.push('Suspicious screenshot source');
    confidence *= 0.1;
  }
  
  // Add vision-based tampering detection
  if (visionAnalysis && visionAnalysis.findings && visionAnalysis.findings.tampered_detected) {
    tamperingDetected = true;
  }
  
  // 7. SENDER ALIAS VALIDATION
  if (payment.sender_alias) {
    // Basic format validation for Qatar banking aliases
    const aliasPattern = /^[a-zA-Z0-9]{3,20}$/;
    if (!aliasPattern.test(payment.sender_alias)) {
      issues.push('Invalid sender alias format');
      confidence *= 0.6;
    }
  }
  
  // 8. CONFIDENCE CALCULATION
  const baseConfidence = 0.8; // Start with high confidence
  const finalConfidence = Math.max(0, Math.min(1, confidence * baseConfidence));
  
  // 9. PAYMENT VALIDITY DETERMINATION
  const paymentValid = finalConfidence >= 0.3 && !tamperingDetected && amountValid;
  
  console.log('🔍 Enhanced analysis details:', {
    timeValidationPassed,
    amountValid,
    duplicateDetected,
    tamperingDetected,
    confidence: finalConfidence,
    issues: issues.length,
    paymentValid,
    visionAnalysisUsed: !!visionAnalysis
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
    issues,
    visionAnalysis // Include vision analysis results
  };
}

// NEW FUNCTION: Vision AI screenshot analysis
async function analyzeScreenshotWithVision(screenshotUrl: string, expectedAmount: number, planType: string) {
  try {
    console.log('🔍 VISION AI: Analyzing screenshot:', screenshotUrl);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Vision-capable model
        messages: [
          {
            role: 'system',
            content: `You are a payment screenshot analyzer for Fawran payment system in Qatar. 
            Expected payment amount: ${expectedAmount} QAR for ${planType} plan.
            Analyze the screenshot for:
            1. Payment amount verification
            2. Sender information
            3. Transaction timestamp
            4. Signs of tampering or editing
            5. Overall authenticity
            
            Respond with JSON format:
            {
              "amount_found": number or null,
              "amount_matches": boolean,
              "sender_info": "string or null",
              "timestamp_visible": boolean,
              "tampered_detected": boolean,
              "authenticity_score": 0.0-1.0,
              "confidence_score": 0.0-1.0,
              "details": "analysis details"
            }`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this Fawran payment screenshot. Expected amount: ${expectedAmount} QAR`
              },
              {
                type: 'image_url',
                image_url: {
                  url: screenshotUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for consistent analysis
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
    console.log('🔍 VISION AI: Raw analysis:', analysisText);
    
    // Try to parse JSON response
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.warn('⚠️ VISION AI: Failed to parse JSON, using fallback');
      parsedAnalysis = {
        amount_found: null,
        amount_matches: false,
        sender_info: null,
        timestamp_visible: false,
        tampered_detected: false,
        authenticity_score: 0.5,
        confidence_score: 0.3,
        details: analysisText
      };
    }
    
    return {
      success: true,
      findings: {
        amount_found: parsedAnalysis.amount_found,
        amount_mismatch: !parsedAnalysis.amount_matches,
        sender_info: parsedAnalysis.sender_info,
        timestamp_visible: parsedAnalysis.timestamp_visible,
        tampered_detected: parsedAnalysis.tampered_detected,
        authenticity_score: parsedAnalysis.authenticity_score || 0.5
      },
      confidence_score: parsedAnalysis.confidence_score || 0.5,
      raw_analysis: analysisText
    };
    
  } catch (error) {
    console.error('❌ VISION AI: Analysis failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Vision analysis failed';
    return {
      success: false,
      error: errorMessage,
      confidence_score: 0
    };
  }
}
