
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
}

interface PayPalPlan {
  id: string;
  product_id: string;
  name: string;
  description: string;
  status: string;
  billing_cycles: Array<{
    frequency: {
      interval_unit: string;
      interval_count: number;
    };
    tenure_type: string;
    sequence: number;
    total_cycles: number;
    pricing_scheme: {
      fixed_price: {
        value: string;
        currency_code: string;
      };
    };
  }>;
  payment_preferences: {
    auto_bill_outstanding: boolean;
    setup_fee_failure_action: string;
    payment_failure_threshold: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      throw new Error('No user found')
    }

    const { action } = await req.json()

    const clientId = 'AZUxooULlaqDWjkPEml7YssHn7o97b9a5KIGg7QoT-0ns7H74Ws81Aeg_Ch0tesWpfD1QUS3lW2egXO'
    const clientSecret = 'EC20j2Ed6sxpKivELoyLZ3NgHoNlHF_pxkjXEtYvCNlnmRomtrkqg4AFIMaFok3PAfJz8dpd8hD7ypP8W'
    const baseUrl = 'https://api-m.sandbox.paypal.com'

    // Get PayPal access token
    const getAccessToken = async (): Promise<string> => {
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials'
      })

      const data: PayPalTokenResponse = await response.json()
      return data.access_token
    }

    const accessToken = await getAccessToken()

    if (action === 'create-subscription-plan') {
      // Create product first
      const productResponse = await fetch(`${baseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: 'Wakti Monthly',
          description: 'All-in-one AI productivity app with smart tasks, reminders, calendar, events, voice chat, image tools, translator, and AI search.',
          type: 'SERVICE',
          category: 'SOFTWARE'
        })
      })

      const product: PayPalProduct = await productResponse.json()

      // Create subscription plan
      const planResponse = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          product_id: product.id,
          name: 'Wakti Monthly Subscription',
          description: 'Monthly subscription to Wakti - All-in-one AI productivity app',
          status: 'ACTIVE',
          billing_cycles: [
            {
              frequency: {
                interval_unit: 'MONTH',
                interval_count: 1
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0, // 0 means infinite
              pricing_scheme: {
                fixed_price: {
                  value: '60',
                  currency_code: 'QAR'
                }
              }
            }
          ],
          payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
          }
        })
      })

      const plan: PayPalPlan = await planResponse.json()

      return new Response(
        JSON.stringify({ 
          success: true, 
          productId: product.id,
          planId: plan.id 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (action === 'create-subscription') {
      const { planId } = await req.json()
      
      // Create subscription
      const subscriptionResponse = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          start_time: new Date().toISOString(),
          subscriber: {
            email_address: user.email,
          },
          application_context: {
            brand_name: 'Wakti',
            locale: 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            payment_method: {
              payer_selected: 'PAYPAL',
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
            },
            return_url: `${req.headers.get('origin')}/account?subscription=success`,
            cancel_url: `${req.headers.get('origin')}/account?subscription=cancelled`
          }
        })
      })

      const subscription = await subscriptionResponse.json()

      return new Response(
        JSON.stringify({ 
          success: true, 
          subscriptionId: subscription.id,
          approvalUrl: subscription.links.find((link: any) => link.rel === 'approve')?.href
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    if (action === 'complete-subscription') {
      const { subscriptionId } = await req.json()
      
      // Get subscription details from PayPal
      const subscriptionResponse = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      })

      const subscription = await subscriptionResponse.json()

      if (subscription.status === 'ACTIVE') {
        const startDate = new Date(subscription.start_time)
        const nextBillingDate = new Date(subscription.billing_info.next_billing_time)

        // Update user profile
        await supabaseClient
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_status: 'active',
            plan_name: 'Wakti Monthly',
            billing_start_date: startDate.toISOString(),
            next_billing_date: nextBillingDate.toISOString(),
            paypal_subscription_id: subscriptionId
          })
          .eq('id', user.id)

        // Create subscription record
        await supabaseClient
          .from('subscriptions')
          .insert({
            user_id: user.id,
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: subscription.plan_id,
            status: 'active',
            plan_name: 'Wakti Monthly',
            billing_amount: 60.00,
            billing_currency: 'QAR',
            billing_cycle: 'monthly',
            start_date: startDate.toISOString(),
            next_billing_date: nextBillingDate.toISOString()
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Subscription activated successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      throw new Error('Subscription not active')
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('PayPal subscription error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
