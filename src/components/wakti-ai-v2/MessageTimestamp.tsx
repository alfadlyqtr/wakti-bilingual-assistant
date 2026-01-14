import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

interface MessageTimestampProps {
  timestamp: Date | string;
  className?: string;
  showFull?: boolean;
}

export function MessageTimestamp({ 
  timestamp, 
  className = '',
  showFull = false 
}: MessageTimestampProps) {
  const { language } = useTheme();
  
  const formatTimestamp = (ts: Date | string): string => {
    const msgTime = new Date(ts);
    const now = new Date();
    const diffInMs = now.getTime() - msgTime.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInMinutes = diffInMs / (1000 * 60);

    // If showFull, always show date and time
    if (showFull) {
      return msgTime.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // Less than 1 minute ago
    if (diffInMinutes < 1) {
      return language === 'ar' ? 'الآن' : 'Just now';
    }

    // Less than 1 hour ago
    if (diffInMinutes < 60) {
      const mins = Math.floor(diffInMinutes);
      return language === 'ar' 
        ? `منذ ${mins} دقيقة`
        : `${mins}m ago`;
    }

    // Today - show time only
    if (diffInHours < 24 && msgTime.getDate() === now.getDate()) {
      return msgTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (msgTime.getDate() === yesterday.getDate() && 
        msgTime.getMonth() === yesterday.getMonth() &&
        msgTime.getFullYear() === yesterday.getFullYear()) {
      const time = msgTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return language === 'ar' ? `أمس ${time}` : `Yesterday ${time}`;
    }

    // This week - show day name
    if (diffInHours < 168) { // 7 days
      return msgTime.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // Older - show date
    return msgTime.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <span className={`text-xs text-muted-foreground ${className}`}>
      {formatTimestamp(timestamp)}
    </span>
  );
}

export default MessageTimestamp;
