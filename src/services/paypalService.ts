
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
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'create-subscription-plan' }
    });

    if (error) throw error;
    if (!data.success) throw new Error('Failed to create subscription plan');

    return {
      productId: data.productId,
      planId: data.planId
    };
  }

  static async createSubscription(planId: string): Promise<CreateSubscriptionResponse> {
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'create-subscription', planId }
    });

    if (error) throw error;
    if (!data.success) throw new Error('Failed to create subscription');

    return {
      subscriptionId: data.subscriptionId,
      approvalUrl: data.approvalUrl
    };
  }

  static async completeSubscription(subscriptionId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('paypal-subscription', {
      body: { action: 'complete-subscription', subscriptionId }
    });

    if (error) throw error;
    if (!data.success) throw new Error('Failed to complete subscription');
  }

  static async getUserSubscription() {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date')
      .single();

    if (error) throw error;
    return profile;
  }
}
