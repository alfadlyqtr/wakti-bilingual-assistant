
import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

interface OptimizedEventCardProps {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  background_type: string;
  background_value: string;
  onClick?: () => void;
}

const OptimizedEventCard = memo(({ 
  title, 
  description, 
  event_date, 
  start_time, 
  end_time, 
  is_all_day, 
  location, 
  background_type, 
  background_value,
  onClick 
}: OptimizedEventCardProps) => {
  // Optimized date formatting
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM dd, yyyy');
  };

  // Optimized background style generation
  const getBackgroundStyle = () => {
    if (background_type === 'color') {
      return { backgroundColor: background_value };
    }
    if (background_type === 'gradient') {
      return { background: background_value };
    }
    if (background_type === 'image') {
      return { 
        backgroundImage: `url(${background_value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    return { backgroundColor: '#3b82f6' };
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 overflow-hidden"
      onClick={onClick}
    >
      <div 
        className="h-24 w-full relative"
        style={getBackgroundStyle()}
      >
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <h3 className="text-white font-semibold text-lg text-center px-2 line-clamp-2">
            {title}
          </h3>
        </div>
      </div>
      
      <CardContent className="p-3 space-y-2">
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span>{formatEventDate(event_date)}</span>
        </div>
        
        {!is_all_day && (start_time || end_time) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>
              {start_time && format(new Date(`2000-01-01T${start_time}`), 'h:mm a')}
              {start_time && end_time && ' - '}
              {end_time && format(new Date(`2000-01-01T${end_time}`), 'h:mm a')}
            </span>
          </div>
        )}
        
        {location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

OptimizedEventCard.displayName = 'OptimizedEventCard';

export default OptimizedEventCard;
