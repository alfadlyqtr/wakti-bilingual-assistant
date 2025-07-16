
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Bell, Bug, RefreshCw, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// Removed broken import: import { ... } from '@/utils/notificationUtils';

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
      // TODO: Implement WN1 processing trigger
      showInfo(language === 'ar' ? 'WN1 System - قيد التطوير' : 'WN1 System - Under Development');
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
      // TODO: Implement WN1 status check
      showInfo(language === 'ar' ? 'WN1 System - قيد التطوير' : 'WN1 System - Under Development');
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
      // TODO: Implement WN1 fix stuck
      showInfo(language === 'ar' ? 'WN1 System - قيد التطوير' : 'WN1 System - Under Development');
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
      // TODO: Implement WN1 test notification
      showInfo(language === 'ar' ? 'WN1 System - قيد التطوير' : 'WN1 System - Under Development');
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
          {language === 'ar' ? 'اختبار نظام WN1' : 'WN1 System Testing'}
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          {language === 'ar' 
            ? 'أدوات لاختبار وإصلاح نظام WN1 الجديد.'
            : 'Tools for testing and debugging the new WN1 system.'}
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
                  {language === 'ar' ? 'WN1:' : 'WN1:'}
                </span>
                <div className="ml-2">
                  {language === 'ar' ? 'نشط' : 'Active'}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
