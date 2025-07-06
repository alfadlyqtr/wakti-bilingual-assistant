
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
      console.log('🔥 FORCE TRIGGERING ANALYZE FUNCTION');
      
      try {
        const { data: result, error } = await supabase.functions.invoke('analyze-payment-screenshot', {
          body: { paymentId }
        });

        if (error) {
          console.error('❌ Force analyze failed:', error);
          throw new Error(`Analysis failed: ${error.message}`);
        }

        console.log('✅ Force analyze completed successfully:', result);

        return new Response(JSON.stringify({
          success: true,
          message: 'Analysis triggered successfully',
          result,
          action: 'force_analyze'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Force analyze error:', error);
        throw error;
      }
    }

    if (action === 'approve') {
      console.log('✅ MANUAL APPROVAL PROCESS STARTED');
      
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

      console.log('💳 Processing payment:', {
        id: payment.id,
        email: payment.email,
        amount: payment.amount,
        plan_type: payment.plan_type
      });

      // Update payment status to approved
      const { error: updateError } = await supabase
        .from('pending_fawran_payments')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: JSON.stringify({
            manually_approved: true,
            approved_at: new Date().toISOString(),
            reason: 'Manual admin approval',
            approval_method: 'admin_override'
          })
        })
        .eq('id', paymentId);

      if (updateError) {
        console.error('❌ Payment update failed:', updateError);
        throw new Error(`Failed to update payment: ${updateError.message}`);
      }

      console.log('✅ Payment status updated to approved');

      // Activate subscription
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      console.log('🔄 Activating subscription:', planType);
      
      const { data: subscriptionResult, error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
        p_fawran_payment_id: payment.id
      });

      if (subscriptionError) {
        console.error('❌ Subscription activation failed:', subscriptionError);
        throw new Error(`Failed to activate subscription: ${subscriptionError.message}`);
      }

      console.log('✅ Subscription activated successfully');

      // Send success notification
      try {
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
            manually_approved: true,
            approved_by: 'admin'
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });

        console.log('✅ Success notification queued');
      } catch (notificationError) {
        console.warn('⚠️ Notification failed (non-critical):', notificationError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Payment manually approved and subscription activated',
        payment_id: paymentId,
        plan_type: planType,
        amount: payment.amount,
        action: 'approve',
        subscription_result: subscriptionResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action specified. Use "force_analyze" or "approve".');

  } catch (error) {
    console.error('🚨 Manual processing error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      payment_id: null,
      action: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
