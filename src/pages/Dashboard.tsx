
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranslationKey } from "@/utils/translationTypes";

export default function Dashboard() {
  const { language } = useTheme();
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);

  // Example widgets (will be enhanced and made dynamic later)
  const widgets = [
    {
      id: "tasks",
      title: "tasks" as TranslationKey,
      component: (
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-yellow-400 mr-2"></div>
            <span className="text-sm">Complete project proposal</span>
          </div>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-red-500 mr-2"></div>
            <span className="text-sm">Call with client</span>
          </div>
        </div>
      ),
    },
    {
      id: "calendar",
      title: "calendar" as TranslationKey,
      component: (
        <div className="text-sm">
          <div className="font-medium">Today</div>
          <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
              <div>Team Meeting</div>
              <div className="text-muted-foreground">3:00 PM</div>
            </div>
            <div className="flex justify-between items-center">
              <div>Project Review</div>
              <div className="text-muted-foreground">5:30 PM</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "reminders",
      title: "reminders" as TranslationKey,
      component: (
        <div className="text-sm">
          <div className="flex justify-between items-center mb-1">
            <div>Submit weekly report</div>
            <div className="text-muted-foreground">Tomorrow</div>
          </div>
          <div className="flex justify-between items-center">
            <div>Team lunch</div>
            <div className="text-muted-foreground">Friday</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <h1 className="text-2xl font-bold">{t("dashboard", language)}</h1>
        <UserMenu userName="John Doe" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {/* Trial Timer */}
        {trialDaysLeft > 0 && (
          <Card className="mb-4 bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">
                    {t("freeTrialDays", language)}:
                  </p>
                  <p className="text-xl font-bold">{trialDaysLeft} days left</p>
                </div>
                <Button size="sm">Upgrade</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Widgets */}
        <div className="space-y-4">
          {widgets.map((widget) => (
            <Card key={widget.id} className="shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-lg">
                  {t(widget.title, language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">{widget.component}</CardContent>
            </Card>
          ))}

          {/* Daily Quote */}
          <Card className="shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-lg">Daily Quote</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-sm italic">
                "The secret of getting ahead is getting started."
              </p>
              <p className="text-xs text-muted-foreground mt-1">- Mark Twain</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileNav />
    </div>
  );
}
