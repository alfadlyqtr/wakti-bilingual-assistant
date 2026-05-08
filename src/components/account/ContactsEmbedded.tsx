import React from "react";
import { ContactsContent } from "@/pages/Contacts";

export function ContactsEmbedded({ language }: { language: string }) {
  const [activeTab, setActiveTab] = React.useState('contacts');
  const [contactView, setContactView] = React.useState<"contacts" | "cards">('cards');

  const handleContactViewChange = (view: "contacts" | "cards" | "groups") => {
    if (view === "groups") {
      setActiveTab("groups");
      return;
    }

    setContactView(view);
    setActiveTab("contacts");
  };

  return (
    <ContactsContent
      language={language}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      contactView={contactView}
      setContactView={handleContactViewChange}
      embedded
    />
  );
}
