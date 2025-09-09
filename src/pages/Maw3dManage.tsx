import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Edit, Share2, Trash2, CheckCircle, XCircle, User, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

export default function Maw3dManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchEventData = async () => {
    try {
      if (!id) return;
      
      console.log('=== MANAGEMENT PAGE: FETCHING EVENT DATA ===');
      console.log('Event ID:', id);
      console.log('Current user ID:', user?.id);
      
      const eventData = await Maw3dService.getEvent(id);
      if (!eventData) {
        console.error('Event not found');
        toast.error('Event not found');
        navigate('/maw3d');
        return;
      }

      console.log('Event data:', eventData);
      console.log('Event created_by:', eventData.created_by);
      console.log('Current user:', user?.id);

      // Check if user is the creator
      if (eventData.created_by !== user?.id) {
        console.error('User not creator:', { eventCreatedBy: eventData.created_by, currentUser: user?.id });
        toast.error('You can only manage events you created');
        navigate('/maw3d');
        return;
      }

      setEvent(eventData);
      
      // Fetch RSVPs
      console.log('Fetching RSVPs for event:', eventData.id);
      const eventRsvps = await Maw3dService.getRsvps(eventData.id);
      console.log('Fetched RSVPs:', eventRsvps);
      setRsvps(eventRsvps);
    } catch (error) {
      console.error('Error fetching event data:', error);
      toast.error('Failed to load event data');
      navigate('/maw3d');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) {
      toast.error('Cannot generate link for this event');
      return;
    }
    
    try {
      // Pass the full event object to ShareService
      await ShareService.shareEvent(event);
    } catch (error) {
      console.error('Error sharing event:', error);
      toast.error('Failed to share event');
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    console.log('Maw3dManage: Deleting event now (no confirm modal):', event.id);
    try {
      await Maw3dService.deleteEvent(event.id);
      console.log('Maw3dManage: Delete succeeded');
      toast.success('Event deleted successfully');
      navigate('/maw3d');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const getRsvpCounts = () => {
    const accepted = rsvps.filter(rsvp => rsvp.response === 'accepted').length;
    const declined = rsvps.filter(rsvp => rsvp.response === 'declined').length;
    return { accepted, declined };
  };

  const getBackgroundStyle = (event: Maw3dEvent) => {
    switch (event.background_type) {
      case 'color':
        return { backgroundColor: event.background_value };
      case 'gradient':
        return { background: event.background_value };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: `url(${event.background_value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      default:
        return { backgroundColor: '#3b82f6' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-background flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-64 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 overflow-y-auto bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event not found</h1>
          <Button onClick={() => navigate('/maw3d')}>
            {t("backToEvents", language)}
          </Button>
        </div>
      </div>
    );
  }

  const rsvpCounts = getRsvpCounts();
  const acceptedRsvps = rsvps.filter(rsvp => rsvp.response === 'accepted');
  const declinedRsvps = rsvps.filter(rsvp => rsvp.response === 'declined');

  console.log('=== MANAGEMENT PAGE RENDER DEBUG ===');
  console.log('Total RSVPs:', rsvps.length);
  console.log('Accepted RSVPs:', acceptedRsvps.length);
  console.log('Declined RSVPs:', declinedRsvps.length);
  console.log('All RSVPs:', rsvps);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 pb-24">
        {/* Header with Back Button and Description */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/maw3d')}
            className="gap-2 mb-3 text-sm px-2 py-1"
          >
            <ArrowLeft className="w-3 h-3" />
            {t("backToEvents", language)}
          </Button>
          <p className="text-muted-foreground text-sm">{t("viewRsvpsAndManage", language)}</p>
        </div>

        {/* Event Preview - Title and Background Only */}
        <div className="mb-8">
          <div className="w-full max-w-md mx-auto">
            <div 
              className="relative rounded-lg overflow-hidden shadow-lg h-32 flex items-center justify-center"
              style={getBackgroundStyle(event)}
            >
              <div className="absolute inset-0 bg-black/20" />
              <h1 
                className="relative font-bold text-2xl text-center px-4"
                style={{
                  fontSize: `${(event?.text_style?.fontSize || 16) + 8}px`,
                  fontFamily: event?.text_style?.fontFamily || 'Arial',
                  fontWeight: event?.text_style?.isBold ? 'bold' : 'normal',
                  fontStyle: event?.text_style?.isItalic ? 'italic' : 'normal',
                  textDecoration: event?.text_style?.isUnderline ? 'underline' : 'none',
                  textShadow: event?.text_style?.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                  textAlign: event?.text_style?.alignment as any || 'center',
                  color: event?.text_style?.color || '#000000'
                }}
              >
                {event?.title || 'Event Title'}
              </h1>
            </div>
          </div>
        </div>

        {/* Management Actions */}
        <Card className="mb-8">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg font-semibold">{t("eventManagement", language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Actions - Horizontal Layout */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate(`/maw3d/create?id=${event?.id}`)}
                className="gap-2 h-12"
                size="lg"
              >
                <Edit className="w-5 h-5" />
                {t("editEvent", language)}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleShare}
                className="gap-2 h-12"
                size="lg"
              >
                <Share2 className="w-5 h-5" />
                {t("shareEvent", language)}
              </Button>
            </div>
            
            {/* Destructive Action */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="w-full gap-2 h-10"
              >
                <Trash2 className="w-4 h-4" />
                {t("delete", language)}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RSVP Statistics - Always show total count */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 text-center">
              <div className="relative">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{rsvps.length}</div>
                <div className="text-xs font-medium text-muted-foreground">{t("totalResponses", language)}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 text-center">
              <div className="relative">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">{rsvpCounts.accepted}</div>
                <div className="text-xs font-medium text-green-700 dark:text-green-300">{t("going", language)}</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-red-200 bg-red-50/50 dark:bg-red-950/20 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 text-center">
              <div className="relative">
                <XCircle className="w-6 h-6 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">{rsvpCounts.declined}</div>
                <div className="text-xs font-medium text-red-700 dark:text-red-300">{t("declined", language)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vertical RSVP Lists - Thinner Cards */}
        <div className="space-y-6">
          {/* Attending Section */}
          <Card className="shadow-md border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>{t("going", language)}</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  {acceptedRsvps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {acceptedRsvps.length > 0 ? (
                <div className="space-y-2">
                  {acceptedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-start gap-3 p-3 bg-green-50/70 dark:bg-green-950/10 rounded-md border border-green-100 dark:border-green-800/30 hover:shadow-sm transition-shadow">
                      {/* Avatar */}
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 mt-0.5">
                        {rsvp.guest_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-green-800 dark:text-green-200 truncate text-sm">
                          {rsvp.guest_name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(rsvp.created_at), 'MMM d, yyyy • h:mm a')}
                        </div>
                        {/* Comment Display */}
                        {rsvp.comment && (
                          <div className="mt-2 p-2 bg-white/50 dark:bg-green-800/20 rounded border border-green-200/50 dark:border-green-700/30">
                            <div className="flex items-start gap-1">
                              <MessageCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed break-words" dir="auto">
                                {rsvp.comment}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Status */}
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("noRsvpsYet", language)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Declined Section */}
          <Card className="shadow-md border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span>{t("declined", language)}</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                  {declinedRsvps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {declinedRsvps.length > 0 ? (
                <div className="space-y-2">
                  {declinedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-start gap-3 p-3 bg-red-50/70 dark:bg-red-950/10 rounded-md border border-red-100 dark:border-red-800/30 hover:shadow-sm transition-shadow">
                      {/* Avatar */}
                      <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 mt-0.5">
                        {rsvp.guest_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-red-800 dark:text-red-200 truncate text-sm">
                          {rsvp.guest_name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(rsvp.created_at), 'MMM d, yyyy • h:mm a')}
                        </div>
                        {/* Comment Display */}
                        {rsvp.comment && (
                          <div className="mt-2 p-2 bg-white/50 dark:bg-red-800/20 rounded border border-red-200/50 dark:border-red-700/30">
                            <div className="flex items-start gap-1">
                              <MessageCircle className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed break-words" dir="auto">
                                {rsvp.comment}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Status */}
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <XCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("noRsvpsYet", language)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
