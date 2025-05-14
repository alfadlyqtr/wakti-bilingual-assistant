
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
      dark: "#33C3F0",  // Bright blue in dark mode
      light: "#D3E4FD"  // Soft blue in light mode
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
      dark: "#D946EF",  // Magenta pink for dark mode
      light: "#7E69AB"  // Secondary purple for light mode
    },
    icon: "LifeBuoy"
  }
];
