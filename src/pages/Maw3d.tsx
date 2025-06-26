
import React, { Suspense } from 'react';
import { useOptimizedMaw3dEvents } from '@/hooks/useOptimizedMaw3dEvents';
import { OptimizedEventCard } from '@/components/optimized/OptimizedEventCard';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Simplified skeleton loading component (reduced from 6 to 3 cards)
const EventsSkeleton = () => (
  <div className="grid gap-6 md:gap-8">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="relative">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const OptimizedMaw3dEvents = () => {
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Use optimized hook
  const { events, loading, error } = useOptimizedMaw3dEvents();

  const handleEventClick = (event: any) => {
    console.log('📱 Navigating to event management:', event.id);
    navigate(`/maw3d/manage/${event.id}`);
  };

  const handleCreateEvent = () => {
    console.log('📱 Navigating to create event');
    navigate('/maw3d/create');
  };

  // Handle error state with simple retry
  if (error) {
    return (
      <div className="min-h-screen p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Heart className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading Events</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Fixed header with proper button layout */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Maw3d Events
              </h1>
              <p className="text-muted-foreground">
                {loading 
                  ? 'Loading events...'
                  : 'Discover and manage your events'
                }
              </p>
            </div>
          </div>
          
          {/* Fixed Create Event button - full width on mobile, auto on larger screens */}
          <div className="w-full">
            <Button 
              onClick={handleCreateEvent}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Events content with simplified loading */}
        <Suspense fallback={<EventsSkeleton />}>
          {loading ? (
            <EventsSkeleton />
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto p-8 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/20 shadow-xl">
                <Heart className="mx-auto h-16 w-16 text-purple-400 mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  No Events Yet
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Create your first event to get started
                </p>
                <Button 
                  onClick={handleCreateEvent}
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Event
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:gap-8">
              {events.map((event) => (
                <OptimizedEventCard
                  key={event.id}
                  event={event}
                  onClick={() => handleEventClick(event)}
                />
              ))}
            </div>
          )}
        </Suspense>

        {/* Simplified status info */}
        {!loading && events.length > 0 && (
          <div className="text-center mt-8 py-4 text-sm text-muted-foreground">
            <p>Showing {events.length} events</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Maw3d() {
  return <OptimizedMaw3dEvents />;
}
