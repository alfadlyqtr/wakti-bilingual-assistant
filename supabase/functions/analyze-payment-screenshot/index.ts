
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

    // Analyze with GPT-4 Vision
    const analysisPrompt = `Analyze this Fawran payment screenshot and extract the following information:

1. Payment amount (should be ${payment.amount} QAR)
2. Recipient (should be "alfadlyqtr" or "Abdullah Hassoun" or similar)
3. Payment method confirmation (should show Fawran)
4. Transaction status (should be completed/successful)
5. Any suspicious elements or red flags

Respond in JSON format with:
{
  "isValid": boolean,
  "extractedAmount": number or null,
  "extractedRecipient": string or null,
  "isFawranPayment": boolean,
  "transactionStatus": string,
  "confidence": number (0-100),
  "issues": string[],
  "recommendation": "approve" | "reject" | "manual_review"
}`;

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
        max_tokens: 1000,
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
        extractedAmount: null,
        extractedRecipient: null,
        isFawranPayment: false,
        transactionStatus: 'unknown',
        confidence: 0,
        issues: ['Failed to parse AI analysis'],
        recommendation: 'manual_review'
      };
    }

    // Validate analysis results
    const amountMatches = analysis.extractedAmount && 
      Math.abs(analysis.extractedAmount - payment.amount) <= 5;
    
    const recipientValid = analysis.extractedRecipient && 
      (analysis.extractedRecipient.toLowerCase().includes('alfadlyqtr') ||
       analysis.extractedRecipient.toLowerCase().includes('abdullah') ||
       analysis.extractedRecipient.toLowerCase().includes('hassoun'));

    const shouldAutoApprove = analysis.recommendation === 'approve' && 
                              amountMatches && 
                              recipientValid && 
                              analysis.isFawranPayment && 
                              analysis.confidence > 80;

    // Update payment with analysis
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: shouldAutoApprove ? 'approved' : 'pending',
        review_notes: JSON.stringify({
          ai_analysis: analysis,
          amount_matches: amountMatches,
          recipient_valid: recipientValid,
          analyzed_at: new Date().toISOString(),
          auto_approved: shouldAutoApprove
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
      // Queue pending review notification
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_under_review',
        p_title: '👀 Payment Under Manual Review',
        p_body: 'Your payment is being manually reviewed by our team. This usually takes 1-2 business days.',
        p_data: { 
          payment_amount: payment.amount,
          plan_type: payment.plan_type,
          confidence: analysis.confidence
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
