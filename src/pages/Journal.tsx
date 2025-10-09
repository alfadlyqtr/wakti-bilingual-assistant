import React from "react";
import { useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/providers/ThemeProvider";
import { TodayTab } from "@/components/journal/TodayTab";
import { TimelineTab } from "@/components/journal/TimelineTab";
import { ChartsTab } from "@/components/journal/ChartsTab";
import { AskTab } from "@/components/journal/AskTab";
import { NotebookPen } from "lucide-react";

export default function Journal() {
  const { language } = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialTab = (params.get('tab') || 'today') as 'today' | 'timeline' | 'charts' | 'ask';
  return (
    <div className="container mx-auto p-3 max-w-3xl">
      <div className="glass-hero px-5 py-4 mb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30 text-pink-400 shadow-md">
          <NotebookPen className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{language === 'ar' ? 'دفتر اليوميات' : 'WAKTI Journal'}</h1>
      </div>
      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="w-full flex justify-start gap-2 overflow-x-auto px-1">
          <TabsTrigger value="today" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'اليوم' : 'Today'}</TabsTrigger>
          <TabsTrigger value="timeline" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'السجل' : 'Timeline'}</TabsTrigger>
          <TabsTrigger value="charts" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'الإحصائيات' : 'Charts'}</TabsTrigger>
          <TabsTrigger value="ask" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'اسأل' : 'Ask Journal'}</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4"><TodayTab /></TabsContent>
        <TabsContent value="timeline" className="mt-4"><TimelineTab /></TabsContent>
        <TabsContent value="charts" className="mt-4"><ChartsTab /></TabsContent>
        <TabsContent value="ask" className="mt-4"><AskTab /></TabsContent>
      </Tabs>
    </div>
  );
}
