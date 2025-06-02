import React from 'react';
import { Home, Calendar, Bot, PartyPopper, ListTodo } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { t } from '@/utils/translations';

export default function MobileNav() {
  const location = useLocation();
  const { language } = useTheme();

  const navItems = [
    { 
      path: '/dashboard', 
      icon: Home, 
      label: t('dashboard', language)
    },
    { 
      path: '/my-tasks', 
      icon: ListTodo, 
      label: t('myTasks', language)
    },
    { 
      path: '/calendar', 
      icon: Calendar, 
      label: t('calendar', language)
    },
    { 
      path: '/assistant', 
      icon: Bot, 
      label: t('assistant', language)
    },
    { 
      path: '/maw3d', 
      icon: PartyPopper, 
      label: t('maw3d', language)
    }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t z-50 bg-card">
      <div className="flex items-center justify-around w-full py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center text-sm gap-1.5 opacity-60 hover:opacity-100 transition-opacity",
                isActive && "opacity-100"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
