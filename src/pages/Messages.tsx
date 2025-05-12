
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { ConversationView } from "@/components/messaging/ConversationView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Mic, ChevronRight, PenSquare } from "lucide-react";
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
    <div className="mobile-container bg-black text-white">
      {/* Header for conversations list view */}
      {!activeConversation && (
        <header className="sticky top-0 z-10 flex items-center justify-between py-3 px-4 bg-black">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-500 hover:bg-transparent p-0"
            >
              <span className="text-sm font-medium">{t("filters", language)}</span>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-white absolute left-1/2 transform -translate-x-1/2">
            {t("messaging", language)}
          </h1>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-blue-500 hover:bg-transparent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-blue-500 hover:bg-transparent"
              onClick={() => setShowNewMessageModal(true)}
            >
              <PenSquare className="h-5 w-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Header for conversation view */}
      {activeConversation && (
        <header className="sticky top-0 z-10 flex items-center justify-between py-4 px-4 bg-black border-b border-zinc-800">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-blue-500 hover:bg-transparent mr-1"
              onClick={handleBackToList}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center justify-center">
              <h1 className="text-lg font-normal">{activeConversation}</h1>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-blue-500 hover:bg-transparent pl-1"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List (hidden on mobile when a conversation is active) */}
        <div className={`flex flex-col w-full md:w-1/3 ${activeConversation ? "hidden md:flex" : "flex"}`}>
          {/* Search bar */}
          <div className="px-4 py-2 bg-black">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-500" />
              </div>
              <Input
                placeholder={t("searchContacts", language)}
                className="w-full bg-zinc-800 text-white border-0 rounded-full py-2 pl-10 pr-4 focus:ring-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <Mic className="h-4 w-4 text-zinc-500" />
              </div>
            </div>
          </div>
          
          {/* Favorites section with circular avatars */}
          <div className="px-4 py-3 bg-black">
            <div className="flex justify-around">
              {["Family", "Hasan", "Doha Fair"].map((name) => (
                <div 
                  key={name}
                  className="flex flex-col items-center gap-1"
                  onClick={() => setActiveConversation(name)}
                >
                  <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center text-xl">
                    {name.charAt(0)}
                  </div>
                  <span className="text-xs">{name}</span>
                </div>
              ))}
            </div>
          </div>
          
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
            <div className="hidden md:flex h-full items-center justify-center text-zinc-500">
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
