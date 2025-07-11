
import { supabase } from "@/integrations/supabase/client";
import { Maw3dEvent } from "@/types/maw3d";
import { format } from 'date-fns';

export class ShareService {
  // Share Maw3d event - Updated to share only clean URL without descriptive text
  static async shareEvent(event: Maw3dEvent): Promise<void> {
    console.log('=== ShareService.shareEvent START ===');
    console.log('Called with event:', event.id, 'shortId:', event.short_id);
    
    try {
      // Generate the correct Maw3d event URL using the /maw3d/:id route
      const eventUrl = `${window.location.origin}/maw3d/${event.short_id}`;
      console.log('Generated Maw3d event link:', eventUrl);
      
      // Clean share data - only title for link preview, no descriptive text
      const shareData = {
        title: event.title, // This will appear in the link preview
        url: eventUrl // Only the clean URL will be shared
        // No 'text' property - this prevents descriptive text from appearing before the link
      };
      
      console.log('Generated clean share data:', shareData);
      
      // Check if Web Share API is available
      console.log('Checking navigator.share availability:', !!navigator.share);
      console.log('Checking navigator.canShare availability:', !!navigator.canShare);
      
      if (navigator.share) {
        console.log('Using navigator.share');
        console.log('Share data prepared:', shareData);
        
        try {
          await navigator.share(shareData);
          console.log('Native share completed successfully');
          return; // Exit if successful
        } catch (shareError) {
          console.log('Native share failed, falling back to clipboard:', shareError);
          // Continue to clipboard fallback
        }
      }
      
      // Fallback to clipboard (always runs if share fails or isn't supported)
      console.log('Falling back to clipboard...');
      await navigator.clipboard.writeText(eventUrl);
      console.log('Clipboard copy successful');
      
      // Show success message
      const { toast } = await import('sonner');
      toast.success('Event link copied to clipboard!');
    } catch (error) {
      console.error('Error in shareEvent:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to share event link');
      throw error;
    }
    
    console.log('=== ShareService.shareEvent END ===');
  }

  // Share T&R task
  static async shareTask(taskId: string, shareLink: string): Promise<void> {
    console.log('=== ShareService.shareTask START ===');
    console.log('Called with taskId:', taskId, 'shareLink:', shareLink);
    
    try {
      const taskUrl = `${window.location.origin}/shared-task/${shareLink}`;
      console.log('Generated task link:', taskUrl);
      
      const shareData = {
        title: 'WAKTI Task',
        text: 'Check out this shared task!',
        url: taskUrl
      };
      
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('Task shared successfully');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(taskUrl);
        if ('toast' in window) {
          (window as any).toast?.success?.('Task link copied to clipboard!');
        }
      }
    } catch (error) {
      console.error('Error sharing task:', error);
      throw error;
    }
    
    console.log('=== ShareService.shareTask END ===');
  }
}
