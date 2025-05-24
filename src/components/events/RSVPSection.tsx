
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  response: 'going' | 'not_going' | 'maybe';
  guest_name?: string;
  guest_email?: string;
  user_id?: string;
  created_at: string;
}

export default function RSVPSection({ eventId, rsvpEnabled, rsvpDeadline, isPublic }: RSVPSectionProps) {
  const { language } = useTheme();
  const [rsvps, setRsvps] = useState<RSVPResponse[]>([]);

  useEffect(() => {
    if (rsvpEnabled && isPublic) {
      fetchRSVPs();
    }
  }, [eventId, rsvpEnabled, isPublic]);

  const fetchRSVPs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRsvps(data || []);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
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
    return null; // Don't show RSVP for private events
  }

  // Filter to show only accepted and declined responses (not maybe)
  const goingRsvps = rsvps.filter(r => r.response === 'going');
  const notGoingRsvps = rsvps.filter(r => r.response === 'not_going');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          RSVP Responses
        </CardTitle>
        {rsvpDeadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            RSVP Deadline: {new Date(rsvpDeadline).toLocaleDateString()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* RSVP Summary */}
        {(goingRsvps.length > 0 || notGoingRsvps.length > 0) && (
          <div className="space-y-4">
            <div className="flex gap-4">
              {goingRsvps.length > 0 && (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {goingRsvps.length} Accepted
                </Badge>
              )}
              {notGoingRsvps.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {notGoingRsvps.length} Declined
                </Badge>
              )}
            </div>

            {/* Show names of people who accepted */}
            {goingRsvps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-600">Who's Going:</p>
                <div className="space-y-1">
                  {goingRsvps.map((rsvp) => (
                    <p key={rsvp.id} className="text-sm text-muted-foreground">
                      • {rsvp.guest_name || 'Anonymous User'}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Show names of people who declined */}
            {notGoingRsvps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">Who Declined:</p>
                <div className="space-y-1">
                  {notGoingRsvps.map((rsvp) => (
                    <p key={rsvp.id} className="text-sm text-muted-foreground">
                      • {rsvp.guest_name || 'Anonymous User'}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {rsvps.length === 0 && rsvpEnabled && (
          <div className="text-center py-4 text-muted-foreground">
            No responses yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
