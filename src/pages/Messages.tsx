
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { ConversationView } from "@/components/messaging/ConversationView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, PenSquare } from "lucide-react";
import { NewMessageModal } from "@/components/messaging/NewMessageModal";
import { Input } from "@/components/ui/input";

export default function Messages() {
  const { language, theme } = useTheme();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Toggle back to conversation list on mobile
  const handleBackToList = () => {
    setActiveConversation(null);
  };

  return (
    <div className="mobile-container bg-background text-foreground">
      {/* Header for conversations list view */}
      {!activeConversation && (
        <header className="sticky top-0 z-10 flex flex-col bg-background border-b border-border">
          <div className="flex items-center justify-between py-3 px-4">
            <h1 className="text-2xl font-bold text-foreground">
              {t("messaging", language)}
            </h1>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-blue-500 hover:bg-transparent"
              onClick={() => setShowNewMessageModal(true)}
            >
              <PenSquare className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Search bar - moved to top */}
          <div className="px-4 py-2 border-t border-border">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                placeholder={t("searchContacts", language)}
                className="w-full bg-muted text-foreground border-0 rounded-full py-2 pl-10 pr-4 focus:ring-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Select conversation label */}
          <div className="px-4 py-2 text-sm text-muted-foreground bg-muted/30">
            {t("selectConversation", language)}
          </div>
        </header>
      )}

      {/* Header for conversation view */}
      {activeConversation && (
        <header className="sticky top-0 z-10 flex items-center py-4 px-4 bg-background border-b border-border">
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
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List (hidden on mobile when a conversation is active) */}
        <div className={`flex flex-col w-full md:w-1/3 ${activeConversation ? "hidden md:flex" : "flex"}`}>
          {/* Favorite contacts section removed as requested */}
          
          {/* Conversation list */}
          <ConversationsList 
            onSelectConversation={setActiveConversation} 
            activeConversationId={activeConversation}
            searchQuery={searchQuery}
          />
        </div>

        {/* Active Conversation (full screen on mobile when active) */}
        <div className={`flex-1 ${!activeConversation ? "hidden md:block" : "block"}`}>
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
        onSelectContact={(contactId) => {
          setActiveConversation(contactId);
          setShowNewMessageModal(false);
        }}
      />

      {activeConversation ? null : <MobileNav />}
    </div>
  );
}
