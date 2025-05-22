
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ContactList } from "@/components/messaging/ContactList";
import { DirectMessageView } from "@/components/messaging/DirectMessageView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, PenSquare } from "lucide-react";
import { NewMessageModal } from "@/components/messaging/NewMessageModal";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Create a client
const queryClient = new QueryClient();

export default function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string>("");
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check URL for contact ID
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contactId = params.get('contact');
    
    if (contactId) {
      setActiveContactId(contactId);
      fetchContactName(contactId);
    }
  }, [location.search]);

  // Fetch contact name
  const fetchContactName = async (contactId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", contactId)
        .single();
      
      if (data) {
        setContactName(data.display_name || data.username || "");
      }
    } catch (error) {
      console.error("Error fetching contact name:", error);
    }
  };

  // Toggle back to contact list on mobile
  const handleBackToList = () => {
    setActiveContactId(null);
    navigate('/messages');
  };

  // Handle selecting a contact
  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    navigate(`/messages?contact=${contactId}`);
    fetchContactName(contactId);
  };

  // Custom header content for message view
  const renderMessageHeader = () => {
    if (!activeContactId) return null;
    
    return (
      <header className="sticky top-0 z-20 flex items-center py-4 px-4 bg-background border-b border-border w-full">
        <Button 
          variant="ghost" 
          size="icon"
          className="text-blue-500 hover:bg-transparent mr-2"
          onClick={handleBackToList}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 bg-muted rounded-full mr-2 flex items-center justify-center">
            {contactName?.charAt(0) || activeContactId.charAt(0)}
          </div>
          <h1 className="text-lg font-medium">{contactName || activeContactId}</h1>
        </div>
      </header>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Search bar - at top */}
        {!activeContactId && (
          <div className="px-4 py-2 w-full">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                placeholder={t("searchMessages", language)}
                className="w-full bg-muted text-foreground border-0 rounded-full py-2 pl-10 pr-4 focus:ring-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-blue-500 hover:bg-transparent"
                onClick={() => setShowNewMessageModal(true)}
              >
                <PenSquare className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Active Message Header */}
        {activeContactId && renderMessageHeader()}

        {/* Main content with proper padding to accommodate navigation */}
        <div className="flex flex-1 overflow-hidden w-full pb-16">
          {/* Contact List (hidden on mobile when a contact is active) */}
          <div className={`flex flex-col w-full md:w-1/3 ${activeContactId ? "hidden md:flex" : "flex"}`}>
            <ContactList 
              onSelectContact={handleSelectContact} 
              activeContactId={activeContactId}
              searchQuery={searchQuery}
            />
          </div>

          {/* Active Message (full screen on mobile when active) */}
          <div className={`flex-1 ${!activeContactId ? "hidden md:block" : "block"} h-full`}>
            {activeContactId ? (
              <DirectMessageView 
                contactId={activeContactId} 
                onBack={handleBackToList}
              />
            ) : (
              <div className="hidden md:flex h-full items-center justify-center text-muted-foreground">
                <p>{t("selectContact", language)}</p>
              </div>
            )}
          </div>
        </div>

        {/* New Message Modal */}
        <NewMessageModal 
          isOpen={showNewMessageModal} 
          onClose={() => setShowNewMessageModal(false)}
          onSelectContact={(contactId) => {
            handleSelectContact(contactId);
            setShowNewMessageModal(false);
          }}
        />
      </div>
    </QueryClientProvider>
  );
}
