
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/providers/ThemeProvider';
import { wn1NotificationService } from '@/services/wn1NotificationService';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function NotificationTestCard() {
  const { language } = useTheme();
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});

  const testNotificationType = async (type: string, displayName: string) => {
    setTestResults(prev => ({ ...prev, [type]: 'pending' }));
    
    try {
      await wn1NotificationService.testNotification(type);
      setTestResults(prev => ({ ...prev, [type]: 'success' }));
    } catch (error) {
      console.error(`Failed to test ${type} notification:`, error);
      setTestResults(prev => ({ ...prev, [type]: 'error' }));
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'pending' | undefined) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return null;
    }
  };

  const notificationTypes = [
    { type: 'shared_task', name: language === 'ar' ? 'المهام المشتركة' : 'Shared Tasks' },
    { type: 'messages', name: language === 'ar' ? 'الرسائل' : 'Messages' },
    { type: 'contact_requests', name: language === 'ar' ? 'طلبات الاتصال' : 'Contact Requests' },
    { type: 'event_rsvps', name: language === 'ar' ? 'ردود الأحداث' : 'Event RSVPs' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{language === 'ar' ? 'اختبار الإشعارات' : 'Test Notifications'}</span>
        </CardTitle>
        <CardDescription>
          {language === 'ar' 
            ? 'اختبر واختبر إعدادات الإشعارات الخاصة بك.'
            : 'Test and verify your notification settings.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {notificationTypes.map(({ type, name }) => (
            <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-medium">{name}</span>
                {getStatusIcon(testResults[type])}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => testNotificationType(type, name)}
                disabled={testResults[type] === 'pending'}
              >
                {language === 'ar' ? 'اختبار' : 'Test'}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">
            {language === 'ar' ? 'معلومات النظام' : 'System Info'}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'حالة الخدمة:' : 'Service Status:'}</span>
              <Badge variant={wn1NotificationService.getProcessorStatus().active ? 'default' : 'destructive'}>
                {wn1NotificationService.getProcessorStatus().active 
                  ? (language === 'ar' ? 'نشط' : 'Active')
                  : (language === 'ar' ? 'غير نشط' : 'Inactive')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'إذن المتصفح:' : 'Browser Permission:'}</span>
              <Badge variant={wn1NotificationService.getPermissionStatus() === 'granted' ? 'default' : 'destructive'}>
                {wn1NotificationService.getPermissionStatus() === 'granted'
                  ? (language === 'ar' ? 'ممنوح' : 'Granted')
                  : (language === 'ar' ? 'مرفوض' : 'Denied')}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
