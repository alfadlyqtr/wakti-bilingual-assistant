
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
  originalInput?: string;
  actionButtons?: {
    primary?: {
      text: string;
      action: string;
    };
    secondary?: {
      text: string;
      action: string;
    };
  };
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
      light: "#33C3F0"   // Soft blue in light mode
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
      dark: "#D946EF",  // Purplish-pink for dark mode
      light: "#7E69AB"  // Secondary purple for light mode
    },
    icon: "LifeBuoy"
  }
];

export const MODE_NAME_MAP: Record<AIMode, string> = {
  "general": "Chat",
  "writer": "Type",
  "creative": "Create",
  "assistant": "Plan"
};

// Map between mode types and their common intent patterns
export const MODE_INTENTS = {
  general: [
    "tell me about", "what is", "explain", "how to", "define", "answer", 
    "question", "information", "help me understand"
  ],
  writer: [
    "write", "draft", "edit", "compose", "rephrase", "summarize", 
    "paragraph", "essay", "text", "document", "story", "email"
  ],
  creative: [
    "image", "picture", "design", "draw", "create visual", "logo", "graphic", 
    "chart", "diagram", "visualization", "generate image", "art"
  ],
  assistant: [
    "task", "reminder", "event", "schedule", "plan", "organize", 
    "meeting", "appointment", "todo", "deadline", "project"
  ]
};
