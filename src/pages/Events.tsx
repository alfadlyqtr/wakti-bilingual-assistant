
import EventsPage from "@/components/events/EventsPage";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";

export default function Events() {
  return (
    <TaskReminderProvider>
      <EventsPage />
    </TaskReminderProvider>
  );
}
