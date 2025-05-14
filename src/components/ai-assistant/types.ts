
export type AIMode = "general" | "writer" | "creative" | "assistant";

export interface ConfirmationData {
  type: string;
  action: string;
  data?: any;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  mode: AIMode;
  timestamp: Date;
  needsConfirmation?: ConfirmationData | null;
}

export const ASSISTANT_MODES = [
  {
    id: "general",
    name: "General",
    description: "Ask anything and get general assistance",
    color: {
      light: "#060541", // WAKTI light-primary
      dark: "#858384", // WAKTI dark-tertiary
    },
    icon: "message-square",
  },
  {
    id: "writer",
    name: "Writer",
    description: "Create and edit written content",
    color: {
      light: "#e9ceb0", // WAKTI light-secondary
      dark: "#fcfefd", // WAKTI near white for contrast
    },
    icon: "pen-tool",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Generate images and creative content",
    color: {
      light: "#606062", // WAKTI dark-secondary (contrasted for light mode)
      dark: "#e9ceb0", // WAKTI light-secondary
    },
    icon: "palette",
  },
  {
    id: "assistant",
    name: "Assistant",
    description: "Task management and planning",
    color: {
      light: "#060541", // WAKTI light-primary
      dark: "#0c0f14", // WAKTI dark-bg
    },
    icon: "calendar",
  },
];
