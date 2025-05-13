
export type AIMode = "general" | "writer" | "creative" | "assistant";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: AIMode;
  timestamp: Date;
  needsConfirmation?: {
    type: string;
    action: string;
    data?: any;
  } | null;
}

export interface AssistantMode {
  id: AIMode;
  name: string;
  description: string;
  color: {
    dark: string;
    light: string;
  };
  features: string[];
}

export const ASSISTANT_MODES: AssistantMode[] = [
  {
    id: "general",
    name: "General",
    description: "General chat, tutoring, translation",
    color: {
      dark: "#858384",
      light: "#060541"
    },
    features: ["answer", "translate", "explain", "grammar", "help"]
  },
  {
    id: "writer",
    name: "Writer",
    description: "Smart text + content generator",
    color: {
      dark: "#fcfefd",
      light: "#e9ceb0"
    },
    features: ["email", "post", "tone", "extract"]
  },
  {
    id: "creative",
    name: "Creative",
    description: "Visual & chart generator",
    color: {
      dark: "#e9ceb0",
      light: "#606062"
    },
    features: ["image", "chart", "enhance", "background"]
  },
  {
    id: "assistant",
    name: "Assistant",
    description: "Direct connection to WAKTI features",
    color: {
      dark: "#0c0f14",
      light: "#060541"
    },
    features: ["task", "reminder", "event", "calendar"]
  }
];
