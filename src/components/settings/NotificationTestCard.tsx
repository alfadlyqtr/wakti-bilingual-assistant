
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { testPushNotification, triggerNotificationProcessing, debugNotificationPipeline } from '@/utils/testNotifications';
import { TestTube, Play, Bell, Bug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const NotificationTestCard: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  const [isTesting, setIsTesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const success = await testPushNotification('Manual test notification - System is working!');
      if (success) {
        showSuccess(language === 'ar' ? 'تم إرسال إشعار الاختبار بنجاح!' : 'Test notification sent successfully!');
      } else {
        showError(language === 'ar' ? 'فشل في إرسال إشعار الاختبار' : 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء اختبار الإشعار' : 'Error occurred while testing notification');
    } finally {
      setIsTesting(false);
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const success = await triggerNotificationProcessing();
      if (success) {
        showSuccess(language === 'ar' ? 'تم تشغيل معالجة الإشعارات بنجاح!' : 'Notification processing triggered successfully!');
      } else {
        showError(language === 'ar' ? 'فشل في تشغيل معالجة الإشعارات' : 'Failed to trigger notification processing');
      }
    } catch (error) {
      console.error('Error processing queue:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء معالجة الطابور' : 'Error occurred while processing queue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDebugPipeline = async () => {
    setIsDebugging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showError(language === 'ar' ? 'المستخدم غير مصادق عليه' : 'User not authenticated');
        return;
      }

      // Call debug function
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/debug-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('🔍 Complete debug info:', result.debug);
        await debugNotificationPipeline(); // Also run client-side debug
        showSuccess(language === 'ar' ? 'تم تشغيل التشخيص - تحقق من وحدة التحكم' : 'Debug completed - check console');
      } else {
        showError(language === 'ar' ? 'فشل التشخيص' : 'Debug failed');
      }
    } catch (error) {
      console.error('Error debugging pipeline:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء التشخيص' : 'Error occurred during debugging');
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
          <TestTube className="h-5 w-5" />
          {language === 'ar' ? 'اختبار نظام الإشعارات' : 'Notification System Testing'}
        </CardTitle>
        <CardDescription className="text-yellow-600 dark:text-yellow-400">
          {language === 'ar' 
            ? 'اختبر نظام الإشعارات يدوياً ومعالجة الطابور'
            : 'Manually test the notification system and queue processing'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        <Button 
          onClick={handleTestNotification}
          disabled={isTesting}
          variant="outline"
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
        >
          {isTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              {language === 'ar' ? 'جاري الاختبار...' : 'Testing...'}
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'اختبار إشعار فوري' : 'Test Immediate Notification'}
            </>
          )}
        </Button>

        <Button 
          onClick={handleProcessQueue}
          disabled={isProcessing}
          variant="outline"
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'معالجة طابور الإشعارات' : 'Process Notification Queue'}
            </>
          )}
        </Button>

        <Button 
          onClick={handleDebugPipeline}
          disabled={isDebugging}
          variant="outline"
          className="border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
        >
          {isDebugging ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              {language === 'ar' ? 'جاري التشخيص...' : 'Debugging...'}
            </>
          ) : (
            <>
              <Bug className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'تشخيص النظام الكامل' : 'Debug Full System'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
