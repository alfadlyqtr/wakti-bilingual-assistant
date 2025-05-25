
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class ShareService {
  static generateEventLink(shortId: string): string {
    return `wakti.qa/maw3d/${shortId}`;
  }

  static async shareEvent(eventId: string, shortId: string) {
    try {
      const link = this.generateEventLink(shortId);
      
      // Check if we can use the native share API
      if (navigator.share && navigator.canShare) {
        await navigator.share({
          title: 'WAKTI Event',
          text: 'Check out this event!',
          url: link,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(link);
        toast.success('Event link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing event:', error);
      
      // Final fallback - just copy to clipboard
      try {
        const link = this.generateEventLink(shortId);
        await navigator.clipboard.writeText(link);
        toast.success('Event link copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        toast.error('Failed to copy link. Please try again.');
      }
    }
  }
}
