
import React from 'react';
import { Maw3dEvent, TextStyle } from '@/types/maw3d';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

interface EventPreviewProps {
  event: Partial<Maw3dEvent>;
  textStyle: TextStyle;
  backgroundType: string;
  backgroundValue: string;
  rsvpCount?: { accepted: number; declined: number };
}

export const EventPreview: React.FC<EventPreviewProps> = ({
  event,
  textStyle,
  backgroundType,
  backgroundValue,
  rsvpCount
}) => {
  const getBackgroundStyle = () => {
    switch (backgroundType) {
      case 'color':
        return { backgroundColor: backgroundValue };
      case 'gradient':
        return { background: backgroundValue };
      case 'image':
      case 'ai':
        return { 
          backgroundImage: `url(${backgroundValue})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        };
      default:
        return { backgroundColor: '#3b82f6' };
    }
  };

  const getTextStyle = () => ({
    fontSize: `${textStyle.fontSize}px`,
    fontFamily: textStyle.fontFamily,
    fontWeight: textStyle.isBold ? 'bold' : 'normal',
    fontStyle: textStyle.isItalic ? 'italic' : 'normal',
    textDecoration: textStyle.isUnderline ? 'underline' : 'none',
    textShadow: textStyle.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
    textAlign: textStyle.alignment as any,
    color: textStyle.color
  });

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const minute = parseInt(minutes);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div 
        className="relative rounded-lg overflow-hidden shadow-lg"
        style={getBackgroundStyle()}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20" />
        
        <div className="relative p-4 space-y-3">
          {/* Title and Description with custom text styling */}
          <div style={getTextStyle()}>
            <h1 className="font-bold mb-1" style={{ fontSize: `${textStyle.fontSize + 6}px` }}>
              {event.title || 'Event Title'}
            </h1>
            {(event.description && event.description.trim()) && (
              <p className="opacity-90 mb-2" style={{ fontSize: `${textStyle.fontSize - 2}px` }}>
                {event.description}
              </p>
            )}
          </div>

          {/* Organizer */}
          {(event.organizer && event.organizer.trim()) && (
            <div className="text-sm opacity-90" style={{ color: textStyle.color, fontSize: `${Math.max(textStyle.fontSize - 4, 12)}px` }}>
              Organized by {event.organizer}
            </div>
          )}

          {/* Event details with consistent styling */}
          <div className="space-y-2" style={{ color: textStyle.color }}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span style={{ fontSize: `${Math.max(textStyle.fontSize - 4, 12)}px` }}>
                {event.event_date ? formatDate(event.event_date) : 'Select Date'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span style={{ fontSize: `${Math.max(textStyle.fontSize - 4, 12)}px` }}>
                {event.is_all_day 
                  ? 'All Day' 
                  : `${formatTime(event.start_time || '')} - ${formatTime(event.end_time || '')}`
                }
              </span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span style={{ fontSize: `${Math.max(textStyle.fontSize - 4, 12)}px` }}>
                  {event.location}
                </span>
              </div>
            )}

            {rsvpCount && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span style={{ fontSize: `${Math.max(textStyle.fontSize - 4, 12)}px` }}>
                  {rsvpCount.accepted} attending, {rsvpCount.declined} declined
                </span>
              </div>
            )}
          </div>
        </div>

        {/* WAKTI Branding */}
        <div className="absolute bottom-2 right-2">
          <a 
            href="/" 
            className="text-xs text-white/70 hover:text-white/90 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by WAKTI
          </a>
        </div>
      </div>
    </div>
  );
};
