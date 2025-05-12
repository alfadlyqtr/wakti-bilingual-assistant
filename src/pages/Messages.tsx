
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { ConversationsList } from "@/components/messaging/ConversationsList";
import { ConversationView } from "@/components/messaging/ConversationView";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { NewMessageModal } from "@/components/messaging/NewMessageModal";

export default function Messages() {
  const { language } = useTheme();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);

  // Toggle back to conversation list on mobile
  const handleBackToList = () => {
    setActiveConversation(null);
  };

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <h1 className="text-2xl font-bold">{t("messaging", language)}</h1>
        <UserMenu userName="John Doe" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List (hidden on mobile when a conversation is active) */}
        <div className={`flex flex-col w-full md:w-1/3 border-r ${activeConversation ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b">
            <Button 
              onClick={() => setShowNewMessageModal(true)} 
              className="w-full flex items-center justify-center"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              {t("newMessage", language)}
            </Button>
          </div>
          <ConversationsList 
            onSelectConversation={setActiveConversation} 
            activeConversationId={activeConversation} 
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

      <MobileNav />
    </div>
  );
}
