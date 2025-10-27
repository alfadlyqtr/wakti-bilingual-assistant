// Shared TypeScript types for Supabase Edge Functions
// Keep minimal but precise to remove explicit `any` usage while avoiding runtime changes.

// ---- Common / Language ----
export type Language = 'en' | 'ar';

export interface ExecuteActionResult {
  success: boolean;
  message: string;
  imageUrl?: string;
  error?: string;
}

// ---- Execute Action: Inputs ----
export interface CreateTaskData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
}

export interface CreateEventData {
  title?: string;
  description?: string;
  startTime?: string; // ISO string
  endTime?: string;   // ISO string
  location?: string;
}

export interface CreateReminderData {
  title?: string;
  dueDate?: string | null; // ISO string
}

export interface AddContactData {
  name: string;
  email?: string;
  phone?: string;
}

export interface GenerateImageData {
  prompt: string;
}

export type Action =
  | { type: 'create_task'; data: CreateTaskData }
  | { type: 'create_event'; data: CreateEventData }
  | { type: 'create_reminder'; data: CreateReminderData }
  | { type: 'add_contact'; data: AddContactData }
  | { type: 'generate_image'; data?: GenerateImageData; prompt?: string };

export interface ExecuteActionRequest {
  action: Action;
  userId: string;
  language: Language;
}

// ---- Attachments / AI Messages ----
export interface Attachment {
  name: string;
  type: string; // MIME type
  content: string; // base64 or text
}

export interface ContentPartText {
  type: 'text';
  text: string;
}

export interface ContentPartImageUrl {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export type AIContent = string | Array<ContentPartText | ContentPartImageUrl>;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: AIContent;
}

export type ActiveTrigger = 'chat' | 'search';

// ---- Search (Tavily) ----
export interface SearchResultItem {
  title?: string;
  content?: string;
  url?: string;
}

export interface SearchAPIData {
  answer?: string;
  results: SearchResultItem[];
  query: string;
  total_results: number;
}

export interface RegularSearchResponse {
  success: boolean;
  error: string | null;
  data: SearchAPIData | null;
  context: string;
  details?: string;
}

// ---- Runware Image API ----
export interface RunwareAuthTask {
  taskType: 'authentication';
  apiKey: string;
}

export interface RunwareImageTask {
  taskType: 'imageInference';
  taskUUID: string;
  imageURL?: string;
  imageUUID?: string;
  [key: string]: unknown;
}

export interface RunwareResponse {
  data?: Array<RunwareImageTask | Record<string, unknown>>;
}

// ---- OpenAI/DeepSeek Streaming ----
export interface OpenAIStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

// ---- Payments / Vision ----
export type PlanType = 'monthly' | 'yearly' | string;

export interface PendingFawranPayment {
  id: string;
  user_id: string;
  email?: string | null;
  amount: number;
  plan_type: PlanType;
  screenshot_url?: string | null;
  submitted_at: string; // ISO
  sender_alias?: string | null;
}

export interface VisionFindings {
  amount_found: number | null;
  amount_mismatch: boolean;
  sender_info: string | null;
  timestamp_visible: boolean;
  tampered_detected: boolean;
  authenticity_score: number;
}

// Keep as a simple shape for easy optional access in existing code
export interface VisionAnalysis {
  success: boolean;
  findings?: VisionFindings;
  confidence_score: number;
  raw_analysis?: string;
  error?: string;
}

export interface PaymentAnalysisResult {
  paymentValid: boolean;
  amount?: number;
  senderAlias?: string;
  referenceNumber?: string;
  timeValidationPassed: boolean;
  tamperingDetected: boolean;
  duplicateDetected: boolean;
  confidence: number;
  issues: string[];
  visionAnalysis?: VisionAnalysis;
}
