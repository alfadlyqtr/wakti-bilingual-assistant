
export type AIMode = "general" | "writer" | "creative" | "assistant";

export interface Confirmation {
  type: "mode" | "task" | "event" | "reminder" | "other";
  action: string;
  data?: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: AIMode;
  timestamp: Date;
  needsConfirmation?: Confirmation | null;
}

export const ASSISTANT_MODES = [
  {
    id: "general",
    label: "generalMode",
    description: "generalModeDescription",
    color: {
      dark: "#858384",
      light: "#858384"
    },
    userBubble: {
      dark: "#757373",
      light: "#757373"
    }
  },
  {
    id: "writer",
    label: "writerMode",
    description: "writerModeDescription",
    color: {
      dark: "#fcfefd",
      light: "#fcfefd"
    },
    userBubble: {
      dark: "#ebeaea",
      light: "#ebeaea"
    }
  },
  {
    id: "creative",
    label: "creativeMode",
    description: "creativeModeDescription",
    color: {
      dark: "#e9ceb0",
      light: "#e9ceb0"
    },
    userBubble: {
      dark: "#d4ba9f",
      light: "#d4ba9f"
    }
  },
  {
    id: "assistant",
    label: "assistantMode",
    description: "assistantModeDescription",
    color: {
      dark: "#0c0f14",
      light: "#0c0f14"
    },
    userBubble: {
      dark: "#1e1f21",
      light: "#1e1f21"
    }
  }
];

export const AI_SIDEBAR_LINKS = [
  {
    id: "recent",
    label: "recentChats",
  },
  {
    id: "saved",
    label: "savedChats",
  },
];

export const AI_SIDEBAR_TOOLS = [
  {
    id: "general",
    tools: [
      {
        id: "language", 
        label: "switchLanguage"
      },
      {
        id: "clear",
        label: "clearConversation"
      }
    ]
  },
  {
    id: "writer",
    tools: [
      {
        id: "tone",
        label: "tonePresets"
      },
      {
        id: "length",
        label: "lengthOptions"
      },
      {
        id: "grammar",
        label: "grammarCheck"
      }
    ]
  },
  {
    id: "creative",
    tools: [
      {
        id: "image",
        label: "imageTools"
      },
      {
        id: "chart",
        label: "chartTypes"
      }
    ]
  },
  {
    id: "assistant",
    tools: [
      {
        id: "task",
        label: "createTask"
      },
      {
        id: "reminder",
        label: "createReminder"
      },
      {
        id: "event",
        label: "createEvent"
      },
      {
        id: "calendar",
        label: "viewCalendar"
      }
    ]
  }
];
