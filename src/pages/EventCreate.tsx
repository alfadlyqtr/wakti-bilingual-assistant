
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import EventCreate from "@/components/events/EventCreate";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";

export default function EventCreatePage() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader title={language === 'ar' ? 'إنشاء فعالية' : 'Create Event'} showBackButton={true} />
      <div className="flex-1 overflow-y-auto">
        <EventCreate />
      </div>
      <MobileNav />
    </div>
  );
}
