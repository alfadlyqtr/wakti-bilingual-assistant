
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from "@/components/ui/toaster";
import { supabase } from '@/integrations/supabase/client';
import { EventPreview } from '@/components/maw3d/EventPreview';
import { Maw3dEvent, Maw3dRsvp } from '@/types/maw3d';

export default function DirectEventView() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<Maw3dEvent | null>(null);
  const [rsvps, setRsvps] = useState<Maw3dRsvp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [hasResponded, setHasResponded] = useState(false);
  const [userResponse, setUserResponse] = useState<'accepted' | 'declined' | null>(null);
  const [submittedName, setSubmittedName] = useState('');

  // Use event's language for all translations - fallback to 'en'
  const eventLanguage = event?.language || 'en';

  // Check if eventId is a valid UUID format
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  useEffect(() => {
    if (eventId && isValidUUID(eventId)) {
      fetchEvent();
    } else {
      setIsLoading(false);
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setIsLoading(true);
      
      if (!eventId || !isValidUUID(eventId)) {
        console.log('Invalid or missing UUID');
        return;
      }

      console.log('Fetching event with UUID:', eventId);

      // Query by UUID (primary key) with public check
      const { data: eventData, error: eventError } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('id', eventId)
        .eq('is_public', true)
        .single();

      if (eventError) {
        console.error('Database error:', eventError);
        if (eventError.code === 'PGRST116') {
          console.log('Event not found or not public');
          return;
        }
        throw eventError;
      }

      if (!eventData) {
        console.log('No public event found for this UUID');
        return;
      }

      console.log('Event found successfully:', eventData.title);
      setEvent(eventData);
      
      // Fetch RSVPs
      const { data: rsvpData, error: rsvpError } = await supabase
        .from('maw3d_rsvps')
        .select('*')
        .eq('event_id', eventData.id)
        .order('created_at', { ascending: true });

      if (rsvpError) {
        console.error('RSVP fetch error:', rsvpError.message);
      } else {
        console.log('RSVPs fetched successfully:', rsvpData?.length || 0);
        setRsvps(rsvpData || []);
      }
      
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Error loading event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRsvp = async (response: 'accepted' | 'declined') => {
    if (!event || !guestName.trim()) {
      const errorMsg = eventLanguage === 'ar' ? 'يرجى إدخال اسمك' : 'Please enter your name';
      toast.error(errorMsg);
      return;
    }

    const trimmedName = guestName.trim();

    // Check for duplicate names
    const existingRsvp = rsvps.find(rsvp => 
      rsvp.guest_name?.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingRsvp) {
      const duplicateMessage = eventLanguage === 'ar' 
        ? `شخص بالاسم "${trimmedName}" قد استجاب بالفعل لهذا الحدث.`
        : `Someone with the name "${trimmedName}" has already responded to this event.`;
      toast.error(duplicateMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('maw3d_rsvps')
        .insert({
          event_id: event.id,
          response,
          guest_name: trimmedName,
          user_id: null
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          const duplicateMessage = eventLanguage === 'ar' 
            ? `شخص بالاسم "${trimmedName}" قد استجاب بالفعل لهذا الحدث.`
            : `Someone with the name "${trimmedName}" has already responded to this event.`;
          toast.error(duplicateMessage);
        } else {
          throw error;
        }
        return;
      }

      setHasResponded(true);
      setUserResponse(response);
      setSubmittedName(trimmedName);
      
      const responseText = response === 'accepted' 
        ? (eventLanguage === 'ar' ? 'قبولك' : 'acceptance')
        : (eventLanguage === 'ar' ? 'رفضك' : 'decline');
      
      const thankYouText = eventLanguage === 'ar' ? 'شكراً لك' : 'Thank you';
      const recordedText = eventLanguage === 'ar' ? 'تم تسجيل' : 'has been recorded';
      
      const message = `${thankYouText}, ${trimmedName}! ${eventLanguage === 'ar' ? `${recordedText} ${responseText}.` : `Your ${responseText} ${recordedText}.`}`;
      toast.success(message);
      
      // Refresh RSVPs
      const { data: updatedRsvps } = await supabase
        .from('maw3d_rsvps')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true });
      
      if (updatedRsvps) {
        setRsvps(updatedRsvps);
      }
    } catch (error) {
      const errorMsg = eventLanguage === 'ar' ? 'خطأ في إرسال الرد' : 'Error submitting response';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRsvpCounts = () => {
    const accepted = rsvps.filter(r => r.response === 'accepted').length;
    const declined = rsvps.filter(r => r.response === 'declined').length;
    return { accepted, declined };
  };

  const getCalendarUrl = () => {
    if (!event) return '';
    
    const startDate = new Date(`${event.event_date}T${event.start_time || '00:00'}`);
    const endDate = event.end_time 
      ? new Date(`${event.event_date}T${event.end_time}`)
      : new Date(startDate.getTime() + (event.is_all_day ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));

    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: event.description || '',
      location: event.location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const t = (key: string, lang: string) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        eventNotFound: 'Event Not Found',
        eventMayHaveExpired: 'The event you are looking for may have been removed or expired.',
        addToCalendar: 'Add to Calendar',
        getDirections: 'Get Directions',
        areYouAttending: 'Are you attending?',
        enterYourName: 'Enter your name',
        accept: 'Accept',
        decline: 'Decline'
      },
      ar: {
        eventNotFound: 'الحدث غير موجود',
        eventMayHaveExpired: 'الحدث الذي تبحث عنه قد يكون تم حذفه أو انتهت صلاحيته.',
        addToCalendar: 'إضافة للتقويم',
        getDirections: 'الحصول على الاتجاهات',
        areYouAttending: 'هل ستحضر؟',
        enterYourName: 'أدخل اسمك',
        accept: 'قبول',
        decline: 'رفض'
      }
    };
    return translations[lang]?.[key] || translations.en[key] || key;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster />
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="w-64 h-48 bg-gray-200 rounded-lg mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
          <div className="text-sm text-muted-foreground">
            Loading event...
          </div>
        </div>
      </div>
    );
  }

  if (!eventId || !isValidUUID(eventId) || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster />
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold mb-4">{t('eventNotFound', eventLanguage)}</h1>
          <p className="text-muted-foreground">{t('eventMayHaveExpired', eventLanguage)}</p>
          <div className="text-sm text-red-600">
            Event ID: {eventId}
          </div>
        </div>
      </div>
    );
  }

  const rsvpCounts = getRsvpCounts();

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Event Preview */}
          <EventPreview
            event={event}
            textStyle={event.text_style}
            backgroundType={event.background_type}
            backgroundValue={event.background_value}
            rsvpCount={rsvpCounts}
            showAttendingCount={event.show_attending_count}
            language={eventLanguage}
          />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => window.open(getCalendarUrl(), '_blank')}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              {t('addToCalendar', eventLanguage)}
            </Button>
            
            {event.google_maps_link && (
              <Button
                variant="outline"
                onClick={() => window.open(event.google_maps_link, '_blank')}
                className="flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                {t('getDirections', eventLanguage)}
              </Button>
            )}
          </div>

          {/* RSVP Section */}
          {!hasResponded && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {t('areYouAttending', eventLanguage)}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Input
                      placeholder={t('enterYourName', eventLanguage)}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className={eventLanguage === 'ar' ? 'text-right' : ''}
                      dir={eventLanguage === 'ar' ? 'rtl' : 'ltr'}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleRsvp('accepted')}
                      disabled={isSubmitting || !guestName.trim()}
                      className="flex-1 bg-green-500/20 border-green-500 text-green-700 hover:bg-green-500/30 hover:text-green-800"
                      variant="outline"
                    >
                      {t('accept', eventLanguage)}
                    </Button>
                    <Button
                      onClick={() => handleRsvp('declined')}
                      disabled={isSubmitting || !guestName.trim()}
                      className="flex-1 bg-red-500/20 border-red-500 text-red-700 hover:bg-red-500/30 hover:text-red-800"
                      variant="outline"
                    >
                      {t('decline', eventLanguage)}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Response Confirmation */}
          {hasResponded && (
            <Card>
              <CardContent className="p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  {eventLanguage === 'ar' ? `شكراً لك، ${submittedName}!` : `Thank you, ${submittedName}!`}
                </h3>
                <p className="text-muted-foreground">
                  {eventLanguage === 'ar' 
                    ? `تم تسجيل ${userResponse === 'accepted' ? 'قبولك' : 'رفضك'}.`
                    : `Your ${userResponse === 'accepted' ? 'acceptance' : 'decline'} has been recorded.`
                  }
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
