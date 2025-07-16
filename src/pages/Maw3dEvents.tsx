
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOptimizedMaw3dEvents } from '@/hooks/useOptimizedMaw3dEvents';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
// Temporarily comment out this import
// import { EventCard } from '@/components/maw3d/Maw3dEventCard';
import { wn1NotificationService } from '@/services/wn1NotificationService';

export default function Maw3dEvents() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const { events, loading, refetch } = useOptimizedMaw3dEvents();

  // Clear Maw3d event badges when visiting this page
  useEffect(() => {
    if (user) {
      wn1NotificationService.clearBadgeOnPageVisit('maw3d');
    }
  }, [user]);

  const handleCreateEvent = () => {
    navigate('/maw3d/create');
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/maw3d/event/${eventId}`);
  };

  const handleManageEvent = (eventId: string) => {
    navigate(`/maw3d/manage/${eventId}`);
  };

  const isRTL = language === 'ar';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {language === 'ar' ? 'موعد - إدارة الأحداث' : 'Maw3d - Event Management'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'ar' ? 'إنشاء وإدارة الأحداث والمواعيد' : 'Create and manage events and appointments'}
            </p>
          </div>
          <Button 
            onClick={handleCreateEvent}
            className="flex items-center gap-2"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            {language === 'ar' ? 'إنشاء حدث جديد' : 'Create New Event'}
          </Button>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Plus className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {language === 'ar' ? 'لا توجد أحداث' : 'No events yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === 'ar' ? 'ابدأ بإنشاء حدثك الأول' : 'Get started by creating your first event'}
            </p>
            <Button onClick={handleCreateEvent}>
              {language === 'ar' ? 'إنشاء حدث' : 'Create Event'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="p-4 border rounded-lg">
                <h3>Event Card Placeholder</h3>
                <p>{event.title}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => handleEventClick(event.id)}>
                    {language === 'ar' ? 'عرض' : 'View'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleManageEvent(event.id)}>
                    {language === 'ar' ? 'إدارة' : 'Manage'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
