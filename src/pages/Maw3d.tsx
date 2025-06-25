
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { useOptimizedMaw3dEvents } from '@/hooks/useOptimizedMaw3dEvents';
import OptimizedEventCard from '@/components/optimized/OptimizedEventCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Maw3d() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past'>('all');

  const { events, isLoading, error, refreshEvents } = useOptimizedMaw3dEvents();

  // Optimized filtering
  const filteredEvents = React.useMemo(() => {
    let filtered = events;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.location?.toLowerCase().includes(searchLower)
      );
    }

    if (filterType !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        return filterType === 'upcoming' ? eventDate >= today : eventDate < today;
      });
    }

    return filtered;
  }, [events, searchTerm, filterType]);

  const handleEventClick = (eventId: string) => {
    navigate(`/maw3d/view/${eventId}`);
  };

  const handleCreateEvent = () => {
    navigate('/maw3d/create');
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'مواعيدي' : 'My Events'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'إنشاء وإدارة فعالياتك وأحداثك المختلفة'
              : 'Create and manage your events and occasions'
            }
          </p>
        </div>
        
        <Button onClick={handleCreateEvent} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'إنشاء حدث جديد' : 'Create New Event'}
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === 'ar' ? 'البحث في الأحداث...' : 'Search events...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {(['all', 'upcoming', 'past'] as const).map((filter) => (
            <Button
              key={filter}
              variant={filterType === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(filter)}
            >
              {filter === 'all' && (language === 'ar' ? 'الكل' : 'All')}
              {filter === 'upcoming' && (language === 'ar' ? 'القادمة' : 'Upcoming')}
              {filter === 'past' && (language === 'ar' ? 'السابقة' : 'Past')}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error && (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">
            {language === 'ar' ? 'حدث خطأ في تحميل الأحداث' : 'Error loading events'}
          </p>
          <Button onClick={() => refreshEvents()} variant="outline">
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchTerm 
              ? (language === 'ar' ? 'لا توجد نتائج للبحث' : 'No search results')
              : (language === 'ar' ? 'لا يوجد أحداث' : 'No events found')
            }
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? (language === 'ar' ? 'جرب مصطلح بحث مختلف' : 'Try a different search term')
              : (language === 'ar' ? 'ابدأ بإنشاء حدثك الأول' : 'Start by creating your first event')
            }
          </p>
          {!searchTerm && (
            <Button onClick={handleCreateEvent}>
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إنشاء حدث جديد' : 'Create New Event'}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <OptimizedEventCard
              key={event.id}
              {...event}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
