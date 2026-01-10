import React from 'react';
import { Server, Zap, Database, Users, FileUp, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackendEmptyStateProps {
  isRTL: boolean;
  onEnable: () => void;
  isEnabling: boolean;
}

export function BackendEmptyState({ isRTL, onEnable, isEnabling }: BackendEmptyStateProps) {
  const features = [
    { icon: Mail, label: isRTL ? 'استقبال الرسائل' : 'Form Submissions' },
    { icon: Database, label: isRTL ? 'تخزين البيانات' : 'Data Collections' },
    { icon: FileUp, label: isRTL ? 'رفع الملفات' : 'File Uploads' },
    { icon: Users, label: isRTL ? 'حسابات المستخدمين' : 'User Accounts' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
        <Server className="h-10 w-10 text-indigo-500" />
      </div>
      
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRTL ? 'تفعيل السيرفر' : 'Enable Backend Server'}
      </h2>
      
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {isRTL 
          ? 'فعّل السيرفر لمشروعك لاستقبال البيانات والرسائل والملفات من المستخدمين.'
          : 'Enable the backend server for your project to receive data, messages, and files from users.'}
      </p>
      
      <div className="grid grid-cols-2 gap-3 mb-8">
        {features.map((feature, i) => (
          <div 
            key={i}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/50"
          >
            <feature.icon className="h-4 w-4 text-indigo-500" />
            <span className="text-sm text-foreground">{feature.label}</span>
          </div>
        ))}
      </div>
      
      <Button
        onClick={onEnable}
        disabled={isEnabling}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-8 py-3 h-auto rounded-xl"
      >
        <Zap className={cn("h-5 w-5", isEnabling && "animate-pulse")} />
        {isEnabling 
          ? (isRTL ? 'جاري التفعيل...' : 'Enabling...') 
          : (isRTL ? 'تفعيل السيرفر' : 'Enable Server')}
      </Button>
    </div>
  );
}
