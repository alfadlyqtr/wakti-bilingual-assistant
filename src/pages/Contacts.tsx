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

// Separate component to use React Query hooks
function ContactsContent({ 
  language, 
  activeTab, 
  setActiveTab,
  openChatUserId,
  clearOpenChat
}: { 
  language: string; 
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openChatUserId: string | null;
  clearOpenChat: () => void;
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
    <div className="flex flex-col p-4 pb-24">
      <ContactSearch />
      
      <Tabs 
        defaultValue={activeTab} 
        value={activeTab}
        className="mt-6"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="contacts" className="flex gap-2 items-center">
            <Contact className="h-4 w-4" />
            <span>{t("contacts", language)}</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex gap-2 items-center">
            <Bell className="h-4 w-4" />
            <span>{t("requests", language)}</span>
            {pendingRequestsCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="flex gap-2 items-center">
            <ShieldCheck className="h-4 w-4" />
            <span>{t("blocked", language)}</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="space-y-4 animate-fade-in">
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
