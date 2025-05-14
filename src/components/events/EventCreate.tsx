
import React, { useState, useEffect } from 'react';
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import BackgroundSelector from './BackgroundSelector';

const EventCreate: React.FC = () => {
  const { language } = useTheme();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [isAllDay, setIsAllDay] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  
  return (
    <div className="p-4 pb-20">
      <form className="space-y-6">
        {/* Title and Description */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">
              {language === 'ar' ? 'عنوان الفعالية*' : 'Event Title*'}
            </label>
            <Input placeholder={language === 'ar' ? 'أدخل عنوان الفعالية...' : 'Enter event title...'} />
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-1">
              {language === 'ar' ? 'الوصف' : 'Description'}
            </label>
            <Textarea 
              placeholder={language === 'ar' ? 'أدخل وصف الفعالية...' : 'Enter event description...'}
              rows={4}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-1">
              {language === 'ar' ? 'الموقع' : 'Location'}
            </label>
            <Input placeholder={language === 'ar' ? 'أدخل الموقع...' : 'Enter location...'} />
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-1">
              {language === 'ar' ? 'رابط خرائط جوجل' : 'Google Maps Link'}
            </label>
            <Input placeholder={language === 'ar' ? 'أدخل رابط الخرائط...' : 'Paste Google Maps URL...'} />
          </div>
        </div>
        
        {/* Date and Time */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{language === 'ar' ? 'فعالية طوال اليوم' : 'All Day Event'}</span>
              <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  {language === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {startDate ? format(startDate, 'PPP') : language === 'ar' ? 'اختر تاريخًا' : 'Pick a date'}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-1">
                  {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {endDate ? format(endDate, 'PPP') : language === 'ar' ? 'اختر تاريخًا' : 'Pick a date'}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {language === 'ar' ? 'وقت البدء' : 'Start Time'}
                  </label>
                  <Input type="time" />
                </div>
                
                <div>
                  <label className="text-sm font-medium block mb-1">
                    {language === 'ar' ? 'وقت الانتهاء' : 'End Time'}
                  </label>
                  <Input type="time" />
                </div>
              </div>
            )}
          </div>
        </Card>
        
        {/* Privacy Setting */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{language === 'ar' ? 'فعالية عامة' : 'Public Event'}</h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'يمكن لأي شخص لديه الرابط العرض والرد' 
                  : 'Anyone with the link can view and RSVP'}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </Card>
        
        {/* Background and Styling */}
        <Card className="p-4">
          <h3 className="font-medium mb-4">{language === 'ar' ? 'الخلفية' : 'Background'}</h3>
          
          <Tabs defaultValue="color">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="color">{language === 'ar' ? 'لون' : 'Color'}</TabsTrigger>
              <TabsTrigger value="gradient">{language === 'ar' ? 'تدرج' : 'Gradient'}</TabsTrigger>
              <TabsTrigger value="image">{language === 'ar' ? 'صورة' : 'Image'}</TabsTrigger>
              <TabsTrigger value="ai">{language === 'ar' ? 'ذكاء اصطناعي' : 'AI'}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="color">
              <BackgroundSelector type="color" />
            </TabsContent>
            
            <TabsContent value="gradient">
              <BackgroundSelector type="gradient" />
            </TabsContent>
            
            <TabsContent value="image">
              <BackgroundSelector type="image" />
            </TabsContent>
            
            <TabsContent value="ai">
              <BackgroundSelector type="ai" />
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">
                {language === 'ar' ? 'نمط النص' : 'Text Style'}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs block mb-1">
                    {language === 'ar' ? 'لون النص' : 'Text Color'}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {['#FFFFFF', '#000000', '#FF5555', '#55FF55', '#5555FF'].map(color => (
                      <div
                        key={color}
                        className="h-8 w-full rounded-md border cursor-pointer"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs block mb-1">
                    {language === 'ar' ? 'حجم الخط' : 'Font Size'}
                  </label>
                  <Input type="range" min="1" max="3" step="1" defaultValue="2" />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">
                {language === 'ar' ? 'نمط الزر' : 'Button Style'}
              </h4>
              <div className="flex gap-4">
                <Button variant="outline" size="sm" className="rounded-full">
                  {language === 'ar' ? 'مستدير' : 'Rounded'}
                </Button>
                <Button variant="outline" size="sm" className="rounded-none">
                  {language === 'ar' ? 'مربع' : 'Square'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Calendar Integration */}
        <Card className="p-4">
          <h3 className="font-medium mb-4">{language === 'ar' ? 'إضافة إلى التقويم' : 'Add to Calendar'}</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              {language === 'ar' ? 'آبل' : 'Apple'}
            </Button>
            <Button variant="outline" size="sm">
              {language === 'ar' ? 'جوجل' : 'Google'}
            </Button>
            <Button variant="outline" size="sm">
              {language === 'ar' ? 'أوتلوك' : 'Outlook'}
            </Button>
            <Button variant="outline" size="sm">
              {language === 'ar' ? 'واكتي' : 'WAKTI'}
            </Button>
          </div>
        </Card>
        
        {/* Preview and Submit Buttons */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" type="button">
            {language === 'ar' ? 'معاينة الفعالية' : 'Preview Event'}
          </Button>
          <Button type="submit">
            {language === 'ar' ? 'إنشاء الفعالية' : 'Create Event'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EventCreate;
