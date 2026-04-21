import React, { createContext, useContext } from "react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type UnreadContextType = {
  unreadTotal: number;
  taskCount: number;
  maw3dEventCount: number;
  contactCount: number;
  sharedTaskCount: number;
  perContactUnread: Record<string, number>;
  refetch: () => void;
};

const defaultUnreadContext: UnreadContextType = {
  unreadTotal: 0,
  taskCount: 0,
  maw3dEventCount: 0,
  contactCount: 0,
  sharedTaskCount: 0,
  perContactUnread: {},
  refetch: () => {},
};

const UnreadContext = createContext<UnreadContextType>(defaultUnreadContext);

export const useUnreadContext = () => useContext(UnreadContext);

interface UnreadProviderProps {
  children: React.ReactNode;
}

export function UnreadProvider({ children }: UnreadProviderProps) {
  const unreadData = useUnreadMessages();

  return (
    <UnreadContext.Provider value={unreadData}>
      {children}
    </UnreadContext.Provider>
  );
}
