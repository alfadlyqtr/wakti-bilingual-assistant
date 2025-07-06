
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
    console.log('🔄 PROCESSING STUCK FAWRAN PAYMENTS - ENHANCED RECOVERY STARTED');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find payments that are stuck (pending for more than 3 minutes)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    
    const { data: stuckPayments, error: queryError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('status', 'pending')
      .lt('submitted_at', threeMinutesAgo.toISOString())
      .order('submitted_at', { ascending: true })
      .limit(20); // Process max 20 at a time to avoid overload

    if (queryError) {
      console.error('❌ Query error:', queryError);
      throw new Error(`Failed to query stuck payments: ${queryError.message}`);
    }

    if (!stuckPayments || stuckPayments.length === 0) {
      console.log('✅ No stuck payments found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck payments found',
        processed: 0,
        successful: 0,
        failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔧 Found ${stuckPayments.length} stuck payments to process`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const payment of stuckPayments) {
      try {
        console.log(`🔄 Processing stuck payment: ${payment.id} (${payment.email})`);

        // First, try to trigger the analyze worker
        try {
          const { data: workerResult, error: workerError } = await supabase.functions.invoke('analyze-payment-screenshot', {
            body: { paymentId: payment.id }
          });

          if (!workerError && workerResult?.success) {
            console.log(`✅ Worker succeeded for payment ${payment.id}`);
            successCount++;
            results.push({
              payment_id: payment.id,
              email: payment.email,
              method: 'worker_retry',
              success: true
            });
          } else {
            throw new Error('Worker failed or returned error');
          }
        } catch (workerError) {
          console.log(`⚠️ Worker failed for payment ${payment.id}, attempting manual processing...`);
          
          // If worker fails, try manual processing
          try {
            // Update payment status to approved
            const { error: updateError } = await supabase
              .from('pending_fawran_payments')
              .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                review_notes: JSON.stringify({
                  auto_processed_stuck: true,
                  worker_failed: true,
                  recovery_method: 'emergency_approval',
                  processed_at: new Date().toISOString(),
                  original_submit_time: payment.submitted_at,
                  stuck_duration_minutes: Math.floor((Date.now() - new Date(payment.submitted_at).getTime()) / 60000)
                })
              })
              .eq('id', payment.id);

            if (updateError) throw updateError;

            // Activate subscription
            const success = await supabase.rpc('admin_activate_subscription', {
              p_user_id: payment.user_id,
              p_plan_name: payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan',
              p_billing_amount: payment.amount,
              p_billing_currency: 'QAR',
              p_payment_method: 'fawran',
              p_fawran_payment_id: payment.id
            });

            if (success) {
              // Queue success notification
              await supabase.rpc('queue_notification', {
                p_user_id: payment.user_id,
                p_notification_type: 'subscription_activated',
                p_title: '🎉 Payment Processed - Subscription Active!',
                p_body: 'Your Fawran payment has been processed and your subscription is now active. Welcome to Wakti Premium!',
                p_data: {
                  payment_amount: payment.amount,
                  plan_type: payment.plan_type,
                  auto_processed: true,
                  recovery_processed: true,
                  payment_id: payment.id
                },
                p_deep_link: '/dashboard',
                p_scheduled_for: new Date().toISOString()
              });

              console.log(`✅ Manual processing succeeded for payment ${payment.id}`);
              successCount++;
              results.push({
                payment_id: payment.id,
                email: payment.email,
                method: 'emergency_approval',
                success: true
              });
            } else {
              throw new Error('Subscription activation failed');
            }
          } catch (manualError) {
            console.error(`❌ Manual processing failed for payment ${payment.id}:`, manualError);
            failedCount++;
            results.push({
              payment_id: payment.id,
              email: payment.email,
              method: 'manual_failed',
              success: false,
              error: manualError.message
            });
          }
        }

        processedCount++;

      } catch (error) {
        console.error(`❌ Error processing payment ${payment.id}:`, error);
        failedCount++;
        results.push({
          payment_id: payment.id,
          email: payment.email,
          method: 'error',
          success: false,
          error: error.message
        });
        processedCount++;
      }
    }

    console.log(`🎉 STUCK PAYMENTS PROCESSING COMPLETE: ${successCount}/${processedCount} successful`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedCount} stuck payments`,
      processed: processedCount,
      successful: successCount,
      failed: failedCount,
      results: results,
      processed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 CRITICAL ERROR in stuck payments processor:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      processed: 0,
      successful: 0,
      failed: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
