
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface InlineRSVPProps {
  eventId: string;
  rsvpEnabled: boolean;
  rsvpDeadline?: string;
  isPublic: boolean;
  guestEmail?: string;
  creatorName?: string;
}

interface RSVPResponse {
  id: string;
  response: 'going' | 'not_going';
  guest_name?: string;
  user_id?: string;
  created_at: string;
}

export default function InlineRSVP({ eventId, rsvpEnabled, rsvpDeadline, isPublic }: InlineRSVPProps) {
  const { language } = useTheme();
  const [userRsvp, setUserRsvp] = useState<RSVPResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<'going' | 'not_going' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    checkUserAndFetchRSVP();
  }, [eventId, rsvpEnabled, isPublic]);

  const checkUserAndFetchRSVP = async () => {
    console.log('Starting user check and RSVP fetch...');
    
    try {
      // First, get the current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current user:', currentUser?.id || 'No user');
      
      setUser(currentUser);
      setUserLoaded(true);
      
      // Only fetch existing RSVP if user is authenticated and RSVP is enabled
      if (currentUser && rsvpEnabled && isPublic) {
        console.log('Fetching existing RSVP for user:', currentUser.id);
        
        const { data, error } = await supabase
          .from('event_rsvps')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user RSVP:', error);
        } else if (data) {
          console.log('Found existing RSVP:', data);
          setUserRsvp(data);
          setSelectedResponse(data.response);
        } else {
          console.log('No existing RSVP found');
        }
      }
    } catch (error) {
      console.error('Error in checkUserAndFetchRSVP:', error);
    }
  };

  const submitRSVP = async () => {
    console.log('Starting RSVP submission...');
    console.log('Selected response:', selectedResponse);
    console.log('Guest name:', guestName);
    console.log('User:', user?.id || 'No user');
    
    if (!selectedResponse) {
      console.log('No response selected');
      toast.error('Please select a response');
      return;
    }

    // Check deadline
    if (rsvpDeadline && new Date() > new Date(rsvpDeadline)) {
      console.log('Deadline passed');
      toast.error(t("rsvpDeadlinePassed", language));
      return;
    }

    // For guests, require name
    if (!user && !guestName.trim()) {
      console.log('Guest name required but not provided');
      toast.error('Please enter your name');
      return;
    }

    setSubmitting(true);

    try {
      const rsvpData = {
        event_id: eventId,
        response: selectedResponse,
        user_id: user?.id || null,
        guest_name: user ? null : guestName.trim(),
      };

      console.log('Submitting RSVP data:', rsvpData);

      let result;
      if (userRsvp) {
        // Update existing RSVP
        console.log('Updating existing RSVP:', userRsvp.id);
        result = await supabase
          .from('event_rsvps')
          .update({ response: selectedResponse })
          .eq('id', userRsvp.id)
          .select()
          .single();
      } else {
        // Create new RSVP
        console.log('Creating new RSVP');
        result = await supabase
          .from('event_rsvps')
          .insert(rsvpData)
          .select()
          .single();
      }

      console.log('RSVP submission result:', result);

      if (result.error) {
        console.error('RSVP submission error:', result.error);
        throw result.error;
      }

      console.log('RSVP submitted successfully');
      
      // Show thank you popup
      setShowThankYou(true);
      setTimeout(() => {
        setShowThankYou(false);
      }, 2000);
      
      // Update local state
      setUserRsvp(result.data);
      
      // Clear guest name if it was used
      if (!user) {
        setGuestName('');
      }
      
      toast.success('Response submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting RSVP:', error);
      toast.error(error.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (!rsvpEnabled || !isPublic) {
    return null;
  }

  if (!userLoaded) {
    return (
      <div className="space-y-4 border-t border-white/40 pt-6 mt-6">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  const deadlinePassed = rsvpDeadline && new Date() > new Date(rsvpDeadline);

  return (
    <div className="space-y-4 border-t border-white/40 pt-6 mt-6">
      {/* Thank You Popup */}
      {showThankYou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-green-600 text-white px-8 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in-0 zoom-in-95">
            <Check className="h-6 w-6" />
            <span className="text-lg font-bold">Thank you for your response!</span>
          </div>
        </div>
      )}

      {rsvpDeadline && (
        <div className="flex items-center justify-center gap-2 text-sm text-white/90">
          <Clock className="h-4 w-4" />
          <span style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}>
            Deadline: {new Date(rsvpDeadline).toLocaleDateString()}
          </span>
        </div>
      )}

      {deadlinePassed ? (
        <div className="text-center py-4">
          <p 
            className="text-white/75"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}
          >
            {t("rsvpDeadlinePassed", language)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Guest Name Input - Show for non-authenticated users */}
          {!user && (
            <div>
              <Label 
                htmlFor="guest_name" 
                className="text-white text-lg font-bold block mb-3"
                style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.9)' }}
              >
                Enter Your Name *
              </Label>
              <Input
                id="guest_name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your full name"
                className="bg-white/95 border-4 border-white text-gray-900 placeholder:text-gray-600 backdrop-blur-sm font-bold shadow-2xl text-lg py-4 px-4"
                style={{ 
                  boxShadow: '0 8px 25px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.9)',
                  fontSize: '18px',
                  fontWeight: '600'
                }}
              />
            </div>
          )}

          {/* Response Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={selectedResponse === 'going' ? 'default' : 'outline'}
              onClick={() => setSelectedResponse('going')}
              className="flex items-center gap-2 py-4 text-base font-bold bg-green-600 hover:bg-green-500 border-3 border-white text-white shadow-2xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
              style={{ 
                boxShadow: '0 8px 25px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                opacity: selectedResponse === 'going' ? 1 : 0.8
              }}
            >
              <CheckCircle className="h-5 w-5" />
              Accept
            </Button>
            <Button
              variant={selectedResponse === 'not_going' ? 'default' : 'outline'}
              onClick={() => setSelectedResponse('not_going')}
              className="flex items-center gap-2 py-4 text-base font-bold bg-red-600 hover:bg-red-500 border-3 border-white text-white shadow-2xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
              style={{ 
                boxShadow: '0 8px 25px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                opacity: selectedResponse === 'not_going' ? 1 : 0.8
              }}
            >
              <XCircle className="h-5 w-5" />
              Decline
            </Button>
          </div>

          {/* Submit Button */}
          {selectedResponse && ((!user && guestName.trim()) || user) && (
            <Button 
              onClick={submitRSVP} 
              disabled={submitting}
              className="w-full py-4 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white border-3 border-white shadow-2xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
              style={{ 
                boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.9)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
              }}
            >
              {submitting ? "Submitting..." : "Submit Response"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
