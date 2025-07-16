
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, MapPin, Clock, Plus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

export function CreateEventForm() {
  const { language } = useTheme();

  return (
    <div className="p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{t("createEvent", language)}</h1>
          <p className="text-muted-foreground">{t("createAndManageEvents", language)}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t("eventDetails", language)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Event Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("eventTitle", language)}</label>
              <Input 
                placeholder={t("enterEventTitle", language)}
                className="w-full"
              />
            </div>

            {/* Event Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("description", language)}</label>
              <Textarea 
                placeholder={t("enterEventDescription", language)}
                className="w-full min-h-[100px]"
              />
            </div>

            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t("dateTime", language)}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm">{t("eventDate", language)}</label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm">{t("startTime", language)}</label>
                  <Input type="time" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t("location", language)}
              </label>
              <Input 
                placeholder={t("enterLocation", language)}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button className="flex-1">
                {t("createEvent", language)}
              </Button>
              <Button variant="outline" className="flex-1">
                {t("cancel", language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
