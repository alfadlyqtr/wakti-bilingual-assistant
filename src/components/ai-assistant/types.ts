
import React from "react";

// Available modes for the AI assistant
export type AIMode = "general" | "writer" | "creative" | "assistant";

// Basic structure for chat messages
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode: AIMode;
  isLoading?: boolean;
  metadata?: {
    imageUrl?: string;
    hasMedia?: boolean;
    intentData?: any;
    [key: string]: any;
  };
  actionButtons?: {
    primary?: {
      text: string;
      action: string;
    },
    secondary?: {
      text: string;
      action: string;
    }
  };
  originalPrompt?: string; // Added to store the original prompt for mode switching
  modeSwitchAction?: {
    text: string;
    action: string;
    targetMode: AIMode;
  }; // Added for mode switching functionality
}

// Type for message variables
export interface MessageVariable {
  key: string;
  value: string;
}

// Define mode parameters
interface AssistantMode {
  id: AIMode;
  label: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
  icon: React.ReactNode;
  color: {
    light: string;
    dark: string;
  };
}

// Available modes with their configurations
export const ASSISTANT_MODES: AssistantMode[] = [
  {
    id: "general",
    label: {
      en: "Chat",
      ar: "دردشة",
    },
    description: {
      en: "General conversation and information",
      ar: "محادثة عامة ومعلومات",
    },
    icon: null,
    color: {
      light: "#3498db",
      dark: "#2980b9",
    },
  },
  {
    id: "writer",
    label: {
      en: "Type",
      ar: "كتابة",
    },
    description: {
      en: "Writing, editing and text refinement",
      ar: "الكتابة والتحرير وتحسين النص",
    },
    icon: null,
    color: {
      light: "#2ecc71",
      dark: "#27ae60",
    },
  },
  {
    id: "creative",
    label: {
      en: "Create",
      ar: "إنشاء",
    },
    description: {
      en: "Creative content and image generation",
      ar: "محتوى إبداعي وإنشاء الصور",
    },
    icon: null,
    color: {
      light: "#e74c3c",
      dark: "#c0392b",
    },
  },
  {
    id: "assistant",
    label: {
      en: "Plan",
      ar: "تخطيط",
    },
    description: {
      en: "Task management and scheduling",
      ar: "إدارة المهام والجدولة",
    },
    icon: null,
    color: {
      light: "#9b59b6",
      dark: "#8e44ad",
    },
  },
];
