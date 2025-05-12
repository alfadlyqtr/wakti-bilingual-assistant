
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { ConversationView } from "@/components/messaging/ConversationView";
import { Button } from "@/components/ui/button";
import { PlusCircle, ArrowLeft, Search, Mic } from "lucide-react";
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
      <header className="mobile-header border-b border-zinc-800">
        {!activeConversation ? (
          <>
            <h1 className="text-2xl font-bold text-white">{t("messaging", language)}</h1>
            <UserMenu userName="John Doe" />
          </>
        ) : (
          <div className="flex items-center w-full">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-blue-500"
              onClick={handleBackToList}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-normal text-white ml-2">{activeConversation}</h1>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List (hidden on mobile when a conversation is active) */}
        <div className={`flex flex-col w-full md:w-1/3 border-r border-zinc-800 ${activeConversation ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-zinc-800">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <Input
                placeholder={t("searchContacts", language)}
                className="pl-10 bg-zinc-800/70 border-0 rounded-full text-white placeholder:text-zinc-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute right-1 top-1 text-zinc-400"
              >
                <Mic className="h-5 w-5" />
              </Button>
            </div>
            <Button 
              onClick={() => setShowNewMessageModal(true)} 
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              {t("newMessage", language)}
            </Button>
          </div>
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

      <MobileNav />
    </div>
  );
}
