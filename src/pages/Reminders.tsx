
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { TasksAndReminders } from "@/components/tasks/TasksAndReminders";

export default function Reminders() {
  return (
    <div className="mobile-container">
      <TasksAndReminders showTasks={false} />
      <Toaster />
    </div>
  );
}
