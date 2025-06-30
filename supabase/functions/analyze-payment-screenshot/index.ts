
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced GPT-4 Vision System Prompt for Maximum Security
const ENHANCED_VISION_PROMPT = `You are an expert in verifying Fawran payment screenshots from Qatar banks.

Extract and validate these fields:

1. Transfer type: must contain "Fawran" or "فوران" (instant transfer).
2. Payment amount: must match expected value exactly.
3. Beneficiary alias: must be "alfadlyqtr".
4. Beneficiary name: must be "ABDULLAH HASSOUN" or Arabic equivalent.
5. Transfer timestamp: must be within 90 minutes of the user's account creation.
6. Sender alias: extract user's mobile number or alias.
7. Payment reference number: extract and verify uniqueness.
8. Transaction reference number: extract and verify uniqueness.
9. Transfer status: must be completed/successful.
10. Detect image tampering or editing signs, e.g., Photoshop use or cut-and-paste anomalies.

Respond ONLY with strict JSON containing:

{
  "transferType": string,
  "extractedAmount": number,
  "amountMatches": boolean,
  "beneficiaryAlias": string,
  "aliasMatches": boolean,
  "beneficiaryName": string,
  "nameMatches": boolean,
  "senderAlias": string,
  "timestamp": string,
  "isWithinTimeLimit": boolean,
  "paymentReferenceNumber": string,
  "transactionReferenceNumber": string,
  "transferStatus": string,
  "isCompleted": boolean,
  "tamperingDetected": boolean,
  "tamperingReasons": string[],
  "confidence": number,
  "recommendation": "approve" | "reject" | "manual_review",
  "extractedText": string
}`;

// Enhanced validation logic with ironclad security checks
const runSecurityValidations = async (supabase: any, payment: any, analysis: any) => {
  const validations = {
    amountValid: false,
    aliasValid: false,
    nameValid: false,
    transferTypeValid: false,
    timeValid: false,
    statusValid: false,
    tamperingValid: false,
    referencesUnique: false,
    hashUnique: false,
    highConfidence: false
  };

  // Basic field validations
  validations.amountValid = analysis.amountMatches && analysis.extractedAmount === payment.amount;
  validations.aliasValid = analysis.aliasMatches && analysis.beneficiaryAlias?.toLowerCase() === 'alfadlyqtr';
  validations.nameValid = analysis.nameMatches && 
    analysis.beneficiaryName?.toLowerCase().includes('abdullah') && 
    analysis.beneficiaryName?.toLowerCase().includes('hassoun');
  validations.transferTypeValid = analysis.transferType?.toLowerCase().includes('fawran') || 
    analysis.transferType?.includes('فوران');
  validations.statusValid = analysis.isCompleted;
  validations.highConfidence = analysis.confidence > 85;
  validations.tamperingValid = !analysis.tamperingDetected;

  // Enhanced time validation using account creation time
  if (payment.account_created_at && analysis.timestamp) {
    const accountCreatedAt = new Date(payment.account_created_at);
    const ninetyMinutesLater = new Date(accountCreatedAt.getTime() + 90 * 60 * 1000);
    const now = new Date();
    
    // Screenshot must be from after account creation but within 90 minutes
    validations.timeValid = analysis.isWithinTimeLimit && now <= ninetyMinutesLater;
  }

  // Check reference number uniqueness
  if (analysis.paymentReferenceNumber || analysis.transactionReferenceNumber) {
    const { data: existingRefs } = await supabase
      .from('used_reference_numbers')
      .select('reference_number, transaction_reference')
      .or(`reference_number.eq.${analysis.paymentReferenceNumber},transaction_reference.eq.${analysis.transactionReferenceNumber}`);

    validations.referencesUnique = !existingRefs || existingRefs.length === 0;
  }

  // Check screenshot hash uniqueness (already checked in upload, but double-check)
  if (payment.screenshot_hash) {
    const { data: existingHash } = await supabase
      .from('screenshot_hashes')
      .select('id')
      .eq('image_hash', payment.screenshot_hash)
      .neq('payment_id', payment.id);

    validations.hashUnique = !existingHash || existingHash.length === 0;
  }

  return validations;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { paymentId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔒 Enhanced GPT-4 Vision Fawran Worker Started - Processing Payment:', paymentId);

    // Get payment submission with enhanced fields
    const { data: payment, error: paymentError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment submission not found');
    }

    console.log('💳 Payment Record:', {
      id: payment.id,
      amount: payment.amount,
      plan_type: payment.plan_type,
      screenshot_hash: payment.screenshot_hash?.substring(0, 16) + '...',
      account_created_at: payment.account_created_at
    });

    // Send initial processing notification
    await supabase.rpc('queue_notification', {
      p_user_id: payment.user_id,
      p_notification_type: 'payment_processing',
      p_title: '🔒 Enhanced Security Processing',
      p_body: 'Your Fawran payment is being analyzed with our enhanced GPT-4 Vision security system...',
      p_data: { payment_id: paymentId, security_level: 'maximum' },
      p_deep_link: '/settings',
      p_scheduled_for: new Date().toISOString()
    });

    // Download and process screenshot
    const screenshotPath = payment.screenshot_url.split('/').pop()!;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('fawran-screenshots')
      .download(screenshotPath);

    if (downloadError) {
      throw new Error('Failed to download screenshot');
    }

    // Convert to high-fidelity base64 for Vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('🖼️ Image processed for Vision API:', {
      size: arrayBuffer.byteLength,
      hash: payment.screenshot_hash?.substring(0, 16) + '...'
    });

    // Enhanced GPT-4o Vision API call with maximum security
    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ENHANCED_VISION_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0, // Deterministic output
      }),
    });

    const aiResponse = await visionResponse.json();
    const analysisText = aiResponse.choices[0].message.content;
    
    console.log('🤖 GPT-4o Vision Raw Response:', analysisText.substring(0, 200) + '...');

    let analysis;
    try {
      // Clean and parse JSON response
      const cleanJson = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      analysis = {
        transferType: null,
        extractedAmount: null,
        amountMatches: false,
        beneficiaryAlias: null,
        aliasMatches: false,
        beneficiaryName: null,
        nameMatches: false,
        senderAlias: null,
        timestamp: null,
        isWithinTimeLimit: false,
        paymentReferenceNumber: null,
        transactionReferenceNumber: null,
        transferStatus: null,
        isCompleted: false,
        tamperingDetected: true,
        tamperingReasons: ['Failed to parse Vision response - potential security issue'],
        confidence: 0,
        recommendation: 'manual_review',
        extractedText: analysisText
      };
    }

    console.log('🔍 Vision Analysis Results:', {
      confidence: analysis.confidence,
      tamperingDetected: analysis.tamperingDetected,
      recommendation: analysis.recommendation,
      amountMatches: analysis.amountMatches,
      aliasMatches: analysis.aliasMatches
    });

    // Run comprehensive security validations
    const validations = await runSecurityValidations(supabase, payment, analysis);
    
    console.log('🛡️ Security Validations:', validations);

    // Determine final decision with ironclad logic
    const allSecurityChecksPassed = Object.values(validations).every(Boolean);
    const shouldAutoApprove = allSecurityChecksPassed && 
      analysis.recommendation === 'approve' && 
      !analysis.tamperingDetected &&
      analysis.confidence > 85;

    console.log('⚖️ Final Decision Logic:', {
      allSecurityChecksPassed,
      shouldAutoApprove,
      confidence: analysis.confidence,
      tampering: analysis.tamperingDetected
    });

    // Store reference numbers if unique and valid
    if (validations.referencesUnique && (analysis.paymentReferenceNumber || analysis.transactionReferenceNumber)) {
      await supabase
        .from('used_reference_numbers')
        .insert({
          reference_number: analysis.paymentReferenceNumber,
          transaction_reference: analysis.transactionReferenceNumber,
          used_by: payment.user_id,
          payment_id: payment.id
        });
    }

    // Update payment with comprehensive analysis results
    const updateData = {
      status: shouldAutoApprove ? 'approved' : 'pending',
      review_notes: JSON.stringify({
        ai_analysis: analysis,
        security_validations: validations,
        processing_time_ms: Date.now() - startTime,
        analyzed_at: new Date().toISOString(),
        auto_approved: shouldAutoApprove,
        security_level: 'maximum',
        worker_version: 'enhanced-v2.0'
      }),
      reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
      time_validation_passed: validations.timeValid,
      tampering_detected: analysis.tamperingDetected,
      duplicate_detected: !validations.hashUnique,
      payment_reference_number: analysis.paymentReferenceNumber,
      transaction_reference_number: analysis.transactionReferenceNumber
    };

    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update(updateData)
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    const processingTime = Date.now() - startTime;
    console.log('⏱️ Total Processing Time:', processingTime, 'ms');

    // Handle auto-approval with subscription activation
    if (shouldAutoApprove) {
      console.log('✅ Auto-Approval Granted - Activating Subscription');
      
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      // Activate subscription
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR'
      });

      if (!subscriptionError) {
        await supabase.rpc('queue_notification', {
          p_user_id: payment.user_id,
          p_notification_type: 'subscription_activated',
          p_title: '🎉 Payment Approved & Subscription Activated!',
          p_body: `Your ${planType} subscription has been automatically approved by our enhanced security system. Welcome to Wakti Premium!`,
          p_data: { 
            plan_type: payment.plan_type, 
            amount: payment.amount,
            payment_method: 'fawran',
            security_verified: true,
            processing_time_ms: processingTime
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });
      }
    } else {
      // Queue manual review notification
      console.log('🔍 Sending to Manual Review');
      
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_under_review',
        p_title: '🔍 Payment Under Enhanced Security Review',
        p_body: 'Your payment requires manual verification by our security team. This ensures maximum protection against fraud.',
        p_data: { 
          payment_amount: payment.amount,
          plan_type: payment.plan_type,
          confidence: analysis.confidence,
          security_issues: analysis.tamperingDetected ? analysis.tamperingReasons : [],
          processing_time_ms: processingTime
        },
        p_deep_link: '/settings',
        p_scheduled_for: new Date().toISOString()
      });
    }

    // Trigger notification processing
    setTimeout(async () => {
      try {
        await supabase.functions.invoke('process-notification-queue', { body: {} });
      } catch (error) {
        console.error('Failed to trigger notification processing:', error);
      }
    }, 1000);

    console.log('🔒 Enhanced GPT-4 Vision Fawran Worker Completed Successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis,
      validations,
      auto_approved: shouldAutoApprove,
      processing_time_ms: processingTime,
      security_level: 'maximum',
      worker_version: 'enhanced-v2.0'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('🚨 Enhanced GPT-4 Vision Fawran Worker Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      processing_time_ms: processingTime,
      security_level: 'maximum',
      worker_version: 'enhanced-v2.0'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
