
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Edit, Share2, Trash2, CheckCircle, XCircle, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dService } from '@/services/maw3dService';
import { ShareService } from '@/services/shareService';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';

export default function Maw3dManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
    if (!event?.short_id) {
      toast.error('Cannot generate link for this event');
      return;
    }
    
    try {
      await ShareService.shareEvent(event.id, event.short_id);
    } catch (error) {
      console.error('Error sharing event:', error);
      toast.error('Failed to share event');
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await Maw3dService.deleteEvent(event.id);
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
            Back to Events
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
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/maw3d')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Manage Event</h1>
            <p className="text-muted-foreground">View RSVPs and manage your event</p>
          </div>
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
          <CardHeader>
            <CardTitle>Event Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/maw3d/edit/${event?.id}`)}
                className="flex-1 gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Event
              </Button>
              
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex-1 gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Event
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RSVP Statistics */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6 text-center">
              <div className="relative">
                <Users className="w-10 h-10 mx-auto mb-3 text-blue-600" />
                <div className="text-3xl font-bold text-blue-600">{rsvps.length}</div>
                <div className="text-sm font-medium text-muted-foreground">Total Responses</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6 text-center">
              <div className="relative">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-600" />
                <div className="text-3xl font-bold text-green-600">{rsvpCounts.accepted}</div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300">Attending</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-red-200 bg-red-50/50 dark:bg-red-950/20 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6 text-center">
              <div className="relative">
                <XCircle className="w-10 h-10 mx-auto mb-3 text-red-600" />
                <div className="text-3xl font-bold text-red-600">{rsvpCounts.declined}</div>
                <div className="text-sm font-medium text-red-700 dark:text-red-300">Declined</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vertical RSVP Lists - Smaller Cards */}
        <div className="space-y-4">
          {/* Attending Section */}
          <Card className="shadow-md border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Attending</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                  {acceptedRsvps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {acceptedRsvps.length > 0 ? (
                <div className="space-y-1.5">
                  {acceptedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center gap-2.5 p-1.5 bg-green-50/70 dark:bg-green-950/10 rounded-md border border-green-100 dark:border-green-800/30 hover:shadow-sm transition-shadow">
                      {/* Avatar */}
                      <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                        {rsvp.guest_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-green-800 dark:text-green-200 truncate text-xs">
                          {rsvp.guest_name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(rsvp.created_at), 'MMM d, yyyy • h:mm a')}
                        </div>
                      </div>
                      
                      {/* Status */}
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No attendees yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Declined Section */}
          <Card className="shadow-md border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Declined</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">
                  {declinedRsvps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {declinedRsvps.length > 0 ? (
                <div className="space-y-1.5">
                  {declinedRsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center gap-2.5 p-1.5 bg-red-50/70 dark:bg-red-950/10 rounded-md border border-red-100 dark:border-red-800/30 hover:shadow-sm transition-shadow">
                      {/* Avatar */}
                      <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                        {rsvp.guest_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-red-800 dark:text-red-200 truncate text-xs">
                          {rsvp.guest_name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(rsvp.created_at), 'MMM d, yyyy • h:mm a')}
                        </div>
                      </div>
                      
                      {/* Status */}
                      <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <XCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No declines yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
