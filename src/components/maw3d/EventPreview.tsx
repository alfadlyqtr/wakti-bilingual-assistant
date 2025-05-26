
import React from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Clock, MapPin, Users } from 'lucide-react';
import { Maw3dEvent, TextStyle } from '@/types/maw3d';

interface EventPreviewProps {
  event: Maw3dEvent;
  textStyle: TextStyle;
  backgroundType: string;
  backgroundValue: string;
  rsvpCount: { accepted: number; declined: number; };
  showAttendingCount: boolean;
  language: 'en' | 'ar';
  imageBlur?: number;
}

export const EventPreview: React.FC<EventPreviewProps> = ({
  event,
  textStyle,
  backgroundType,
  backgroundValue,
  rsvpCount,
  showAttendingCount,
  language,
  imageBlur = 0
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
          backgroundPosition: 'center',
          filter: imageBlur > 0 ? `blur(${imageBlur}px)` : 'none'
        };
      default:
        return { backgroundColor: '#3b82f6' };
    }
  };

  const getTextStyle = () => {
    return {
      color: textStyle.color,
      fontSize: `${textStyle.fontSize}px`,
      fontFamily: textStyle.fontFamily,
      fontWeight: textStyle.isBold ? 'bold' : 'normal',
      fontStyle: textStyle.isItalic ? 'italic' : 'normal',
      textDecoration: textStyle.isUnderline ? 'underline' : 'none',
      textAlign: textStyle.alignment as 'left' | 'center' | 'right',
      textShadow: textStyle.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
    };
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const timeObj = new Date();
    timeObj.setHours(parseInt(hours), parseInt(minutes));
    
    if (language === 'ar') {
      return format(timeObj, 'h:mm a', { locale: ar });
    } else {
      return format(timeObj, 'h:mm a', { locale: enUS });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const locale = language === 'ar' ? ar : enUS;
    
    if (language === 'ar') {
      // Use Arabic date format with proper Arabic day and month names
      return format(date, 'EEEE، d MMMM yyyy', { locale: ar });
    } else {
      return format(date, 'EEEE, MMMM d, yyyy', { locale: enUS });
    }
  };

  const getLocalizedText = (key: string) => {
    const translations = {
      'startTime': language === 'ar' ? 'وقت البداية' : 'Start Time',
      'endTime': language === 'ar' ? 'وقت النهاية' : 'End Time',
      'location': language === 'ar' ? 'الموقع' : 'Location',
      'organizer': language === 'ar' ? 'المنظم' : 'Organizer',
      'allDay': language === 'ar' ? 'طوال اليوم' : 'All Day',
      'attending': language === 'ar' ? 'حضور' : 'attending'
    };
    return translations[key as keyof typeof translations] || key;
  };

  return (
    <div className="w-full max-w-md mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div 
        className="relative rounded-lg overflow-hidden shadow-lg min-h-[400px] p-6 flex flex-col"
        style={getBackgroundStyle()}
      >
        {/* Overlay for better text readability when using images */}
        {(backgroundType === 'image' || backgroundType === 'ai') && (
          <div className="absolute inset-0 bg-black bg-opacity-30 rounded-lg"></div>
        )}
        
        <div className="relative z-10 flex flex-col h-full">
          {/* Event Title */}
          <h1 className="text-2xl font-bold mb-4 break-words" style={getTextStyle()}>
            {event.title}
          </h1>

          {/* Event Date */}
          <div className="mb-4">
            <p className="text-lg" style={getTextStyle()}>
              {formatDate(event.event_date)}
            </p>
          </div>

          {/* Event Time */}
          {!event.is_all_day && (event.start_time || event.end_time) && (
            <div className="flex items-center mb-4" style={getTextStyle()}>
              <Clock className="w-4 h-4 mr-2" style={{ color: textStyle.color }} />
              <span>
                {event.start_time && formatTime(event.start_time)}
                {event.start_time && event.end_time && ' - '}
                {event.end_time && formatTime(event.end_time)}
              </span>
            </div>
          )}

          {event.is_all_day && (
            <div className="flex items-center mb-4" style={getTextStyle()}>
              <Clock className="w-4 h-4 mr-2" style={{ color: textStyle.color }} />
              <span>{getLocalizedText('allDay')}</span>
            </div>
          )}

          {/* Event Description */}
          {event.description && (
            <div className="mb-4">
              <p className="break-words" style={getTextStyle()}>
                {event.description}
              </p>
            </div>
          )}

          {/* Event Location */}
          {event.location && (
            <div className="flex items-center mb-4" style={getTextStyle()}>
              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: textStyle.color }} />
              <span className="break-words">{event.location}</span>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="mb-4">
              <p style={getTextStyle()}>
                <span className="font-semibold">{getLocalizedText('organizer')}: </span>
                {event.organizer}
              </p>
            </div>
          )}

          {/* Attending Count (if enabled) */}
          {showAttendingCount && (
            <div className="flex items-center mt-auto" style={getTextStyle()}>
              <Users className="w-4 h-4 mr-2" style={{ color: textStyle.color }} />
              <span>{rsvpCount.accepted} {getLocalizedText('attending')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
