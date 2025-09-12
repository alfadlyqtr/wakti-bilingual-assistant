
import React from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Clock, MapPin, Users } from 'lucide-react';
import { Maw3dEvent, TextStyle, EventStyle } from '@/types/maw3d';

interface EventPreviewProps {
  event: Maw3dEvent;
  textStyle: TextStyle;
  backgroundType: string;
  backgroundValue: string;
  rsvpCount: { accepted: number; declined: number; };
  showAttendingCount: boolean;
  language: 'en' | 'ar';
  imageBlur?: number;
  eventStyle?: EventStyle;
  bare?: boolean; // if true, do not render outer card container (for full-card layout parent)
}

export const EventPreview: React.FC<EventPreviewProps> = ({
  event,
  textStyle,
  backgroundType,
  backgroundValue,
  rsvpCount,
  showAttendingCount,
  language,
  imageBlur = 0,
  eventStyle,
  bare = false
}) => {
  // Helpers to convert hex to rgba for shadow color
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      const r = parseInt(normalized[0] + normalized[0], 16);
      const g = parseInt(normalized[1] + normalized[1], 16);
      const b = parseInt(normalized[2] + normalized[2], 16);
      return { r, g, b };
    }
    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };

  // Build card container styles from eventStyle.card
  const buildCardContainerStyle = (): React.CSSProperties => {
    const section = eventStyle?.card;
    if (!section) return {};
    const base: React.CSSProperties = {
      borderRadius: `${section.border.radius}px`,
      overflow: 'hidden'
    };
    const mode = section.border.mode || 'border';
    const w = section.border.width;
    const c = section.border.color;
    if (mode === 'border') {
      base.borderWidth = `${w}px`;
      base.borderStyle = 'solid';
      base.borderColor = c;
    } else if (mode === 'outline') {
      // Remove default border to avoid double stroke
      base.borderWidth = 0;
      // Stronger visibility: use both box-shadow spread and outline
      base.boxShadow = `0 0 0 ${w}px ${c}`;
      (base as any).outline = `${w}px solid ${c}`;
      (base as any).outlineOffset = `-${w}px`;
    } else if (mode === 'inline') {
      // Remove default border
      base.borderWidth = 0;
      base.boxShadow = `inset 0 0 0 ${w}px ${c}`;
    }
    if (section.liquidGlass) {
      const blur = section.glassBlur ?? 10;
      base.backdropFilter = `blur(${blur}px)`;
      (base as any).WebkitBackdropFilter = `blur(${blur}px)`;
      base.background = section.glassTint || 'rgba(255,255,255,0.08)';
    }
    return base;
  };

  const buildShadowCss = (intensity?: number, color?: string) => {
    const alpha = Math.max(0, Math.min(1, (intensity ?? 5) / 10));
    const rgb = hexToRgb(color || '#000000') || { r: 0, g: 0, b: 0 };
    return `2px 2px 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
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

  const getBlurredBackgroundStyle = () => {
    if ((backgroundType === 'image' || backgroundType === 'ai') && imageBlur > 0) {
      return {
        backgroundImage: `url(${backgroundValue})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: `blur(${imageBlur}px)`
      };
    }
    return {};
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
      textShadow: textStyle.shadowIntensity && textStyle.shadowIntensity > 0
        ? buildShadowCss(textStyle.shadowIntensity, (textStyle as any).shadowColor)
        : 'none'
    } as React.CSSProperties;
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

  // Format date and time on one line
  const getDateTimeString = () => {
    const dateStr = formatDate(event.event_date);
    if (event.is_all_day) {
      return `${dateStr} - ${getLocalizedText('allDay')}`;
    }
    
    let timeStr = '';
    if (event.start_time && event.end_time) {
      timeStr = `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
    } else if (event.start_time) {
      timeStr = formatTime(event.start_time);
    }
    
    return timeStr ? `${dateStr} - ${timeStr}` : dateStr;
  };

  const content = (
    <div 
      className={`relative ${bare ? '' : 'rounded-lg overflow-hidden shadow-lg'} min-h-[400px] p-6 flex flex-col`}
      style={getBackgroundStyle()}
    >
      {/* Blurred background layer for images only */}
      {(backgroundType === 'image' || backgroundType === 'ai') && imageBlur > 0 && (
        <div 
          className="absolute inset-0 rounded-lg"
          style={getBlurredBackgroundStyle()}
        ></div>
      )}
      
      {/* Gradient overlay for better readability */}
      {(backgroundType === 'image' || backgroundType === 'ai') && (
        <div className="absolute inset-0 rounded-lg" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.45) 100%)'
        }}></div>
      )}
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Event Title */}
        <h1 className="text-2xl font-bold mb-4 break-words" style={getTextStyle()}>
          {event.title}
        </h1>

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
            {eventStyle?.chips?.enabled ? (
              <span className="px-2 py-1 rounded-full backdrop-blur-sm bg-white/10 border border-white/20">
                {event.location}
              </span>
            ) : (
              <span className="break-words">{event.location}</span>
            )}
          </div>
        )}

        {/* Organizer */}
        {event.organizer && (
          <div className="mb-2">
            <p style={getTextStyle()}>
              <span className="font-semibold">{getLocalizedText('organizer')}: </span>
              {event.organizer}
            </p>
          </div>
        )}

        {/* Date and Time on one line under organizer */}
        <div className="flex items-center mb-4" style={getTextStyle()}>
          <Clock className="w-4 h-4 mr-2" style={{ color: textStyle.color }} />
          {eventStyle?.chips?.enabled ? (
            <span className="px-2 py-1 rounded-full backdrop-blur-sm bg-white/10 border border-white/20">
              {getDateTimeString()}
            </span>
          ) : (
            <span className="break-words">{getDateTimeString()}</span>
          )}
        </div>

        {/* Attending Count (if enabled) */}
        {showAttendingCount && (
          <div className="flex items-center mt-auto" style={getTextStyle()}>
            <Users className="w-4 h-4 mr-2" style={{ color: textStyle.color }} />
            {eventStyle?.chips?.enabled ? (
              <span className="px-2 py-1 rounded-full backdrop-blur-sm bg-white/10 border border-white/20">
                {rsvpCount.accepted} {getLocalizedText('attending')}
              </span>
            ) : (
              <span>{rsvpCount.accepted} {getLocalizedText('attending')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (bare) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {content}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="relative" style={buildCardContainerStyle()}>
        {content}
      </div>
    </div>
  );
};
