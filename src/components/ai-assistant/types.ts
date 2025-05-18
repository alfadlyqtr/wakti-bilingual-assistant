export type AIMode = "general" | "writer" | "creative" | "assistant";

export const ASSISTANT_MODES = [
  {
    id: "general",
    label: {
      en: "General",
      ar: "عام",
    },
    color: {
      light: "#78716c",
      dark: "#a8a29e",
    },
  },
  {
    id: "writer",
    label: {
      en: "Writer",
      ar: "كاتب",
    },
    color: {
      light: "#eab308",
      dark: "#fde047",
    },
  },
  {
    id: "creative",
    label: {
      en: "Creative",
      ar: "مبدع",
    },
    color: {
      light: "#db2777",
      dark: "#f472b6",
    },
  },
  {
    id: "assistant",
    label: {
      en: "Assistant",
      ar: "مساعد",
    },
    color: {
      light: "#10b981",
      dark: "#6ee7b7",
    },
  },
];

export interface ActionButton {
  text: string;
  action: string;
}

export interface ActionButtons {
  primary?: ActionButton;
  secondary?: ActionButton;
}

export interface ModeSwitchAction {
  targetMode: AIMode;
  action: string;
  autoTrigger?: boolean;
  prompt?: string;
}

// Update modal actions to include the directGeneration property
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  mode: AIMode;
  metadata?: any;
  isLoading?: boolean;
  actionButtons?: ActionButtons;
  originalPrompt?: string;
  modeSwitchAction?: ModeSwitchAction;
}

export interface ImageMetadata {
  imageUrl?: string;
  hasMedia?: boolean;
  intentData?: {
    directGeneration?: boolean;
    [key: string]: any;
  };
}
