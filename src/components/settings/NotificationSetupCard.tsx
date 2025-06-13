
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Bell, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const NotificationSetupCard: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const setupComplete = localStorage.getItem('wakti-notification-setup-complete');
    setSetupComplete(setupComplete === 'true');
  }, []);

  const handleNotificationSetup = async () => {
    setIsSettingUp(true);
    try {
      console.log('Setting up notification cron job using database function...');
      
      const { data, error } = await supabase.rpc('setup_notification_cron_job');
      
      if (error) {
        console.error('❌ Database function error:', error);
        showError(language === 'ar' ? 'فشل إعداد نظام الإشعارات. يرجى المحاولة مرة أخرى.' : 'Failed to set up notification system. Please try again.');
        return;
      }
      
      console.log('Database function result:', data);
      
      if (data?.success) {
        console.log('✅ Notification cron job configured successfully');
        showSuccess(language === 'ar' ? 'تم إعداد نظام الإشعارات بنجاح!' : 'Notification system set up successfully!');
        setSetupComplete(true);
        localStorage.setItem('wakti-notification-setup-complete', 'true');
      } else {
        console.error('❌ Failed to set up cron job:', data?.error);
        showError(language === 'ar' ? 'فشل إعداد نظام الإشعارات. يرجى المحاولة مرة أخرى.' : 'Failed to set up notification system. Please try again.');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء إعداد الإشعارات.' : 'An error occurred while setting up notifications.');
    } finally {
      setIsSettingUp(false);
    }
  };

  if (setupComplete) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              {language === 'ar' 
                ? 'نظام الإشعارات نشط ويعمل'
                : 'Notification system is active and running'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Bell className="h-5 w-5" />
          {language === 'ar' ? 'إعداد نظام الإشعارات' : 'Setup Notification System'}
        </CardTitle>
        <CardDescription className="text-blue-600 dark:text-blue-400">
          {language === 'ar' 
            ? 'قم بإعداد نظام معالجة الإشعارات التلقائي لتلقي التنبيهات في الوقت الفعلي.'
            : 'Set up the automatic notification processing system to receive real-time alerts.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleNotificationSetup}
          disabled={isSettingUp}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSettingUp ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {language === 'ar' ? 'جاري الإعداد...' : 'Setting up...'}
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إعداد نظام الإشعارات' : 'Setup Notification System'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
