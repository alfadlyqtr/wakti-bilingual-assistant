
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
    const { userEmail, keepPaymentId, refundPaymentId } = await req.json();
    
    if (!userEmail || !keepPaymentId || !refundPaymentId) {
      throw new Error('Missing required parameters: userEmail, keepPaymentId, refundPaymentId');
    }

    console.log('🔄 RESOLVING DUPLICATE SUBSCRIPTION:', {
      userEmail,
      keepPaymentId,
      refundPaymentId
    });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function to resolve the duplicate
    const { data, error } = await supabase.rpc('resolve_duplicate_subscription', {
      p_user_email: userEmail,
      p_keep_payment_id: keepPaymentId,
      p_refund_payment_id: refundPaymentId
    });

    if (error) {
      console.error('❌ Database function error:', error);
      throw new Error(`Failed to resolve duplicate: ${error.message}`);
    }

    console.log('✅ Duplicate subscription resolved successfully:', data);

    // Send notification to user about the refund
    try {
      await supabase.rpc('queue_notification', {
        p_user_id: data.user_id,
        p_notification_type: 'payment_refunded',
        p_title: '💰 Duplicate Payment Refunded',
        p_body: 'We detected a duplicate payment and have processed a refund for you. Your subscription remains active.',
        p_data: {
          refunded_payment_id: refundPaymentId,
          kept_payment_id: keepPaymentId,
          reason: 'duplicate_payment',
          refund_processed: true
        },
        p_deep_link: '/settings',
        p_scheduled_for: new Date().toISOString()
      });
    } catch (notificationError) {
      console.warn('⚠️ Refund notification failed (non-critical):', notificationError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Duplicate subscription resolved successfully',
      data: data,
      userEmail,
      keepPaymentId,
      refundPaymentId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 Resolve duplicate subscription error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      userEmail: null,
      keepPaymentId: null,
      refundPaymentId: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
