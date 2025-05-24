
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  response: 'going' | 'not_going';
  guest_name?: string;
  user_id?: string;
  created_at: string;
}

export default function RSVPSection({ eventId, rsvpEnabled, rsvpDeadline, isPublic }: RSVPSectionProps) {
  const { language } = useTheme();
  const [rsvps, setRsvps] = useState<RSVPResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rsvpEnabled && isPublic) {
      fetchRSVPs();
    }
  }, [eventId, rsvpEnabled, isPublic]);

  const fetchRSVPs = async () => {
    setLoading(true);
    try {
      console.log('Fetching RSVPs for event:', eventId);
      
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching RSVPs:', error);
        throw error;
      }

      console.log('Fetched RSVPs:', data);
      setRsvps(data || []);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
    } finally {
      setLoading(false);
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
    return null;
  }

  // Only show accepted and declined responses
  const goingRsvps = rsvps.filter(r => r.response === 'going');
  const notGoingRsvps = rsvps.filter(r => r.response === 'not_going');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            RSVP Responses
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRSVPs}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {rsvpDeadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            RSVP Deadline: {new Date(rsvpDeadline).toLocaleDateString()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* RSVP Summary */}
        <div className="flex gap-4">
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {goingRsvps.length} Accepted
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {notGoingRsvps.length} Declined
          </Badge>
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

        {rsvps.length === 0 && !loading && (
          <div className="text-center py-4 text-muted-foreground">
            No responses yet
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
