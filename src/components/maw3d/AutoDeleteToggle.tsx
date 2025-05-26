
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Clock } from 'lucide-react';
import { t } from '@/utils/translations';

interface AutoDeleteToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  language?: string;
}

export default function AutoDeleteToggle({ enabled, onChange, language = 'en' }: AutoDeleteToggleProps) {
  return (
    <Card className="border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
              <Trash2 className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <Label htmlFor="auto-delete" className="text-sm font-medium text-orange-900 dark:text-orange-100">
                {language === 'ar' ? 'حذف تلقائي بعد انتهاء الحدث' : 'Auto-delete after event completion'}
              </Label>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                {language === 'ar' 
                  ? 'سيتم حذف الحدث تلقائياً خلال 24 ساعة من انتهائه'
                  : 'Event will be automatically deleted 24 hours after completion'
                }
              </p>
            </div>
          </div>
          <Switch
            id="auto-delete"
            checked={enabled}
            onCheckedChange={onChange}
            className="data-[state=checked]:bg-orange-600"
          />
        </div>
        
        {enabled && (
          <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
            <Clock className="w-3 h-3" />
            <span>
              {language === 'ar' 
                ? 'مُفعّل - سيتم الحذف التلقائي'
                : 'Enabled - Auto-deletion active'
              }
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
