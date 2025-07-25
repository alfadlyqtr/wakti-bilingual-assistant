
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactSearch } from "@/components/contacts/ContactSearch";
import { ContactRequests } from "@/components/contacts/ContactRequests";
import { ContactList } from "@/components/contacts/ContactList";
import { BlockedUsers } from "@/components/contacts/BlockedUsers";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Contact, Bell, ShieldCheck } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

// Create a client
const queryClient = new QueryClient();

export default function Contacts() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <QueryClientProvider client={queryClient}>
      <ContactsContent language={language} activeTab={activeTab} setActiveTab={setActiveTab} />
    </QueryClientProvider>
  );
}

// Separate component to use React Query hooks
function ContactsContent({ 
  language, 
  activeTab, 
  setActiveTab 
}: { 
  language: string; 
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  // Use unified unread messages system instead of separate query
  const { contactCount } = useUnreadMessages();
  
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
            {contactCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {contactCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="flex gap-2 items-center">
            <ShieldCheck className="h-4 w-4" />
            <span>{t("blocked", language)}</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="contacts" className="space-y-4 animate-fade-in">
          <ContactList />
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
