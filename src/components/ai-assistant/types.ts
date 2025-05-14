
export type AIMode = "general" | "writer" | "creative" | "assistant";

export type ChatMessageRole = "user" | "assistant";

export interface NeedsConfirmation {
  type: "mode" | "task" | "event" | "reminder" | "action";
  action: "switchMode" | "createTask" | "createEvent" | "createReminder" | "other";
  data?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  mode: AIMode;
  timestamp: Date;
  needsConfirmation?: NeedsConfirmation | null;
}

export const ASSISTANT_MODES = [
  {
    id: "general",
    name: "Chat",
    description: "General chat and questions",
    color: {
      dark: "#858384",
      light: "#858384"
    },
    icon: "MessageSquare"
  },
  {
    id: "writer",
    name: "Type",
    description: "Create and edit text",
    color: {
      dark: "#fcfefd",
      light: "#fcfefd"
    },
    icon: "Notebook"
  },
  {
    id: "creative",
    name: "Create",
    description: "Image and design creation",
    color: {
      dark: "#e9ceb0",
      light: "#e9ceb0"
    },
    icon: "Palette"
  },
  {
    id: "assistant",
    name: "Plan",
    description: "Task and event management",
    color: {
      dark: "#0c0f14",
      light: "#0c0f14"
    },
    icon: "LifeBuoy"
  }
];
