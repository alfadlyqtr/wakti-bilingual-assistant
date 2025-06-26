
import { supabase } from "@/integrations/supabase/client";

export class ShareService {
  // Share Maw3d event - Fixed to use correct URL format
  static async shareEvent(eventId: string, shortId: string): Promise<void> {
    console.log('=== ShareService.shareEvent START ===');
    console.log('Called with eventId:', eventId, 'shortId:', shortId);
    
    try {
      // Generate the correct Maw3d event URL using the /maw3d/:id route
      const eventUrl = `${window.location.origin}/maw3d/${shortId}`;
      console.log('Generated Maw3d event link:', eventUrl);
      
      const shareData = {
        title: 'WAKTI Event',
        text: 'Check out this event!',
        url: eventUrl
      };
      
      console.log('Generated link for sharing:', eventUrl);
      
      // Check if Web Share API is available
      console.log('Checking navigator.share availability:', !!navigator.share);
      console.log('Checking navigator.canShare availability:', !!navigator.canShare);
      
      if (navigator.share) {
        console.log('Using navigator.share');
        console.log('Share data prepared:', shareData);
        
        if (navigator.canShare && !navigator.canShare(shareData)) {
          console.log('Data cannot be shared, falling back to clipboard');
          throw new Error('Data cannot be shared');
        }
        
        console.log('Can share this data:', navigator.canShare ? navigator.canShare(shareData) : 'canShare not supported');
        
        await navigator.share(shareData);
        console.log('Native share completed successfully');
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (error) {
      console.error('Error in native share:', error);
      console.log('Falling back to clipboard...');
      
      // Fallback to clipboard
      try {
        const eventUrl = `${window.location.origin}/maw3d/${shortId}`;
        console.log('Generated Maw3d event link:', eventUrl);
        console.log('Attempting clipboard copy with link:', eventUrl);
        
        console.log('Writing to clipboard...');
        await navigator.clipboard.writeText(eventUrl);
        console.log('Clipboard copy successful');
        
        // Show success message
        if ('toast' in window) {
          (window as any).toast?.success?.('Link copied to clipboard!');
        }
      } catch (clipboardError) {
        console.error('Clipboard fallback failed:', clipboardError);
        throw new Error('Failed to share event link');
      }
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
