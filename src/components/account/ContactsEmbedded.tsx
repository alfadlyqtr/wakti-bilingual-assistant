import React from "react";
import { ContactsContent } from "@/pages/Contacts";

export function ContactsEmbedded({ language }: { language: string }) {
  const [activeTab, setActiveTab] = React.useState('contacts');
  return (
    <ContactsContent
      language={language}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
}
