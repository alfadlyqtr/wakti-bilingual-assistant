
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get payment submission
    const { data: payment, error: paymentError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment submission not found');
    }

    // Send initial submission confirmation
    await supabase.rpc('queue_notification', {
      p_user_id: payment.user_id,
      p_notification_type: 'payment_submitted',
      p_title: '📋 Payment Submitted for Review',
      p_body: 'Your Fawran payment screenshot has been submitted and is being reviewed. You will be notified once approved.',
      p_data: { 
        payment_amount: payment.amount,
        plan_type: payment.plan_type,
        payment_method: 'fawran'
      },
      p_deep_link: '/settings',
      p_scheduled_for: new Date().toISOString()
    });

    // Download screenshot from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('fawran-screenshots')
      .download(payment.screenshot_url.split('/').pop()!);

    if (downloadError) {
      throw new Error('Failed to download screenshot');
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Enhanced GPT-4 Vision analysis prompt for Fawran validation
    const analysisPrompt = `You are a Fawran payment verification expert. Analyze this Qatar bank transfer screenshot and extract the following information with high accuracy:

REQUIRED VALIDATIONS:
1. Transfer Type: Must contain "Fawran" or "فوران" (instant transfer)
2. Payment Amount: Must be exactly ${payment.amount} QAR (${payment.amount} ريال قطري)
3. Beneficiary Alias: Must be exactly "alfadlyqtr"
4. Beneficiary Name: Must be "ABDULLAH HASSOUN" or "عبدالله حسون" (any case variation)
5. Timestamp: Must be within the last 90 minutes (1.5 hours)
6. Sender Information: Extract sender alias/name or mobile number
7. Reference Numbers: Extract all reference and transaction numbers
8. Transfer Status: Must show "Completed" or "تم" or "منجز" or similar success status

CRITICAL CHECKS:
- The transfer must be FROM a Qatar bank TO alfadlyqtr
- The amount must match exactly (not approximate)
- The transfer must be recent (within 90 minutes)
- The recipient must be ABDULLAH HASSOUN only
- Must be a Fawran (instant) transfer, not regular transfer

Respond in JSON format:
{
  "isValid": boolean,
  "transferType": "string (Fawran/فوران found)",
  "extractedAmount": number,
  "amountMatches": boolean,
  "beneficiaryAlias": "string",
  "aliasMatches": boolean,
  "beneficiaryName": "string", 
  "nameMatches": boolean,
  "senderInfo": "string (alias or mobile)",
  "timestamp": "string",
  "isWithinTimeLimit": boolean,
  "referenceNumber": "string",
  "transactionId": "string",
  "transferStatus": "string",
  "isCompleted": boolean,
  "confidence": number (0-100),
  "issues": ["array of any problems found"],
  "recommendation": "approve|reject|manual_review",
  "extractedText": "string (all visible text for manual review)"
}

Be extremely strict with validation. If ANY required field is missing, unclear, or doesn't match exactly, recommend manual review or rejection.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
      }),
    });

    const aiData = await response.json();
    const analysisText = aiData.choices[0].message.content;
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = {
        isValid: false,
        transferType: null,
        extractedAmount: null,
        amountMatches: false,
        beneficiaryAlias: null,
        aliasMatches: false,
        beneficiaryName: null,
        nameMatches: false,
        senderInfo: null,
        timestamp: null,
        isWithinTimeLimit: false,
        referenceNumber: null,
        transactionId: null,
        transferStatus: null,
        isCompleted: false,
        confidence: 0,
        issues: ['Failed to parse AI analysis'],
        recommendation: 'manual_review',
        extractedText: analysisText
      };
    }

    // Strict validation logic
    const validations = {
      amountValid: analysis.amountMatches && analysis.extractedAmount === payment.amount,
      aliasValid: analysis.aliasMatches && analysis.beneficiaryAlias?.toLowerCase() === 'alfadlyqtr',
      nameValid: analysis.nameMatches && analysis.beneficiaryName?.toLowerCase().includes('abdullah') && analysis.beneficiaryName?.toLowerCase().includes('hassoun'),
      transferTypeValid: analysis.transferType?.toLowerCase().includes('fawran') || analysis.transferType?.includes('فوران'),
      timeValid: analysis.isWithinTimeLimit,
      statusValid: analysis.isCompleted,
      highConfidence: analysis.confidence > 85
    };

    const allValidationsPassed = Object.values(validations).every(Boolean);
    const shouldAutoApprove = allValidationsPassed && analysis.recommendation === 'approve';

    // Update payment with detailed analysis
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: shouldAutoApprove ? 'approved' : 'pending',
        review_notes: JSON.stringify({
          ai_analysis: analysis,
          validations: validations,
          analyzed_at: new Date().toISOString(),
          auto_approved: shouldAutoApprove,
          payment_details: {
            expected_amount: payment.amount,
            expected_alias: 'alfadlyqtr',
            expected_beneficiary: 'ABDULLAH HASSOUN'
          }
        }),
        reviewed_at: shouldAutoApprove ? new Date().toISOString() : null
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    // If auto-approved, activate subscription and notify user
    if (shouldAutoApprove) {
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      // Activate subscription
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR'
      });

      if (!subscriptionError) {
        // Queue success notification
        await supabase.rpc('queue_notification', {
          p_user_id: payment.user_id,
          p_notification_type: 'subscription_activated',
          p_title: '🎉 Payment Approved & Subscription Activated!',
          p_body: `Your ${planType} subscription has been automatically approved and activated. Welcome to Wakti Premium!`,
          p_data: { 
            plan_type: payment.plan_type, 
            amount: payment.amount,
            payment_method: 'fawran',
            auto_approved: true
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });
      }
    } else {
      // Queue manual review notification
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_under_review',
        p_title: '👀 Payment Under Manual Review',
        p_body: 'Your payment is being manually reviewed by our team. This usually takes 1-2 business days.',
        p_data: { 
          payment_amount: payment.amount,
          plan_type: payment.plan_type,
          confidence: analysis.confidence,
          issues: analysis.issues
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

    return new Response(JSON.stringify({
      success: true,
      analysis,
      validations,
      auto_approved: shouldAutoApprove,
      notification_sent: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-payment-screenshot:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
