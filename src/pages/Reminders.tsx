
import React from "react";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";

export default function Reminders() {
  return (
    <div className="mobile-container">
      <TasksAndReminders showTasks={false} />
    </div>
  );
}
