
import React, { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Clock, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Maw3dEvent } from '@/types/maw3d';

interface OptimizedEventCardProps {
  event: Maw3dEvent;
  onClick: () => void;
}

// Memoized background style computation
const useOptimizedStyles = (event: Maw3dEvent) => {
  return useMemo(() => {
    const hasImage = event.background_type === 'image' && event.background_value;
    
    const backgroundStyle = hasImage ? {
      backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url(${event.background_value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    } : {
      background: event.background_type === 'gradient' 
        ? event.background_value 
        : event.background_type === 'color' 
        ? event.background_value 
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    };

    const blurredStyle = hasImage ? {
      backgroundImage: `url(${event.background_value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(10px)',
      transform: 'scale(1.1)'
    } : {};

    return { backgroundStyle, blurredStyle, hasImage };
  }, [event.background_type, event.background_value]);
};

const OptimizedEventCardComponent: React.FC<OptimizedEventCardProps> = ({ event, onClick }) => {
  const { backgroundStyle, blurredStyle, hasImage } = useOptimizedStyles(event);

  // Memoized date formatting
  const formattedDate = useMemo(() => {
    if (!event.event_date) return 'Date TBD';
    try {
      return format(parseISO(event.event_date), 'MMM d, yyyy');
    } catch {
      return 'Invalid Date';
    }
  }, [event.event_date]);

  const formattedTime = useMemo(() => {
    if (!event.start_time) return null;
    try {
      const [hours, minutes] = event.start_time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return null;
    }
  }, [event.start_time]);

  return (
    <Card 
      className="group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] overflow-hidden border-0 bg-transparent"
      onClick={onClick}
    >
      <div className="relative">
        {/* Optimized background with cached styles */}
        {hasImage && (
          <div 
            className="absolute inset-0 opacity-20"
            style={blurredStyle}
          />
        )}
        
        <div 
          className="relative"
          style={backgroundStyle}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <CardContent className="relative p-6 text-white min-h-[200px] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold leading-tight group-hover:text-pink-200 transition-colors">
                  {event.title}
                </h3>
                <Heart className="h-5 w-5 text-pink-300 flex-shrink-0 ml-2" />
              </div>
              
              {event.description && (
                <p className="text-gray-200 text-sm mb-4 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1 text-sm bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formattedDate}</span>
                </div>
                
                {formattedTime && (
                  <div className="flex items-center gap-1 text-sm bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                    <Clock className="h-4 w-4" />
                    <span>{formattedTime}</span>
                  </div>
                )}
              </div>

              {event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-pink-300" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="h-4 w-4 text-pink-300" />
                  <span>0 attending</span>
                </div>
                
                <Badge 
                  variant={event.is_public ? "secondary" : "outline"}
                  className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
                >
                  {event.is_public ? 'Public' : 'Private'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
};

// Memoize the entire component for better performance
export const OptimizedEventCard = memo(OptimizedEventCardComponent);
