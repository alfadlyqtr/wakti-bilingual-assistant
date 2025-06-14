
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Bell, Bug, RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  triggerNotificationProcessing, 
  getNotificationQueueStatus, 
  fixStuckNotifications,
  sendTestNotification 
} from '@/utils/notificationUtils';

export const NotificationTestCard: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess, showError, showInfo } = useToastHelper();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [queueStatus, setQueueStatus] = useState<any>(null);

  const handleTriggerProcessing = async () => {
    setIsProcessing(true);
    try {
      const result = await triggerNotificationProcessing();
      
      if (result.success) {
        showSuccess(language === 'ar' ? 'تم تشغيل معالجة الإشعارات بنجاح' : 'Notification processing triggered successfully');
        console.log('Processing result:', result.data);
      } else {
        showError(language === 'ar' ? 'فشل في تشغيل معالجة الإشعارات' : 'Failed to trigger notification processing');
        console.error('Processing failed:', result.message);
      }
    } catch (error) {
      console.error('Error triggering processing:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء تشغيل المعالجة' : 'Error occurred while triggering processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const result = await getNotificationQueueStatus();
      
      if (result.success) {
        setQueueStatus(result.data);
        showInfo(language === 'ar' ? 'تم جلب حالة الطابور بنجاح' : 'Queue status retrieved successfully');
        console.log('Queue status:', result.data);
      } else {
        showError(language === 'ar' ? 'فشل في جلب حالة الطابور' : 'Failed to get queue status');
        console.error('Status check failed:', result.error);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء فحص الحالة' : 'Error occurred while checking status');
    } finally {
      setIsChecking(false);
    }
  };

  const handleFixStuck = async () => {
    setIsFixing(true);
    try {
      const result = await fixStuckNotifications();
      
      if (result.success) {
        showSuccess(language === 'ar' ? 'تم إصلاح الإشعارات العالقة بنجاح' : 'Stuck notifications fixed successfully');
        console.log('Fix result:', result.data);
        // Refresh status after fixing
        handleCheckStatus();
      } else {
        showError(language === 'ar' ? 'فشل في إصلاح الإشعارات العالقة' : 'Failed to fix stuck notifications');
        console.error('Fix failed:', result.message);
      }
    } catch (error) {
      console.error('Error fixing stuck notifications:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء إصلاح الإشعارات' : 'Error occurred while fixing notifications');
    } finally {
      setIsFixing(false);
    }
  };

  const handleSendTest = async () => {
    if (!user?.id) {
      showError(language === 'ar' ? 'يجب تسجيل الدخول لإرسال اختبار' : 'Must be logged in to send test');
      return;
    }

    setIsTesting(true);
    try {
      const result = await sendTestNotification(user.id);
      
      if (result.success) {
        showSuccess(language === 'ar' ? 'تم إرسال الإشعار التجريبي بنجاح' : 'Test notification sent successfully');
        console.log('Test result:', result.data);
      } else {
        showError(language === 'ar' ? 'فشل في إرسال الإشعار التجريبي' : 'Failed to send test notification');
        console.error('Test failed:', result.message);
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء إرسال الاختبار' : 'Error occurred while sending test');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Bug className="h-5 w-5" />
          {language === 'ar' ? 'اختبار نظام الإشعارات' : 'Notification System Testing'}
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          {language === 'ar' 
            ? 'أدوات لاختبار وإصلاح نظام الإشعارات.'
            : 'Tools for testing and debugging the notification system.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleTriggerProcessing}
            disabled={isProcessing}
            variant="outline"
            size="sm"
            className="h-10"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                {language === 'ar' ? 'جاري التشغيل...' : 'Processing...'}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'تشغيل المعالجة' : 'Trigger Processing'}
              </>
            )}
          </Button>

          <Button 
            onClick={handleCheckStatus}
            disabled={isChecking}
            variant="outline"
            size="sm"
            className="h-10"
          >
            {isChecking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                {language === 'ar' ? 'جاري الفحص...' : 'Checking...'}
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'فحص الحالة' : 'Check Status'}
              </>
            )}
          </Button>

          <Button 
            onClick={handleFixStuck}
            disabled={isFixing}
            variant="outline"
            size="sm"
            className="h-10"
          >
            {isFixing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                {language === 'ar' ? 'جاري الإصلاح...' : 'Fixing...'}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'إصلاح العالقة' : 'Fix Stuck'}
              </>
            )}
          </Button>

          <Button 
            onClick={handleSendTest}
            disabled={isTesting || !user?.id}
            variant="outline"
            size="sm"
            className="h-10"
          >
            {isTesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                {language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'اختبار إشعار' : 'Test Notification'}
              </>
            )}
          </Button>
        </div>

        {queueStatus && (
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border">
            <h4 className="font-medium mb-2">
              {language === 'ar' ? 'حالة الطابور:' : 'Queue Status:'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">
                  {language === 'ar' ? 'الطابور:' : 'Queue:'}
                </span>
                <div className="ml-2">
                  {language === 'ar' ? 'المجموع:' : 'Total:'} {queueStatus.queue?.total || 0}
                </div>
                <div className="ml-2">
                  {language === 'ar' ? 'معلق:' : 'Pending:'} {queueStatus.queue?.pending || 0}
                </div>
                <div className="ml-2">
                  {language === 'ar' ? 'فاشل:' : 'Failed:'} {queueStatus.queue?.failed || 0}
                </div>
              </div>
              <div>
                <span className="font-medium">
                  {language === 'ar' ? 'التاريخ:' : 'History:'}
                </span>
                <div className="ml-2">
                  {language === 'ar' ? 'المجموع:' : 'Total:'} {queueStatus.history?.total || 0}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
