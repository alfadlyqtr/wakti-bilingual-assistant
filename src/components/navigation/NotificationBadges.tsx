
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, Users, CheckSquare, Calendar, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { cn } from '@/lib/utils';

export const NotificationBadges = () => {
  const navigate = useNavigate();
  const { 
    unreadTotal, 
    taskCount, 
    contactCount, 
    sharedTaskCount, 
    maw3dEventCount,
    loading 
  } = useUnreadMessages();

  const totalNotifications = unreadTotal + taskCount + contactCount + sharedTaskCount + maw3dEventCount;

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Messages Badge */}
      {unreadTotal > 0 && (
        <div 
          className="relative cursor-pointer transition-transform hover:scale-110"
          onClick={() => navigate('/contacts')}
        >
          <MessageSquare className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadTotal > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </Badge>
          )}
        </div>
      )}

      {/* Tasks Badge */}
      {taskCount > 0 && (
        <div 
          className="relative cursor-pointer transition-transform hover:scale-110"
          onClick={() => navigate('/tr')}
        >
          <AlertCircle className="h-5 w-5 text-orange-500 hover:text-orange-600" />
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {taskCount > 99 ? '99+' : taskCount}
          </Badge>
        </div>
      )}

      {/* Contact Requests Badge */}
      {contactCount > 0 && (
        <div 
          className="relative cursor-pointer transition-transform hover:scale-110"
          onClick={() => navigate('/contacts')}
        >
          <Users className="h-5 w-5 text-blue-500 hover:text-blue-600" />
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {contactCount > 99 ? '99+' : contactCount}
          </Badge>
        </div>
      )}

      {/* Shared Tasks Badge */}
      {sharedTaskCount > 0 && (
        <div 
          className="relative cursor-pointer transition-transform hover:scale-110"
          onClick={() => navigate('/tr')}
        >
          <CheckSquare className="h-5 w-5 text-green-500 hover:text-green-600" />
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {sharedTaskCount > 99 ? '99+' : sharedTaskCount}
          </Badge>
        </div>
      )}

      {/* Maw3d Events Badge */}
      {maw3dEventCount > 0 && (
        <div 
          className="relative cursor-pointer transition-transform hover:scale-110"
          onClick={() => navigate('/maw3d')}
        >
          <Calendar className="h-5 w-5 text-purple-500 hover:text-purple-600" />
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {maw3dEventCount > 99 ? '99+' : maw3dEventCount}
          </Badge>
        </div>
      )}

      {/* Overall Notification Bell - only show if no specific badges are shown */}
      {totalNotifications === 0 && (
        <Bell className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
};
