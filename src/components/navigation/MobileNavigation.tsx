
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { 
  Home, 
  CheckSquare, 
  Calendar, 
  MessageSquare, 
  Users, 
  Bot,
  Settings
} from 'lucide-react';

export const MobileNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    unreadTotal, 
    taskCount, 
    contactCount, 
    maw3dEventCount 
  } = useUnreadMessages();

  const navItems = [
    { 
      icon: Home, 
      label: 'Home', 
      path: '/dashboard',
      badge: 0
    },
    { 
      icon: CheckSquare, 
      label: 'T&R', 
      path: '/tr',
      badge: taskCount
    },
    { 
      icon: Calendar, 
      label: 'Maw3d', 
      path: '/maw3d-events',
      badge: maw3dEventCount
    },
    { 
      icon: MessageSquare, 
      label: 'Messages', 
      path: '/contacts',
      badge: unreadTotal
    },
    { 
      icon: Users, 
      label: 'Contacts', 
      path: '/contacts',
      badge: contactCount
    },
    { 
      icon: Bot, 
      label: 'AI', 
      path: '/wakti-ai',
      badge: 0
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className="relative flex flex-col items-center gap-1 h-auto py-2 px-3"
              onClick={() => navigate(item.path)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{item.label}</span>
              {item.badge > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
