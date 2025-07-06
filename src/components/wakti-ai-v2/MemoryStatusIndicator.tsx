
import React, { useState, useEffect } from 'react';
import { Brain, Database, Clock } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface MemoryStatusIndicatorProps {
  conversationId: string | null;
  messageCount: number;
  isNewConversation: boolean;
}

export function MemoryStatusIndicator({ 
  conversationId, 
  messageCount, 
  isNewConversation 
}: MemoryStatusIndicatorProps) {
  const { language } = useTheme();
  const [memoryStatus, setMemoryStatus] = useState<'active' | 'syncing' | 'offline'>('offline');

  useEffect(() => {
    if (conversationId && messageCount > 0) {
      setMemoryStatus('active');
    } else if (messageCount > 0) {
      setMemoryStatus('syncing');
    } else {
      setMemoryStatus('offline');
    }
  }, [conversationId, messageCount]);

  const getStatusInfo = () => {
    switch (memoryStatus) {
      case 'active':
        return {
          icon: Database,
          text: language === 'ar' ? 'ذاكرة نشطة' : 'Memory Active',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10 border-green-500/20'
        };
      case 'syncing':
        return {
          icon: Clock,
          text: language === 'ar' ? 'مزامنة الذاكرة' : 'Memory Syncing',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10 border-yellow-500/20'
        };
      default:
        return {
          icon: Brain,
          text: language === 'ar' ? 'بدء جديد' : 'Fresh Start',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10 border-blue-500/20'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm',
      statusInfo.bgColor,
      statusInfo.color
    )}>
      <StatusIcon className="w-3 h-3" />
      <span>{statusInfo.text}</span>
      {messageCount > 0 && (
        <span className="opacity-70">
          ({messageCount} {language === 'ar' ? 'رسالة' : 'msgs'})
        </span>
      )}
    </div>
  );
}
