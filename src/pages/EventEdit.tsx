
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import EventEdit from "@/components/events/EventEdit";

export default function EventEditPage() {
  const { language } = useTheme();
  
  return (
    <div className="flex-1 overflow-y-auto">
      <EventEdit />
    </div>
  );
}
