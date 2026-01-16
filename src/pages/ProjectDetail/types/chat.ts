// Chat-related type interfaces for the AI Coder

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  snapshot?: Record<string, string>; // To store project files snapshot for reverting
  toolsUsed?: string[];
  thinkingDuration?: number;
}

export interface ImageAttachment {
  file: File;
  preview: string;
  pdfDataUrl?: string;
}

export interface AIError {
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  severity: 'error' | 'warning' | 'info';
  technicalDetails?: string;
  suggestedAction?: string;
  suggestedActionAr?: string;
}

export type DeviceView = 'desktop' | 'tablet' | 'mobile';
export type LeftPanelMode = 'chat' | 'code';
export type MainTab = 'builder' | 'server';
export type RightPanelMode = 'preview' | 'code' | 'both';
export type MobileTab = 'chat' | 'preview';
