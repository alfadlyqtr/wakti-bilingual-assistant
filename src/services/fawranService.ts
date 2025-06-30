
import { supabase } from '@/integrations/supabase/client';

export interface FawranPaymentRequest {
  amount: number;
  currency: string;
  planType: 'monthly' | 'yearly';
  planName: string;
  userId: string;
  userEmail: string;
}

export interface FawranPaymentResponse {
  paymentUrl: string;
  transactionId: string;
  status: string;
}

export class FawranService {
  private static readonly BASE_URL = 'https://api.fawran.com/v1';
  private static readonly API_KEY = process.env.FAWRAN_API_KEY;

  static async createPayment(request: FawranPaymentRequest): Promise<FawranPaymentResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          description: `${request.planName} subscription`,
          customer: {
            id: request.userId,
            email: request.userEmail,
          },
          metadata: {
            planType: request.planType,
            planName: request.planName,
            userId: request.userId,
          },
          success_url: `${window.location.origin}/payment-success`,
          cancel_url: `${window.location.origin}/payment-cancelled`,
          webhook_url: `${window.location.origin}/api/fawran/webhook`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Fawran API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fawran payment creation failed:', error);
      throw error;
    }
  }

  static async verifyPayment(transactionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/payments/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const payment = await response.json();
      return payment.status === 'completed';
    } catch (error) {
      console.error('Fawran payment verification failed:', error);
      return false;
    }
  }

  static async activateSubscription(userId: string, planType: 'monthly' | 'yearly', transactionId: string): Promise<boolean> {
    try {
      const planName = planType === 'yearly' ? 'Wakti Pro - Yearly' : 'Wakti Pro - Monthly';
      const amount = planType === 'yearly' ? 550 : 55;
      
      const startDate = new Date();
      const nextBillingDate = new Date();
      if (planType === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_status: 'active',
          plan_name: planName,
          billing_start_date: startDate.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        throw profileError;
      }

      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          paypal_subscription_id: `FAWRAN-${transactionId}`,
          status: 'active',
          plan_name: planName,
          billing_amount: amount,
          billing_currency: 'QAR',
          billing_cycle: planType === 'yearly' ? 'yearly' : 'monthly',
          start_date: startDate.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
        });

      if (subscriptionError) {
        throw subscriptionError;
      }

      return true;
    } catch (error) {
      console.error('Subscription activation failed:', error);
      return false;
    }
  }
}
