
import React from "react";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";

export default function Tasks() {
  return (
    <div className="mobile-container">
      <TasksAndReminders showReminders={false} />
    </div>
  );
}
