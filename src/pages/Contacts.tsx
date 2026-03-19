import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactSearch } from "@/components/contacts/ContactSearch";
import { ContactRequests } from "@/components/contacts/ContactRequests";
import { ContactList } from "@/components/contacts/ContactList";
import { BlockedUsers } from "@/components/contacts/BlockedUsers";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Contact, Bell, ShieldCheck } from "lucide-react";
import { getPendingRequestsCount } from "@/services/contactsService";
import { getAllUnreadCounts } from "@/services/messageService";

// Create a client
const queryClient = new QueryClient();

export default function Contacts() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState("contacts");
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get openChat param from URL (for deep linking from push notifications)
  const openChatUserId = searchParams.get('openChat');

  return (
    <QueryClientProvider client={queryClient}>
      <ContactsContent 
        language={language} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        openChatUserId={openChatUserId}
        clearOpenChat={() => {
          searchParams.delete('openChat');
          setSearchParams(searchParams);
        }}
      />
    </QueryClientProvider>
  );
}

// Separate component to use React Query hooks — also exported for embedding
export function ContactsContent({ 
  language, 
  activeTab, 
  setActiveTab,
  openChatUserId = null,
  clearOpenChat = () => {}
}: { 
  language: string; 
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openChatUserId?: string | null;
  clearOpenChat?: () => void;
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

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="flex flex-col p-4 pb-24">
      <Tabs 
        defaultValue={activeTab} 
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 mb-4 h-10 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border-0">
          <TabsTrigger value="contacts" className="rounded-xl text-xs font-bold text-foreground/50 data-[state=active]:bg-[hsl(210,100%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex gap-1.5 items-center justify-center">
            <Contact className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'الأصدقاء' : t("contacts", language)}</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl text-xs font-bold text-foreground/50 data-[state=active]:bg-[hsl(142,76%,45%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex gap-1.5 items-center justify-center">
            <Bell className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'الطلبات' : t("requests", language)}</span>
            {pendingRequestsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-0.5 flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="rounded-xl text-xs font-bold text-foreground/50 data-[state=active]:bg-[hsl(25,95%,55%)] data-[state=active]:text-white data-[state=active]:shadow-none transition-all flex gap-1.5 items-center justify-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{language === 'ar' ? 'المحظورون' : t("blocked", language)}</span>
          </TabsTrigger>
        </TabsList>

        <ContactSearch />
        
        <TabsContent value="contacts" className="space-y-4 mt-4 animate-fade-in">
          <ContactList 
            perContactUnread={perContactUnread}
            refetchUnreadCounts={refetchUnreadCounts}
            openChatUserId={openChatUserId}
            clearOpenChat={clearOpenChat}
          />
        </TabsContent>
        
        <TabsContent value="requests" className="space-y-4 animate-fade-in">
          <ContactRequests />
        </TabsContent>
        
        <TabsContent value="blocked" className="space-y-4 animate-fade-in">
          <BlockedUsers onUnblockSuccess={handleUnblockSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
