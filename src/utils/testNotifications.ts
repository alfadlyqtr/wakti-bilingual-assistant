
import { supabase } from '@/integrations/supabase/client';

export async function testPushNotification(message: string = 'Test notification from Wakti!'): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    console.log('Testing push notification for user:', user.id);

    const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/test-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU`,
      },
      body: JSON.stringify({ 
        userId: user.id, 
        message 
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Test notification sent successfully:', result);
      return true;
    } else {
      console.error('Failed to send test notification:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error testing push notification:', error);
    return false;
  }
}

// Function to manually trigger queue processing
export async function triggerNotificationProcessing(): Promise<boolean> {
  try {
    const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU`,
      },
    });

    const result = await response.json();
    console.log('Notification queue processing result:', result);
    return result.success;
  } catch (error) {
    console.error('Error triggering notification processing:', error);
    return false;
  }
}

// Function to set up the cron job using the new database function
export async function setupNotificationCron(): Promise<boolean> {
  try {
    console.log('Setting up notification cron job using database function...');
    
    const { data, error } = await supabase.rpc('setup_notification_cron_job');
    
    if (error) {
      console.error('❌ Database function error:', error);
      return false;
    }
    
    console.log('Database function result:', data);
    
    if (data?.success) {
      console.log('✅ Notification cron job configured successfully - will run every 30 seconds');
      console.log('📧 Queued notifications will now be processed automatically');
      
      // Trigger an immediate test run
      await triggerNotificationProcessing();
      
      return true;
    } else {
      console.error('❌ Failed to set up cron job:', data?.error);
      return false;
    }
  } catch (error) {
    console.error('Error setting up notification cron:', error);
    return false;
  }
}

// Function to verify cron job status
export async function checkCronStatus(): Promise<void> {
  try {
    console.log('🔍 Checking cron job status...');
    await setupNotificationCron();
  } catch (error) {
    console.error('Error checking cron status:', error);
  }
}
