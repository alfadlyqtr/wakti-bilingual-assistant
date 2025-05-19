
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactSearch } from "@/components/contacts/ContactSearch";
import { ContactRequests } from "@/components/contacts/ContactRequests";
import { ContactList } from "@/components/contacts/ContactList";
import { BlockedUsers } from "@/components/contacts/BlockedUsers";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

export default function Contacts() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col p-4 pb-24">
        <ContactSearch />
        
        <Tabs 
          defaultValue="contacts" 
          className="mt-6"
          onValueChange={setActiveTab}
        >
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="contacts">
              {t("contacts", language)}
            </TabsTrigger>
            <TabsTrigger value="requests">
              {t("contactRequestSettings", language)}
            </TabsTrigger>
            <TabsTrigger value="blocked">
              {t("manageBlockedUsers", language)}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="contacts" className="space-y-4 animate-fade-in">
            <ContactList />
          </TabsContent>
          
          <TabsContent value="requests" className="space-y-4 animate-fade-in">
            <ContactRequests />
          </TabsContent>
          
          <TabsContent value="blocked" className="space-y-4 animate-fade-in">
            <BlockedUsers />
          </TabsContent>
        </Tabs>
      </div>
    </QueryClientProvider>
  );
}
