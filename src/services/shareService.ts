
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class ShareService {
  static generateEventLink(shortId: string): string {
    return `https://wakti.qa/maw3d/${shortId}`;
  }

  static async shareEvent(eventId: string, shortId: string) {
    console.log('ShareService.shareEvent called with:', { eventId, shortId });
    
    try {
      const link = this.generateEventLink(shortId);
      console.log('Generated link:', link);
      
      // Check if we can use the native share API
      if (navigator.share) {
        console.log('Using navigator.share');
        const shareData = {
          title: 'WAKTI Event',
          text: 'Check out this event!',
          url: link,
        };
        
        // Check if the data can be shared before attempting to share
        if (navigator.canShare && !navigator.canShare(shareData)) {
          console.log('Data cannot be shared, falling back to clipboard');
          throw new Error('Data cannot be shared');
        }
        
        await navigator.share(shareData);
        console.log('Share successful');
      } else {
        console.log('navigator.share not available, using clipboard');
        throw new Error('Navigator share not available');
      }
    } catch (error) {
      console.error('Error in native share:', error);
      
      // Fallback to clipboard
      try {
        const link = this.generateEventLink(shortId);
        console.log('Attempting clipboard copy with link:', link);
        
        if (!navigator.clipboard) {
          console.error('Clipboard API not available');
          toast.error('Share feature not supported on this device');
          return;
        }
        
        await navigator.clipboard.writeText(link);
        console.log('Clipboard copy successful');
        toast.success('Event link copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        toast.error('Failed to copy link. Please try again.');
      }
    }
  }
}
