
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import EventView from "@/components/events/EventView";

export default function EventDetailPage() {
  const { language } = useTheme();
  
  return (
    <div className="flex-1 overflow-y-auto">
      <EventView />
    </div>
  );
}
