
import React, { useState, useEffect } from 'react';
import { Brain, Database, Clock, CheckCircle } from 'lucide-react';
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
  const [memoryStatus, setMemoryStatus] = useState<'active' | 'syncing' | 'offline' | 'ready'>('offline');

  useEffect(() => {
    // Determine memory status based on conversation state
    if (conversationId && !conversationId.startsWith('fallback-') && messageCount > 0) {
      // We have a real conversation ID and messages - memory is active
      setMemoryStatus('active');
    } else if (conversationId && conversationId.startsWith('fallback-') && messageCount > 0) {
      // We have a fallback ID (offline mode) but messages exist
      setMemoryStatus('syncing');
    } else if (messageCount > 0) {
      // We have messages but no conversation ID yet
      setMemoryStatus('syncing');
    } else if (conversationId && !isNewConversation) {
      // We have a conversation ID but no messages loaded yet
      setMemoryStatus('ready');
    } else {
      // Fresh start
      setMemoryStatus('offline');
    }
  }, [conversationId, messageCount, isNewConversation]);

  const getStatusInfo = () => {
    switch (memoryStatus) {
      case 'active':
        return {
          icon: Database,
          text: language === 'ar' ? 'ذاكرة نشطة' : 'Memory Active',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10 border-green-500/20',
          description: language === 'ar' ? 'يتم حفظ المحادثة' : 'Conversation saved'
        };
      case 'syncing':
        return {
          icon: Clock,
          text: language === 'ar' ? 'مزامنة الذاكرة' : 'Memory Syncing',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10 border-yellow-500/20',
          description: language === 'ar' ? 'جاري الحفظ' : 'Saving in progress'
        };
      case 'ready':
        return {
          icon: CheckCircle,
          text: language === 'ar' ? 'جاهز للمتابعة' : 'Ready to Continue',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10 border-blue-500/20',
          description: language === 'ar' ? 'المحادثة محفوظة' : 'Conversation loaded'
        };
      default:
        return {
          icon: Brain,
          text: language === 'ar' ? 'محادثة جديدة' : 'Fresh Start',
          color: 'text-slate-500',
          bgColor: 'bg-slate-500/10 border-slate-500/20',
          description: language === 'ar' ? 'لا توجد ذاكرة سابقة' : 'No previous memory'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-200',
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
