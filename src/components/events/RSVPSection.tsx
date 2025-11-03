
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface RSVPSectionProps {
  eventId: string;
  rsvpEnabled: boolean;
  rsvpDeadline?: string;
  isPublic: boolean;
}

interface RSVPResponse {
  id: string;
  response: string;
  guest_name?: string;
  guest_email?: string;
  user_id?: string;
  created_at: string;
}

export default function RSVPSection({ eventId, rsvpEnabled, rsvpDeadline, isPublic }: RSVPSectionProps) {
  const { language } = useTheme();
  const [rsvps, setRsvps] = useState<RSVPResponse[]>([]);
  const [userRsvp, setUserRsvp] = useState<RSVPResponse | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<'going' | 'not_going' | 'maybe' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    if (rsvpEnabled && isPublic) {
      fetchRSVPs();
    }
  }, [eventId, rsvpEnabled, isPublic]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchRSVPs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRsvps((data || []) as RSVPResponse[]);
      
      // Find user's RSVP if authenticated
      if (user) {
        const currentUserRsvp = data?.find(rsvp => rsvp.user_id === user.id);
        setUserRsvp(currentUserRsvp ? currentUserRsvp as RSVPResponse : null);
        if (currentUserRsvp) {
          setSelectedResponse(currentUserRsvp.response as any);
        }
      }
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
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
    if (!user && (!guestName.trim() || !guestEmail.trim())) {
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
        guest_email: user ? null : guestEmail.trim(),
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
      fetchRSVPs(); // Refresh the list
    } catch (error: any) {
      console.error('Error submitting RSVP:', error);
      toast.error(error.message || 'Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (!rsvpEnabled) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">{t("rsvpNotEnabled", language)}</p>
        </CardContent>
      </Card>
    );
  }

  if (!isPublic) {
    return null; // Don't show RSVP for private events in standalone mode
  }

  const deadlinePassed = rsvpDeadline && new Date() > new Date(rsvpDeadline);
  
  const goingCount = rsvps.filter(r => r.response === 'going').length;
  const notGoingCount = rsvps.filter(r => r.response === 'not_going').length;
  const maybeCount = rsvps.filter(r => r.response === 'maybe').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t("rsvp", language)}
        </CardTitle>
        {rsvpDeadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t("rsvpDeadlineLabel", language)}: {new Date(rsvpDeadline).toLocaleDateString()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {deadlinePassed ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">{t("rsvpDeadlinePassed", language)}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* RSVP Buttons */}
            <div className="space-y-3">
              <Label>{t("rsvp", language)}</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={selectedResponse === 'going' ? 'default' : 'outline'}
                  onClick={() => setSelectedResponse('going')}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t("going", language)}
                </Button>
                <Button
                  variant={selectedResponse === 'maybe' ? 'default' : 'outline'}
                  onClick={() => setSelectedResponse('maybe')}
                  className="flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  {t("maybe", language)}
                </Button>
                <Button
                  variant={selectedResponse === 'not_going' ? 'default' : 'outline'}
                  onClick={() => setSelectedResponse('not_going')}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  {t("notGoing", language)}
                </Button>
              </div>
            </div>

            {/* Guest Information (for non-authenticated users) */}
            {!user && selectedResponse && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="guest_name">{t("guestName", language)} *</Label>
                  <Input
                    id="guest_name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t("yourName", language)}
                  />
                </div>
                <div>
                  <Label htmlFor="guest_email">{t("guestEmail", language)} *</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t("yourEmail", language)}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            {selectedResponse && (
              <Button 
                onClick={submitRSVP} 
                disabled={submitting}
                className="w-full"
              >
                {submitting ? t("loading", language) : t("submitRsvp", language)}
              </Button>
            )}
          </div>
        )}

        {/* RSVP Summary */}
        {rsvps.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium">{t("rsvpResponses", language)}</h4>
            <div className="flex gap-4">
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {goingCount} {t("peopleGoing", language)}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                {maybeCount} {t("peopleMaybe", language)}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {notGoingCount} {t("peopleNotGoing", language)}
              </Badge>
            </div>
          </div>
        )}

        {rsvps.length === 0 && rsvpEnabled && (
          <div className="text-center py-4 text-muted-foreground">
            {t("noRsvpsYet", language)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
