
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
      // Fallback if JSON parsing fails
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
      Math.abs(analysis.extractedAmount - payment.amount) <= 5; // 5 QAR tolerance
    
    const recipientValid = analysis.extractedRecipient && 
      (analysis.extractedRecipient.toLowerCase().includes('alfadlyqtr') ||
       analysis.extractedRecipient.toLowerCase().includes('abdullah') ||
       analysis.extractedRecipient.toLowerCase().includes('hassoun'));

    // Update payment with analysis
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: analysis.recommendation === 'approve' && 
                amountMatches && 
                recipientValid && 
                analysis.isFawranPayment && 
                analysis.confidence > 80 ? 'approved' : 'pending',
        review_notes: JSON.stringify({
          ai_analysis: analysis,
          amount_matches: amountMatches,
          recipient_valid: recipientValid,
          analyzed_at: new Date().toISOString()
        }),
        reviewed_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    // If automatically approved, activate subscription
    if (analysis.recommendation === 'approve' && 
        amountMatches && 
        recipientValid && 
        analysis.isFawranPayment && 
        analysis.confidence > 80) {
      
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      // Activate subscription
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR'
      });

      if (subscriptionError) {
        console.error('Failed to activate subscription:', subscriptionError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      analysis,
      auto_approved: analysis.recommendation === 'approve' && 
                     amountMatches && 
                     recipientValid && 
                     analysis.isFawranPayment && 
                     analysis.confidence > 80
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
