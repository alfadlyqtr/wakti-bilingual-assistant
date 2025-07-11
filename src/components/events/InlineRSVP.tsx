
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
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
  response: 'accepted' | 'declined' | 'maybe';
  guest_name?: string;
  guest_email?: string;
  user_id?: string;
  created_at: string;
}

export default function InlineRSVP({ eventId, rsvpEnabled, rsvpDeadline, isPublic, guestEmail, creatorName }: InlineRSVPProps) {
  const { language } = useTheme();
  const [userRsvp, setUserRsvp] = useState<RSVPResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<'accepted' | 'declined' | 'maybe' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    if (rsvpEnabled && isPublic) {
      fetchUserRSVP();
    }
  }, [eventId, rsvpEnabled, isPublic]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchUserRSVP = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setUserRsvp(data);
        setSelectedResponse(data.response);
      }
    } catch (error) {
      console.error('Error fetching user RSVP:', error);
    }
  };

  const submitRSVP = async () => {
    if (!selectedResponse) return;

    // Check deadline
    if (rsvpDeadline && new Date() > new Date(rsvpDeadline)) {
      toast.error(t("rsvpDeadlinePassed", language));
      return;
    }

    // Validate guest info for non-authenticated users - only name required now
    if (!user && !guestName.trim()) {
      toast.error(t("pleaseEnterYourName", language));
      return;
    }

    setSubmitting(true);

    try {
      const rsvpData = {
        event_id: eventId,
        response: selectedResponse,
        user_id: user?.id || null,
        guest_name: user ? null : guestName.trim(),
        guest_email: user ? null : null, // Remove email requirement
        is_wakti_user: !!user
      };

      let result;
      if (userRsvp) {
        // Update existing RSVP
        result = await supabase
          .from('event_rsvps')
          .update({ response: selectedResponse })
          .eq('id', userRsvp.id)
          .select()
          .single();
      } else {
        // Create new RSVP
        result = await supabase
          .from('event_rsvps')
          .insert(rsvpData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast.success(t("responseSubmitted", language));
      
      // Update local state
      setUserRsvp(result.data);
      
      // Clear guest fields if they were used
      if (!user) {
        setGuestName('');
      }
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

  const deadlinePassed = rsvpDeadline && new Date() > new Date(rsvpDeadline);

  return (
    <div className="space-y-4 border-t border-white/40 pt-6 mt-6">
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
          {/* Response Buttons - Much more visible styling */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={selectedResponse === 'accepted' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('accepted')}
                className="flex items-center gap-2 py-4 text-base font-bold bg-green-600 hover:bg-green-500 border-3 border-white text-white shadow-2xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
                style={{ 
                  boxShadow: '0 8px 25px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8)',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}
              >
                <CheckCircle className="h-5 w-5" />
                Accept
              </Button>
              <Button
                variant={selectedResponse === 'declined' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('declined')}
                className="flex items-center gap-2 py-4 text-base font-bold bg-red-600 hover:bg-red-500 border-3 border-white text-white shadow-2xl backdrop-blur-sm transition-all duration-200 hover:scale-105"
                style={{ 
                  boxShadow: '0 8px 25px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8)',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}
              >
                <XCircle className="h-5 w-5" />
                Decline
              </Button>
            </div>
          </div>

          {/* Guest Name Only (for non-authenticated users) */}
          {!user && selectedResponse && (
            <div className="space-y-3">
              <div>
                <Label 
                  htmlFor="guest_name" 
                  className="text-white text-sm font-bold block mb-2"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                >
                  Your Name *
                </Label>
                <Input
                  id="guest_name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/30 border-3 border-white text-white placeholder:text-white/80 backdrop-blur-sm font-medium shadow-xl text-base py-3"
                  style={{ 
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.3)'
                  }}
                />
              </div>
            </div>
          )}

          {/* Submit Button - Much more visible */}
          {selectedResponse && (
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
