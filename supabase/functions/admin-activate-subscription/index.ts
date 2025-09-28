
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      p_user_id,
      p_plan_name,
      p_billing_amount,
      p_billing_currency,
      p_payment_method,
      p_fawran_payment_id,
      p_is_gift,
      p_gift_duration,
      p_gift_given_by
    } = await req.json()

    // Calculate proper end date for gifts
    let nextBillingDate = new Date()
    
    if (p_is_gift && p_gift_duration) {
      const now = new Date()
      
      switch (p_gift_duration) {
        case '1_week':
          nextBillingDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)) // Exactly 7 days
          break
        case '2_weeks':
          nextBillingDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)) // Exactly 14 days
          break
        case '1_month':
          nextBillingDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)) // Exactly 30 days
          break
        default:
          nextBillingDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)) // Default to 1 week
      }
    } else {
      // Regular subscription - set to next month or year
      if (p_plan_name.includes('Yearly')) {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      }
    }

    const startDate = new Date()

    // Create subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: p_user_id,
        plan_name: p_plan_name,
        billing_amount: p_billing_amount,
        billing_currency: p_billing_currency,
        billing_cycle: p_is_gift ? 'gift' : (p_plan_name.includes('Yearly') ? 'yearly' : 'monthly'),
        payment_method: p_payment_method,
        start_date: startDate.toISOString(),
        next_billing_date: nextBillingDate.toISOString(),
        fawran_payment_id: p_fawran_payment_id,
        is_gift: p_is_gift || false,
        gift_duration: p_gift_duration,
        gift_given_by: p_gift_given_by,
        status: 'active'
      })
      .select()
      .single()

    if (subError) {
      console.error('Subscription creation error:', subError)
      throw subError
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_subscribed: true,
        subscription_status: 'active',
        plan_name: p_plan_name,
        billing_start_date: startDate.toISOString(),
        next_billing_date: nextBillingDate.toISOString(),
        payment_method: p_payment_method,
        fawran_payment_id: p_fawran_payment_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', p_user_id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      throw profileError
    }

    // Log admin activity
    if (p_gift_given_by) {
      await supabase
        .from('admin_activity_logs')
        .insert({
          action: 'gift_subscription_activated',
          target_type: 'user',
          target_id: p_user_id,
          admin_user_id: p_gift_given_by,
          details: {
            user_id: p_user_id,
            gift_duration: p_gift_duration,
            plan_name: p_plan_name,
            start_date: startDate.toISOString(),
            expiry_date: nextBillingDate.toISOString(),
            billing_amount: p_billing_amount
          }
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription_id: subscription.id,
        expiry_date: nextBillingDate.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Admin activate subscription error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to activate subscription';
    return new Response(
      JSON.stringify({ 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
