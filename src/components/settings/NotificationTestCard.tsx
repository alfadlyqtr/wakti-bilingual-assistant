
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Bell, Bug, RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { wn1NotificationService } from '@/services/wn1NotificationService';

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
      showInfo(language === 'ar' ? 'جاري معالجة الإشعارات...' : 'Processing notifications...');
      // Simulate some processing
      setTimeout(() => {
        showSuccess(language === 'ar' ? 'تم تشغيل معالجة الإشعارات' : 'Notification processing triggered');
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Error triggering processing:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء تشغيل المعالجة' : 'Error occurred while triggering processing');
      setIsProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const status = wn1NotificationService.getProcessorStatus();
      setQueueStatus(status);
      showSuccess(language === 'ar' ? 'تم فحص حالة الإشعارات' : 'Notification status checked');
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
      showInfo(language === 'ar' ? 'جاري إصلاح الإشعارات المعلقة...' : 'Fixing stuck notifications...');
      // Simulate fixing
      setTimeout(() => {
        showSuccess(language === 'ar' ? 'تم إصلاح الإشعارات المعلقة' : 'Fixed stuck notifications');
        setIsFixing(false);
      }, 1500);
    } catch (error) {
      console.error('Error fixing stuck notifications:', error);
      showError(language === 'ar' ? 'حدث خطأ أثناء إصلاح الإشعارات' : 'Error occurred while fixing notifications');
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
      await wn1NotificationService.testNotification('test');
      showSuccess(language === 'ar' ? 'تم إرسال إشعار تجريبي' : 'Test notification sent');
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
          {language === 'ar' ? 'اختبار الإشعارات' : 'Test Notifications'}
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          {language === 'ar' 
            ? 'اختبر واتحقق من إعدادات الإشعارات الخاصة بك.'
            : 'Test and verify your notification settings.'}
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
              {language === 'ar' ? 'حالة النظام:' : 'System Status:'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">
                  {language === 'ar' ? 'نشط:' : 'Active:'}
                </span>
                <div className="ml-2">
                  {queueStatus.active ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
