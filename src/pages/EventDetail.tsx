
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import EventView from "@/components/events/EventView";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";

export default function EventDetailPage() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader title={t("eventDetail", language)} showBackButton={true} />
      <div className="flex-1 overflow-y-auto">
        <EventView />
      </div>
      <MobileNav />
    </div>
  );
}
