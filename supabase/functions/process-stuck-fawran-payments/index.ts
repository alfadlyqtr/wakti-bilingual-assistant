
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
    console.log('🔄 PROCESSING STUCK FAWRAN PAYMENTS - CRON JOB STARTED');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find payments that are stuck (pending for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const { data: stuckPayments, error: queryError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('status', 'pending')
      .lt('submitted_at', fiveMinutesAgo.toISOString())
      .limit(10); // Process max 10 at a time to avoid overload

    if (queryError) {
      throw new Error(`Failed to query stuck payments: ${queryError.message}`);
    }

    if (!stuckPayments || stuckPayments.length === 0) {
      console.log('✅ No stuck payments found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck payments found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔧 Found ${stuckPayments.length} stuck payments to process`);

    let processedCount = 0;
    let successCount = 0;

    for (const payment of stuckPayments) {
      try {
        console.log(`🔄 Processing stuck payment: ${payment.id}`);

        // Attempt to trigger the analyze-payment-screenshot function
        const { data: workerResult, error: workerError } = await supabase.functions.invoke('analyze-payment-screenshot', {
          body: { paymentId: payment.id }
        });

        if (workerError) {
          console.error(`❌ Worker failed for payment ${payment.id}:`, workerError);
          
          // Mark for manual review
          await supabase
            .from('pending_fawran_payments')
            .update({
              review_notes: JSON.stringify({
                auto_retry_failed: true,
                retry_error: workerError.message,
                retried_at: new Date().toISOString(),
                manual_review_required: true
              })
            })
            .eq('id', payment.id);
        } else {
          console.log(`✅ Successfully processed stuck payment: ${payment.id}`);
          successCount++;
        }

        processedCount++;

      } catch (error) {
        console.error(`❌ Error processing payment ${payment.id}:`, error);
        processedCount++;
      }
    }

    console.log(`🎉 STUCK PAYMENTS PROCESSING COMPLETE: ${successCount}/${processedCount} successful`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedCount} stuck payments`,
      processed: processedCount,
      successful: successCount,
      failed: processedCount - successCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 CRITICAL ERROR in stuck payments processor:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
