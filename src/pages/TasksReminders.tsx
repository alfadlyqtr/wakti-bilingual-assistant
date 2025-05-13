
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";

export default function TasksReminders() {
  const { language } = useTheme();

  const handleLogoClick = () => {
    window.location.href = '/dashboard';
  };

  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <header className="mobile-header">
          <div className="flex items-center">
            {/* Logo that acts as dashboard link */}
            <img 
              src="/lovable-uploads/b2ccfe85-51b7-4b00-af3f-9919d8b5be57.png" 
              alt="WAKTI Logo" 
              className="h-10 w-10 mr-3 cursor-pointer rounded-md"
              onClick={handleLogoClick}
            />
            <h1 className="text-2xl font-bold">{t("taskAndReminders", language)}</h1>
          </div>
          <UserMenu userName="John Doe" />
        </header>

        <div className="flex-1 overflow-hidden">
          <TasksAndReminders />
        </div>

        <MobileNav />
      </div>
    </TaskReminderProvider>
  );
}
