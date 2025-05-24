
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
  response: 'going' | 'not_going' | 'maybe';
  guest_name?: string;
  guest_email?: string;
  user_id?: string;
  created_at: string;
}

export default function InlineRSVP({ eventId, rsvpEnabled, rsvpDeadline, isPublic, guestEmail, creatorName }: InlineRSVPProps) {
  const { language } = useTheme();
  const [userRsvp, setUserRsvp] = useState<RSVPResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<'going' | 'not_going' | 'maybe' | null>(null);
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
    <div className="space-y-4 border-t border-white/30 pt-6 mt-6">
      {/* Show creator name with better styling */}
      {creatorName && (
        <p 
          className="text-center text-white/90"
          style={{ 
            fontSize: `${Math.max(14, 12)}px`,
            textShadow: '2px 2px 8px rgba(0,0,0,0.8)'
          }}
        >
          Created by {creatorName}
        </p>
      )}

      {rsvpDeadline && (
        <div className="flex items-center justify-center gap-2 text-sm text-white/90">
          <Clock className="h-4 w-4" />
          <span style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
            Deadline: {new Date(rsvpDeadline).toLocaleDateString()}
          </span>
        </div>
      )}

      {deadlinePassed ? (
        <div className="text-center py-4">
          <p 
            className="text-white/75"
            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}
          >
            {t("rsvpDeadlinePassed", language)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Response Buttons - More visible styling */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={selectedResponse === 'going' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('going')}
                className="flex items-center gap-2 py-3 text-sm font-semibold bg-green-600/90 hover:bg-green-500 border-2 border-white/40 text-white shadow-lg backdrop-blur-sm"
              >
                <CheckCircle className="h-4 w-4" />
                Accept
              </Button>
              <Button
                variant={selectedResponse === 'not_going' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('not_going')}
                className="flex items-center gap-2 py-3 text-sm font-semibold bg-red-600/90 hover:bg-red-500 border-2 border-white/40 text-white shadow-lg backdrop-blur-sm"
              >
                <XCircle className="h-4 w-4" />
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
                  className="text-white text-sm font-medium block mb-2"
                  style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}
                >
                  Your Name *
                </Label>
                <Input
                  id="guest_name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/20 border-2 border-white/40 text-white placeholder:text-white/70 backdrop-blur-sm font-medium shadow-lg"
                />
              </div>
            </div>
          )}

          {/* Submit Button - More visible */}
          {selectedResponse && (
            <Button 
              onClick={submitRSVP} 
              disabled={submitting}
              className="w-full py-3 text-base font-semibold bg-blue-600/90 hover:bg-blue-500 text-white border-2 border-white/40 shadow-lg backdrop-blur-sm"
            >
              {submitting ? "Submitting..." : "Submit Response"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
