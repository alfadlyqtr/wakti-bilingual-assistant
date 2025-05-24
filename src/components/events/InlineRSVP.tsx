
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, HelpCircle, Clock } from 'lucide-react';
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
}

interface RSVPResponse {
  id: string;
  response: 'going' | 'not_going' | 'maybe';
  guest_name?: string;
  guest_email?: string;
  user_id?: string;
  created_at: string;
}

export default function InlineRSVP({ eventId, rsvpEnabled, rsvpDeadline, isPublic, guestEmail }: InlineRSVPProps) {
  const { language } = useTheme();
  const [userRsvp, setUserRsvp] = useState<RSVPResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmailInput, setGuestEmailInput] = useState(guestEmail || '');
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

    // Validate guest info for non-authenticated users
    if (!user && (!guestName.trim() || !guestEmailInput.trim())) {
      toast.error(t("pleaseCompleteAllRequiredFields", language));
      return;
    }

    setSubmitting(true);

    try {
      const rsvpData = {
        event_id: eventId,
        response: selectedResponse,
        user_id: user?.id || null,
        guest_name: user ? null : guestName.trim(),
        guest_email: user ? null : guestEmailInput.trim(),
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

      toast.success(t("rsvpSubmitted", language));
      
      // Update local state
      setUserRsvp(result.data);
      
      // Clear guest fields if they were used
      if (!user) {
        setGuestName('');
        setGuestEmailInput('');
      }
    } catch (error: any) {
      console.error('Error submitting RSVP:', error);
      toast.error(error.message || 'Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (!rsvpEnabled || !isPublic) {
    return null;
  }

  const deadlinePassed = rsvpDeadline && new Date() > new Date(rsvpDeadline);

  return (
    <div className="space-y-4 border-t border-white/20 pt-4 mt-4">
      {rsvpDeadline && (
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Clock className="h-4 w-4" />
          {t("rsvpDeadlineLabel", language)}: {new Date(rsvpDeadline).toLocaleDateString()}
        </div>
      )}

      {deadlinePassed ? (
        <div className="text-center py-2">
          <p className="opacity-75">{t("rsvpDeadlinePassed", language)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* RSVP Buttons */}
          <div className="space-y-3">
            <Label className="text-white font-medium">{t("rsvp", language)}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selectedResponse === 'going' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('going')}
                className="flex items-center gap-2 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="sm"
              >
                <CheckCircle className="h-3 w-3" />
                {t("going", language)}
              </Button>
              <Button
                variant={selectedResponse === 'maybe' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('maybe')}
                className="flex items-center gap-2 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="sm"
              >
                <HelpCircle className="h-3 w-3" />
                {t("maybe", language)}
              </Button>
              <Button
                variant={selectedResponse === 'not_going' ? 'default' : 'outline'}
                onClick={() => setSelectedResponse('not_going')}
                className="flex items-center gap-2 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="sm"
              >
                <XCircle className="h-3 w-3" />
                {t("notGoing", language)}
              </Button>
            </div>
          </div>

          {/* Guest Information (for non-authenticated users) */}
          {!user && selectedResponse && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="guest_name" className="text-white text-sm">{t("guestName", language)} *</Label>
                <Input
                  id="guest_name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t("yourName", language)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
              <div>
                <Label htmlFor="guest_email" className="text-white text-sm">{t("guestEmail", language)} *</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={guestEmailInput}
                  onChange={(e) => setGuestEmailInput(e.target.value)}
                  placeholder={t("yourEmail", language)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          {selectedResponse && (
            <Button 
              onClick={submitRSVP} 
              disabled={submitting}
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/20"
            >
              {submitting ? t("loading", language) : t("submitRsvp", language)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
