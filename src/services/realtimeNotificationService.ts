
import { supabase } from '@/integrations/supabase/client';

class RealtimeNotificationService {
  private progressierReady = false;
  private currentUserId: string | null = null;
  private subscriptions: any[] = [];

  async init() {
    console.log('🔔 Initializing RealtimeNotificationService');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    this.currentUserId = user.id;
    console.log('👤 User authenticated:', user.id);

    // Wait for Progressier to load
    this.waitForProgressier();
  }

  private waitForProgressier() {
    const checkProgressier = () => {
      if (window.progressier && typeof window.progressier.send === 'function') {
        console.log('✅ Progressier is ready');
        this.progressierReady = true;
        this.setupRealTimeSubscriptions();
      } else {
        console.log('⏳ Waiting for Progressier...');
        setTimeout(checkProgressier, 100);
      }
    };
    checkProgressier();
  }

  private setupRealTimeSubscriptions() {
    if (!this.currentUserId) return;

    console.log('🔌 Setting up real-time subscriptions');

    // Listen for new messages
    const messageChannel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${this.currentUserId}`
      }, this.handleNewMessage.bind(this))
      .subscribe();

    // Listen for contact requests
    const contactChannel = supabase
      .channel('realtime-contacts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contacts',
        filter: `contact_id=eq.${this.currentUserId}`
      }, this.handleContactRequest.bind(this))
      .subscribe();

    this.subscriptions.push(messageChannel, contactChannel);
    console.log('📡 Real-time subscriptions established');
  }

  private async handleNewMessage(payload: any) {
    console.log('📨 New message received:', payload);
    
    if (!this.progressierReady || !window.progressier) {
      console.log('❌ Progressier not ready');
      return;
    }

    try {
      // Get sender info
      const { data: sender } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', payload.new.sender_id)
        .single();

      const senderName = sender?.display_name || sender?.username || 'Someone';
      
      console.log('🔔 Sending message notification via Progressier');
      
      // Send notification via Progressier
      await window.progressier.send({
        title: 'New Message',
        body: `${senderName} sent you a message`,
        url: '/contacts',
        icon: '/favicon.ico'
      });

      console.log('✅ Message notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending message notification:', error);
    }
  }

  private async handleContactRequest(payload: any) {
    console.log('🤝 New contact request received:', payload);
    
    if (!this.progressierReady || !window.progressier) {
      console.log('❌ Progressier not ready');
      return;
    }

    // Only notify for pending requests
    if (payload.new.status !== 'pending') return;

    try {
      // Get requester info
      const { data: requester } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', payload.new.user_id)
        .single();

      const requesterName = requester?.display_name || requester?.username || 'Someone';
      
      console.log('🔔 Sending contact request notification via Progressier');
      
      // Send notification via Progressier
      await window.progressier.send({
        title: 'New Contact Request',
        body: `${requesterName} wants to connect with you`,
        url: '/contacts',
        icon: '/favicon.ico'
      });

      console.log('✅ Contact request notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending contact request notification:', error);
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up RealtimeNotificationService');
    this.subscriptions.forEach(subscription => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions = [];
    this.progressierReady = false;
    this.currentUserId = null;
  }
}

export const realtimeNotificationService = new RealtimeNotificationService();
