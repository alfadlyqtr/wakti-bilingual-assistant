
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";

export default function Tasks() {
  return (
    <div className="mobile-container">
      <TasksAndReminders showReminders={false} />
      <Toaster />
    </div>
  );
}
