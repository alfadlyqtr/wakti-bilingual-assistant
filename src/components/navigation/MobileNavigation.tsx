
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, Calendar, Bot } from 'lucide-react';
import { UnreadBadge } from '@/components/UnreadBadge';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { waktiNotifications } from '@/services/waktiNotifications';

export default function MobileNavigation() {
  const location = useLocation();
  const { messageCount, contactCount, eventCount } = useUnreadCounts();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    // Clear badges when navigating to specific pages
    if (path === '/contacts') {
      waktiNotifications.clearBadgeOnPageVisit('contacts');
    } else if (path === '/maw3d-events') {
      waktiNotifications.clearBadgeOnPageVisit('maw3d');
    } else if (path === '/tr') {
      waktiNotifications.clearBadgeOnPageVisit('tr');
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex justify-around items-center py-2">
        <Link
          to="/"
          onClick={() => handleNavClick('/')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            isActive('/') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="relative">
            <Home className="h-6 w-6" />
          </div>
          <span className="text-xs mt-1">Home</span>
        </Link>

        <Link
          to="/contacts"
          onClick={() => handleNavClick('/contacts')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            isActive('/contacts') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="relative">
            <Users className="h-6 w-6" />
            {contactCount > 0 && (
              <UnreadBadge count={contactCount} size="sm" className="-top-1 -right-1" />
            )}
          </div>
          <span className="text-xs mt-1">Contacts</span>
        </Link>

        <Link
          to="/maw3d-events"
          onClick={() => handleNavClick('/maw3d-events')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            isActive('/maw3d') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="relative">
            <Calendar className="h-6 w-6" />
            {eventCount > 0 && (
              <UnreadBadge count={eventCount} size="sm" className="-top-1 -right-1" />
            )}
          </div>
          <span className="text-xs mt-1">Events</span>
        </Link>

        <Link
          to="/wakti-ai"
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            isActive('/wakti-ai') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="h-6 w-6" />
          <span className="text-xs mt-1">AI</span>
        </Link>
      </div>
    </nav>
  );
}
