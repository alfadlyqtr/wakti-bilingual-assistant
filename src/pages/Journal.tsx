import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/providers/ThemeProvider";
import { TodayTab } from "@/components/journal/TodayTab";
import { TimelineTab } from "@/components/journal/TimelineTab";
import { ChartsTab } from "@/components/journal/ChartsTab";
import { AskTab } from "@/components/journal/AskTab";
import { NotebookPen } from "lucide-react";

export default function Journal() {
  const { language } = useTheme();
  return (
    <div className="container mx-auto p-3 max-w-3xl">
      <div className="glass-hero px-5 py-4 mb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30 text-pink-400 shadow-md">
          <NotebookPen className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{language === 'ar' ? 'دفتر وقطي' : 'WAKTI Journal'}</h1>
      </div>
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="journal-tabs w-full justify-between">
          <TabsTrigger value="today">{language === 'ar' ? 'اليوم' : 'Today'}</TabsTrigger>
          <TabsTrigger value="timeline">{language === 'ar' ? 'الخط الزمني' : 'Timeline'}</TabsTrigger>
          <TabsTrigger value="charts">{language === 'ar' ? 'الرسوم' : 'Charts'}</TabsTrigger>
          <TabsTrigger value="ask">{language === 'ar' ? 'اسأل' : 'Ask Journal'}</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4"><TodayTab /></TabsContent>
        <TabsContent value="timeline" className="mt-4"><TimelineTab /></TabsContent>
        <TabsContent value="charts" className="mt-4"><ChartsTab /></TabsContent>
        <TabsContent value="ask" className="mt-4"><AskTab /></TabsContent>
      </Tabs>
    </div>
  );
}
