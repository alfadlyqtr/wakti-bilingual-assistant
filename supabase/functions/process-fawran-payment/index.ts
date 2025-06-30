
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
    const { paymentId, action, adminNotes } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    // Update payment status
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: action, // 'approved' or 'rejected'
        review_notes: adminNotes || payment.review_notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    // If approved, activate subscription
    if (action === 'approved') {
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR'
      });

      if (subscriptionError) {
        throw new Error('Failed to activate subscription');
      }

      // Send notification to user
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'subscription_activated',
        p_title: 'Subscription Activated',
        p_body: `Your ${planType} subscription has been activated. Welcome to Wakti Premium!`,
        p_data: { plan_type: payment.plan_type, amount: payment.amount }
      });
    } else if (action === 'rejected') {
      // Send rejection notification
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_rejected',
        p_title: 'Payment Verification Failed',
        p_body: 'Your payment could not be verified. Please contact support or try again.',
        p_data: { reason: adminNotes || 'Payment verification failed' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Payment ${action} successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-fawran-payment:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
