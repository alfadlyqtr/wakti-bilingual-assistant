import React, { useCallback, useMemo } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { motion } from 'framer-motion';
import { PenTool, Mic, Gamepad2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface QuickActionsProps {
  onOpenTool?: (tool: 'text' | 'voice' | 'game') => void;
  onClose?: () => void;
  isCollapsed?: boolean;
}

export function QuickActionsPanel({
  onOpenTool,
  onClose,
  isCollapsed = false
}: QuickActionsProps) {
  const { language } = useTheme();
  const { pathname } = useLocation();
  
  // Memoized quick actions for performance
  const quickActions = useMemo(() => [{
    id: 'text',
    icon: <PenTool />,
    label: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
    action: () => onOpenTool && onOpenTool('text'),
    color: 'text-purple-500',
    path: '/tools/text'
  }, {
    id: 'voice',
    icon: <Mic />,
    label: language === 'ar' ? 'الصوت والمترجم' : 'Voice & Translator',
    action: () => onOpenTool && onOpenTool('voice'),
    color: 'text-pink-500',
    path: '/tools/voice-studio'
  }, {
    id: 'game',
    icon: <Gamepad2 />,
    label: language === 'ar' ? 'وضع الألعاب' : 'Game Mode',
    action: () => onOpenTool && onOpenTool('game'),
    color: 'text-red-500',
    path: '/tools/game'
  }], [language, onOpenTool]);
  
  // Quick actions are non-routing helpers; no active state

  const handleToolAction = useCallback((action: () => void) => {
    action();
    if (onClose) setTimeout(onClose, 300);
  }, [onClose]);

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.03,
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    })
  };
  
  const getGlowByTool = (toolId: string) => {
    switch(toolId) {
      case 'text': return 'shadow-[0_0_15px_rgba(168,85,247,0.7)]';
      case 'voice': return 'shadow-[0_0_15px_rgba(236,72,153,0.7)]';
      case 'game': return 'shadow-[0_0_15px_rgba(239,68,68,0.7)]';
      default: return 'shadow-[0_0_15px_rgba(156,163,175,0.7)]';
    }
  };
  
  return (
    <>
      {quickActions.map((action, index) => {
        const isActive = pathname.startsWith(action.path);
        return (
        <motion.button
          key={action.id}
          className={`w-full ${isCollapsed ? 'h-14 px-1' : 'h-12 px-3'} justify-start rounded-xl group ${
            isActive
              ? `bg-white/10 dark:bg-white/5 shadow-lg backdrop-blur-sm ${getGlowByTool(action.id)}`
              : 'hover:bg-white/5 dark:hover:bg-white/[0.02]'
          } transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:scale-[1.02] active:scale-[0.98] ${(!isCollapsed && index === 0) ? '-mt-2' : ''}`}
          onClick={() => handleToolAction(action.action)}
          variants={itemVariants}
          initial="hidden"
          animate="show"
          custom={index}
        >
          <div className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center w-full gap-2 overflow-hidden`}>
            <div className="relative flex items-center justify-center">
              {React.cloneElement(action.icon, { 
                className: `h-5 w-5 transition-all duration-300 ${action.color} ${
                  isActive 
                    ? 'scale-110 brightness-125 drop-shadow-[0_0_8px]' 
                    : 'group-hover:scale-110 group-hover:brightness-110'
                }`,
                style: { filter: isActive ? 'drop-shadow(0 0 8px currentColor)' : 'none' }
              })}
            </div>
            {(!isCollapsed) && (
              <span className={`text-sm font-medium transition-all duration-300 ${
                isActive ? 'text-foreground font-semibold' : 'text-muted-foreground group-hover:text-foreground'
              }`}>
                {action.label}
              </span>
            )}
            {isCollapsed && (
              <span
                className={`text-xs font-medium transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-[90%] ${
                  isActive ? 'text-foreground font-semibold' : 'text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {action.label}
              </span>
            )}
          </div>
        </motion.button>
        );
      })}
    </>
  );
}
