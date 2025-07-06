
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
    const { paymentId, action } = await req.json();
    
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    console.log(`🔧 MANUAL FAWRAN PROCESSING: ${paymentId} - Action: ${action || 'analyze'}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'force_analyze') {
      // Force trigger the analyze function
      console.log('🔥 FORCE TRIGGERING ANALYZE FUNCTION');
      
      const { data: result, error } = await supabase.functions.invoke('analyze-payment-screenshot', {
        body: { paymentId }
      });

      if (error) {
        throw new Error(`Analysis failed: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Analysis triggered successfully',
        result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve') {
      // Get payment details
      const { data: payment, error: paymentError } = await supabase
        .from('pending_fawran_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        throw new Error('Payment not found');
      }

      // Manually approve and activate subscription
      const { error: updateError } = await supabase
        .from('pending_fawran_payments')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: JSON.stringify({
            manually_approved: true,
            approved_at: new Date().toISOString(),
            reason: 'Manual admin approval'
          })
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Activate subscription
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
        p_fawran_payment_id: payment.id
      });

      if (subscriptionError) throw subscriptionError;

      // Send notification
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'subscription_activated',
        p_title: '🎉 Payment Manually Approved!',
        p_body: `Your ${planType} subscription has been manually approved and activated. Welcome to Wakti Premium!`,
        p_data: { 
          plan_type: payment.plan_type, 
          amount: payment.amount,
          payment_method: 'fawran',
          payment_id: payment.id,
          manually_approved: true
        },
        p_deep_link: '/dashboard',
        p_scheduled_for: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Payment manually approved and subscription activated'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('🚨 Manual processing error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
