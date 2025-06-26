
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class ShareService {
  static generateEventLink(eventId: string, shortId?: string): string {
    // If shortId is provided, it's a Maw3d event - use the standalone event URL format
    if (shortId) {
      const link = `https://wakti.qa/event/${shortId}`;
      console.log('Generated Maw3d standalone event link:', link);
      return link;
    }
    
    // Otherwise, use the regular events URL format
    const link = `https://wakti.qa/event/${eventId}`;
    console.log('Generated event link:', link);
    return link;
  }

  static async shareEvent(eventId: string, shortId?: string) {
    console.log('=== ShareService.shareEvent START ===');
    console.log('Called with eventId:', eventId, 'shortId:', shortId);
    
    try {
      // Generate the appropriate link based on whether it's a Maw3d event
      const link = this.generateEventLink(eventId, shortId);
      console.log('Generated link for sharing:', link);
      
      // Check if we can use the native share API
      console.log('Checking navigator.share availability:', !!navigator.share);
      console.log('Checking navigator.canShare availability:', !!navigator.canShare);
      
      if (navigator.share) {
        console.log('Using navigator.share');
        const shareData = {
          title: 'WAKTI Event',
          text: 'Check out this event!',
          url: link,
        };
        
        console.log('Share data prepared:', shareData);
        
        // Check if the data can be shared before attempting to share
        if (navigator.canShare) {
          const canShare = navigator.canShare(shareData);
          console.log('Can share this data:', canShare);
          
          if (!canShare) {
            console.log('Data cannot be shared, falling back to clipboard');
            throw new Error('Data cannot be shared');
          }
        }
        
        console.log('Attempting to share...');
        await navigator.share(shareData);
        console.log('Share successful via navigator.share');
        toast.success('Event shared successfully!');
      } else {
        console.log('navigator.share not available, using clipboard');
        throw new Error('Navigator share not available');
      }
    } catch (error) {
      console.error('Error in native share:', error);
      console.log('Falling back to clipboard...');
      
      // Fallback to clipboard
      try {
        const link = this.generateEventLink(eventId, shortId);
        console.log('Attempting clipboard copy with link:', link);
        
        if (!navigator.clipboard) {
          console.error('Clipboard API not available');
          toast.error('Share feature not supported on this device');
          return;
        }
        
        console.log('Writing to clipboard...');
        await navigator.clipboard.writeText(link);
        console.log('Clipboard copy successful');
        toast.success('Event link copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        toast.error('Failed to copy link. Please try again.');
      }
    }
    
    console.log('=== ShareService.shareEvent END ===');
  }
}
