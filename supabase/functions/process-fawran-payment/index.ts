
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

    console.log('Processing Fawran payment action:', { paymentId, action });

    // Get payment details
    const { data: payment, error: paymentError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment not found');
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update({
        status: action,
        reviewed_at: new Date().toISOString(),
        review_notes: adminNotes ? JSON.stringify({
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          action: action,
          admin_processed: true
        }) : null
      })
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    // If approved, activate subscription using the new system without PayPal
    if (action === 'approved') {
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
        p_fawran_payment_id: payment.id
      });

      if (!subscriptionError) {
        // Store reference numbers as used
        if (payment.payment_reference_number || payment.transaction_reference_number) {
          await supabase
            .from('used_reference_numbers')
            .insert({
              reference_number: payment.payment_reference_number,
              transaction_reference: payment.transaction_reference_number,
              used_by: payment.user_id,
              payment_id: payment.id
            });
        }

        // Send approval notification
        await supabase.rpc('queue_notification', {
          p_user_id: payment.user_id,
          p_notification_type: 'subscription_activated',
          p_title: '🎉 Payment Approved by AI!',
          p_body: `Your ${planType} subscription has been automatically approved and activated via Fawran. Welcome to Wakti Premium!`,
          p_data: { 
            plan_type: payment.plan_type, 
            amount: payment.amount,
            payment_method: 'fawran',
            payment_id: payment.id,
            ai_approved: true,
            security_verified: true
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });
      }
    } else if (action === 'rejected') {
      // Send rejection notification
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_rejected',
        p_title: '❌ Payment Rejected',
        p_body: 'Your Fawran payment submission has been rejected by our AI security system. Please contact support if you believe this is an error.',
        p_data: { 
          payment_amount: payment.amount,
          plan_type: payment.plan_type,
          payment_method: 'fawran',
          payment_id: payment.id,
          reason: adminNotes || 'AI security check'
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
      action,
      paymentId,
      payment_method: 'fawran'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing Fawran payment:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
