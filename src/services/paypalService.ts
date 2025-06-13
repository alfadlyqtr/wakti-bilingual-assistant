
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlan {
  productId: string;
  planId: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  approvalUrl: string;
}

export class PayPalService {
  static async createSubscriptionPlan(): Promise<SubscriptionPlan> {
    console.log('Creating subscription plan...');
    
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'create-subscription-plan' }
    });

    console.log('PayPal service response:', { data, error });

    if (error) {
      console.error('Supabase function error:', error);
      throw error;
    }
    
    if (!data || !data.success) {
      console.error('PayPal service error response:', data);
      throw new Error(data?.error || 'Failed to create subscription plan');
    }

    console.log('Subscription plan created successfully:', data);
    return {
      productId: data.productId,
      planId: data.planId
    };
  }

  static async createSubscription(planId: string): Promise<CreateSubscriptionResponse> {
    console.log('Creating subscription with planId:', planId);
    
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'create-subscription', planId }
    });

    console.log('PayPal subscription response:', { data, error });

    if (error) {
      console.error('Supabase function error:', error);
      throw error;
    }
    
    if (!data || !data.success) {
      console.error('PayPal subscription error response:', data);
      throw new Error(data?.error || 'Failed to create subscription');
    }

    console.log('Subscription created successfully:', data);
    return {
      subscriptionId: data.subscriptionId,
      approvalUrl: data.approvalUrl
    };
  }

  static async completeSubscription(subscriptionId: string): Promise<void> {
    console.log('Completing subscription:', subscriptionId);
    
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'complete-subscription', subscriptionId }
    });

    console.log('PayPal completion response:', { data, error });

    if (error) {
      console.error('Supabase function error:', error);
      throw error;
    }
    
    if (!data || !data.success) {
      console.error('PayPal completion error response:', data);
      throw new Error(data?.error || 'Failed to complete subscription');
    }

    console.log('Subscription completed successfully');
  }

  static async getUserSubscription() {
    console.log('Fetching user subscription...');
    
    // Fix: Use .maybeSingle() instead of .single() to handle cases with multiple or no rows
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date')
      .maybeSingle();

    if (error) {
      console.error('Error fetching user subscription:', error);
      throw error;
    }
    
    // If no profile found, return default values
    if (!profile) {
      console.log('No profile found, returning default subscription data');
      return {
        is_subscribed: false,
        subscription_status: 'inactive',
        plan_name: null,
        billing_start_date: null,
        next_billing_date: null
      };
    }
    
    console.log('User subscription data:', profile);
    return profile;
  }
}
