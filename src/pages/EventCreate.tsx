
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import EventCreate from "@/components/events/EventCreate";

export default function EventCreatePage() {
  const { language } = useTheme();
  
  return (
    <div className="flex-1 overflow-y-auto">
      <EventCreate />
    </div>
  );
}
