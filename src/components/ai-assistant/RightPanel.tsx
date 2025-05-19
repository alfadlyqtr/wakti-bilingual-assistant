
import { useState, useEffect } from "react";
import { Moon, SunMedium, Save } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { AIMode } from "./types"; 
import ImageGallery from "./ImageGallery";
import { useSettings } from "@/hooks/useSettings";
import { Card, CardContent } from "@/components/ui/card";

interface RightPanelProps {
  userId: string | undefined;
  activeMode: AIMode;
}

export function RightPanel({ userId, activeMode }: RightPanelProps) {
  const { theme, setTheme, language } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { settings } = useSettings();

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-full flex flex-col space-y-4 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {activeMode === "general" && "Chat Assistant"}
          {activeMode === "creative" && "Creative Gallery"}
          {activeMode === "writer" && "Writing Assistant"}
          {activeMode === "assistant" && "Task Assistant"}
        </h2>
        
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="rounded-full transition-colors duration-200"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <SunMedium className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>

      {activeMode === "creative" && userId && (
        <div className="flex-1 overflow-y-auto pr-1">
          <h3 className="text-sm font-medium mb-3">Your Generated Images</h3>
          <ImageGallery userId={userId} />
        </div>
      )}
      
      {activeMode === "assistant" && (
        <div className="flex-1 flex flex-col">
          <h3 className="text-sm font-medium mb-3">Your App Settings</h3>
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="text-sm">
                <h4 className="font-medium mb-2">{language === 'ar' ? 'ظهور الأدوات' : 'Widget Visibility'}</h4>
                <ul className="space-y-1 list-disc pl-4">
                  <li>{language === 'ar' ? 'المهام:' : 'Tasks:'} {settings.widgets.tasksWidget ? '✅' : '❌'}</li>
                  <li>{language === 'ar' ? 'التقويم:' : 'Calendar:'} {settings.widgets.calendarWidget ? '✅' : '❌'}</li>
                  <li>{language === 'ar' ? 'التذكيرات:' : 'Reminders:'} {settings.widgets.remindersWidget ? '✅' : '❌'}</li>
                  <li>{language === 'ar' ? 'الاقتباس:' : 'Quote:'} {settings.widgets.quoteWidget ? '✅' : '❌'}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="text-sm">
                <h4 className="font-medium mb-2">
                  {language === 'ar' ? 'إعدادات الاقتباس' : 'Quote Settings'}
                </h4>
                <p>{language === 'ar' ? 'الفئة:' : 'Category:'} {settings.quotes.category}</p>
                <p>{language === 'ar' ? 'التكرار:' : 'Frequency:'} {settings.quotes.frequency}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {activeMode !== "creative" && activeMode !== "assistant" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>No additional information to show for this mode.</p>
          </div>
        </div>
      )}
    </div>
  );
}
