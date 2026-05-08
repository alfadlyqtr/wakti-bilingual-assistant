import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContactSearch } from "@/components/contacts/ContactSearch";
import { ContactRequests } from "@/components/contacts/ContactRequests";
import { ContactList } from "@/components/contacts/ContactList";
import { BlockedUsers } from "@/components/contacts/BlockedUsers";
import { GroupChatTab } from "@/components/contacts/GroupChatTab";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useQuery } from "@tanstack/react-query";
import { Contact, Bell, ShieldCheck, Users, LayoutGrid, LayoutList } from "lucide-react";
import { getPendingRequestsCount } from "@/services/contactsService";
import { getAllUnreadCounts } from "@/services/messageService";

const resolveContactsTab = (searchParams: URLSearchParams) => {
  const nextTab = (searchParams.get("tab") || "contacts").toLowerCase();
  if (["contacts", "requests", "blocked", "groups"].includes(nextTab)) {
    return nextTab;
  }
  return "contacts";
};

const resolveContactsView = (searchParams: URLSearchParams) => {
  const nextView = (searchParams.get("view") || "cards").toLowerCase();
  if (["contacts", "cards"].includes(nextView)) {
    return nextView as "contacts" | "cards";
  }
  return "cards" as const;
};

export default function Contacts() {
  const { language } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = resolveContactsTab(searchParams);
  const initialContactView = resolveContactsView(searchParams);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [contactView, setContactView] = useState<"contacts" | "cards">(initialContactView);
  
  // Get openChat param from URL (for deep linking from push notifications)
  const openChatUserId = searchParams.get('openChat');

  useEffect(() => {
    setActiveTab(resolveContactsTab(searchParams));
    setContactView(resolveContactsView(searchParams));
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    if (tab === "contacts") {
      nextParams.set("view", contactView);
    } else {
      nextParams.delete("view");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleContactViewChange = (view: "contacts" | "cards" | "groups") => {
    const nextParams = new URLSearchParams(searchParams);
    if (view === "groups") {
      setActiveTab("groups");
      nextParams.set("tab", "groups");
      nextParams.delete("view");
      setSearchParams(nextParams, { replace: true });
      return;
    }

    setContactView(view);
    setActiveTab("contacts");
    nextParams.set("tab", "contacts");
    nextParams.set("view", view);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <ContactsContent 
      language={language} 
      activeTab={activeTab} 
      setActiveTab={handleTabChange}
      contactView={contactView}
      setContactView={handleContactViewChange}
      openChatUserId={openChatUserId}
      source="contacts"
      clearOpenChat={() => {
        searchParams.delete('openChat');
        setSearchParams(searchParams, { replace: true });
      }}
    />
  );
}

// Separate component to use React Query hooks — also exported for embedding
export function ContactsContent({ 
  language, 
  activeTab, 
  setActiveTab,
  contactView = "cards",
  setContactView = () => {},
  openChatUserId = null,
  clearOpenChat = () => {},
  embedded = false,
  source = "contacts",
}: { 
  language: string; 
  activeTab: string;
  setActiveTab: (tab: string) => void;
  contactView?: "contacts" | "cards";
  setContactView?: (view: "contacts" | "cards" | "groups") => void;
  openChatUserId?: string | null;
  clearOpenChat?: () => void;
  /** When true, the inner ContactList keeps chat in a modal instead of navigating away. */
  embedded?: boolean;
  source?: "contacts" | "social";
}) {
  // Fetch pending requests count for the badge
  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ['pendingRequestsCount'],
    queryFn: getPendingRequestsCount,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    refetchOnWindowFocus: true,
  });

  // Fetch unread message counts for all contacts
  const { data: perContactUnread = {}, refetch: refetchUnreadCounts } = useQuery({
    queryKey: ['allUnreadCounts'],
    queryFn: getAllUnreadCounts,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // Handler for unblock success
  const handleUnblockSuccess = () => {
    setActiveTab("contacts");
  };

  const isContactsAreaActive = activeTab === "contacts" || activeTab === "groups";

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex flex-col px-2.5 sm:px-4 pb-24 pt-4">
      <div className="grid grid-cols-3 mb-4 h-10 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border-0 w-[calc(100%+0.5rem)] -mx-1 sm:w-full sm:mx-0">
          <button type="button" onClick={() => setActiveTab("contacts")} className={`rounded-xl text-xs font-bold transition-all flex gap-1.5 items-center justify-center ${isContactsAreaActive ? 'bg-[hsl(210,100%,55%)] text-white shadow-none' : 'text-foreground/50'}`}>
            <Contact className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'الأصدقاء' : t("contacts", language)}</span>
          </button>
          <button type="button" onClick={() => setActiveTab("requests")} className={`rounded-xl text-xs font-bold transition-all flex gap-1.5 items-center justify-center ${activeTab === 'requests' ? 'bg-[hsl(142,76%,45%)] text-white shadow-none' : 'text-foreground/50'}`}>
            <Bell className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'الطلبات' : t("requests", language)}</span>
            {pendingRequestsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-0.5 flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setActiveTab("blocked")} className={`rounded-xl text-xs font-bold transition-all flex gap-1.5 items-center justify-center ${activeTab === 'blocked' ? 'bg-[hsl(25,95%,55%)] text-white shadow-none' : 'text-foreground/50'}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'المحظورون' : t("blocked", language)}</span>
          </button>
      </div>

      {isContactsAreaActive && (
        <div className="pb-3">
          <div className="grid grid-cols-3 w-full rounded-full border border-[#e2d8cd] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(243,237,231,0.88))] dark:bg-[linear-gradient(180deg,rgba(24,28,38,0.96),rgba(16,19,27,0.96))] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.26)]">
            <button type="button" onClick={() => setContactView("contacts")} className={`flex min-w-0 items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'contacts' && contactView === 'contacts' ? 'bg-[hsl(210,100%,55%)] text-white shadow-[0_8px_18px_rgba(59,130,246,0.28)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutList className="h-3.5 w-3.5" />
              <span className="truncate">{language === 'ar' ? 'جهات الاتصال' : 'Contacts'}</span>
            </button>
            <button type="button" onClick={() => setContactView("cards")} className={`flex min-w-0 items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'contacts' && contactView === 'cards' ? 'bg-[hsl(25,95%,55%)] text-white shadow-[0_8px_18px_rgba(249,115,22,0.24)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="truncate">{language === 'ar' ? 'بطاقات' : 'Cards'}</span>
            </button>
            <button type="button" onClick={() => setContactView("groups")} className={`flex min-w-0 items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'groups' ? 'bg-[hsl(280,70%,55%)] text-white shadow-[0_8px_18px_rgba(168,85,247,0.24)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <Users className="h-3.5 w-3.5" />
              <span className="truncate">{language === 'ar' ? 'المجموعات' : 'Group Chat'}</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "contacts" && <ContactSearch />}
      
      {activeTab === "contacts" && (
        <div className="space-y-4 mt-4 animate-fade-in">
          <ContactList 
            perContactUnread={perContactUnread}
            refetchUnreadCounts={refetchUnreadCounts}
            openChatUserId={openChatUserId}
            clearOpenChat={clearOpenChat}
            embedded={embedded}
            source={source}
            viewMode={contactView}
            showViewToggle={false}
          />
        </div>
      )}
      
      {activeTab === "requests" && (
        <div className="space-y-4 animate-fade-in">
          <ContactRequests />
        </div>
      )}
      
      {activeTab === "blocked" && (
        <div className="space-y-4 animate-fade-in">
          <BlockedUsers onUnblockSuccess={handleUnblockSuccess} />
        </div>
      )}

      {activeTab === "groups" && (
        <div className="space-y-4 animate-fade-in">
          <GroupChatTab embedded={embedded} source={source} />
        </div>
      )}
    </div>
  );
}
