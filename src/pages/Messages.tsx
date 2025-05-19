
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { ConversationView } from "@/components/messaging/ConversationView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, PenSquare } from "lucide-react";
import { NewMessageModal } from "@/components/messaging/NewMessageModal";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

export default function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useTheme();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check URL for conversation ID
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const conversationId = params.get('conversation');
    
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [location.search]);

  // Toggle back to conversation list on mobile
  const handleBackToList = () => {
    setActiveConversation(null);
    navigate('/messages');
  };

  // Handle selecting a conversation
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId);
    navigate(`/messages?conversation=${conversationId}`);
  };

  // Custom header content for conversation view
  const renderConversationHeader = () => {
    if (!activeConversation) return null;
    
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
            {activeConversation?.charAt(0)}
          </div>
          <h1 className="text-lg font-medium">{activeConversation}</h1>
        </div>
      </header>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex-1 overflow-y-auto pb-16">
        {/* Search bar - at top */}
        {!activeConversation && (
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

        {/* Active Conversation Header */}
        {activeConversation && renderConversationHeader()}

        {/* Main content with proper padding to accommodate navigation */}
        <div className="flex flex-1 overflow-hidden w-full pb-16">
          {/* Conversation List (hidden on mobile when a conversation is active) */}
          <div className={`flex flex-col w-full md:w-1/3 ${activeConversation ? "hidden md:flex" : "flex"}`}>
            <ConversationsList 
              onSelectConversation={handleSelectConversation} 
              activeConversationId={activeConversation}
              searchQuery={searchQuery}
            />
          </div>

          {/* Active Conversation (full screen on mobile when active) */}
          <div className={`flex-1 ${!activeConversation ? "hidden md:block" : "block"} h-full`}>
            {activeConversation ? (
              <ConversationView 
                conversationId={activeConversation} 
                onBack={handleBackToList}
              />
            ) : (
              <div className="hidden md:flex h-full items-center justify-center text-muted-foreground">
                <p>{t("selectConversation", language)}</p>
              </div>
            )}
          </div>
        </div>

        {/* New Message Modal */}
        <NewMessageModal 
          isOpen={showNewMessageModal} 
          onClose={() => setShowNewMessageModal(false)}
          onSelectContact={(conversationId) => {
            handleSelectConversation(conversationId);
            setShowNewMessageModal(false);
          }}
        />
      </div>
    </QueryClientProvider>
  );
}
