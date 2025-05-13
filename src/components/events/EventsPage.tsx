
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import EventCreate from './EventCreate';
import EventList from './EventList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EventsPage: React.FC = () => {
  const { language } = useTheme();
  
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="list" className="w-full flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="list">{t("events", language)}</TabsTrigger>
          <TabsTrigger value="create">{t("create", language) + " " + t("event", language)}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="flex-1 overflow-y-auto">
          <EventList />
        </TabsContent>
        
        <TabsContent value="create" className="flex-1 overflow-y-auto">
          <EventCreate />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EventsPage;
