
import { AIMode } from "@/components/ai-assistant/types";

// Memory interface to store conversation context
interface PromptMemory {
  lastPrompt: string | null;
  lastMode: AIMode | null;
  lastImagePrompt: string | null;
  lastImageUrl: string | null;
  lastAction: string | null;
  timestamp: number;
}

// Intent detection result interface
export interface IntentDetection {
  intent: string;
  confidence: number;
  suggestedMode: AIMode | null;
  action?: string;
  needsTranslation?: boolean;
  enhancedPrompt?: string;
}

// Initialize memory in localStorage
const MEMORY_KEY = 'wakti_prompt_memory';

// Initialize memory
const initializeMemory = (): PromptMemory => {
  return {
    lastPrompt: null,
    lastMode: null,
    lastImagePrompt: null,
    lastImageUrl: null,
    lastAction: null,
    timestamp: Date.now()
  };
};

// Get memory from localStorage
export const getMemory = (): PromptMemory => {
  try {
    const storedMemory = localStorage.getItem(MEMORY_KEY);
    if (!storedMemory) return initializeMemory();
    
    const memory = JSON.parse(storedMemory) as PromptMemory;
    
    // Check if memory is older than 30 minutes
    if (Date.now() - memory.timestamp > 1800000) {
      return initializeMemory();
    }
    
    return memory;
  } catch (error) {
    console.error('Error retrieving prompt memory:', error);
    return initializeMemory();
  }
};

// Update memory
export const updateMemory = (updates: Partial<PromptMemory>): void => {
  try {
    const currentMemory = getMemory();
    const updatedMemory = {
      ...currentMemory,
      ...updates,
      timestamp: Date.now()
    };
    
    localStorage.setItem(MEMORY_KEY, JSON.stringify(updatedMemory));
  } catch (error) {
    console.error('Error updating prompt memory:', error);
  }
};

// Pattern matching for Arabic text
export const containsArabic = (text: string): boolean => {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
};

// Check if text refers to previous action
export const isReferringToPrevious = (text: string): boolean => {
  const lowerText = text.toLowerCase().trim();
  
  const englishPatterns = [
    'try again', 'do it again', 'once more', 'one more time', 'make it better',
    'another one', 'improve it', 'regenerate', 'redo', 'retry', 'do that again',
    'make another', 'can you try again', 'do the same'
  ];
  
  const arabicPatterns = [
    'حاول مرة أخرى', 'مرة أخرى', 'أعد المحاولة', 'حاول مجدداً',
    'كرر', 'جرب ثانية', 'مرة ثانية', 'تحسين'
  ];
  
  return englishPatterns.some(pattern => lowerText.includes(pattern)) ||
         arabicPatterns.some(pattern => lowerText.includes(pattern));
};

// Enhanced image prompt function
export const enhanceImagePrompt = (originalPrompt: string): string => {
  if (!originalPrompt) return "beautiful abstract artwork";
  
  // Add enhancement details to make image generation more successful
  const enhancementPhrases = [
    "high quality, detailed",
    "professional photography style",
    "vibrant colors",
    "8K resolution",
    "masterpiece"
  ];
  
  // Check if prompt already has enhancement words
  const hasEnhancement = enhancementPhrases.some(phrase => 
    originalPrompt.toLowerCase().includes(phrase.toLowerCase())
  );
  
  if (hasEnhancement) {
    return originalPrompt;
  }
  
  // Add random enhancement
  const randomEnhancement = enhancementPhrases[Math.floor(Math.random() * enhancementPhrases.length)];
  
  return `${originalPrompt}, ${randomEnhancement}`;
};

// Unified intent detection
export const detectIntent = (text: string): IntentDetection => {
  if (!text) {
    return { 
      intent: "general_chat", 
      confidence: 1.0, 
      suggestedMode: "general" 
    };
  }
  
  const lowerText = text.toLowerCase().trim();
  const memory = getMemory();
  const hasArabic = containsArabic(text);
  
  // Check for references to previous actions
  if (isReferringToPrevious(text)) {
    if (memory.lastPrompt) {
      const intent: IntentDetection = {
        intent: memory.lastAction || "general_chat",
        confidence: 0.9,
        suggestedMode: memory.lastMode || "general",
        enhancedPrompt: memory.lastPrompt
      };
      
      if (memory.lastAction === "image_generation" && memory.lastImagePrompt) {
        intent.intent = "image_generation";
        intent.enhancedPrompt = memory.lastImagePrompt;
        intent.suggestedMode = "creative";
      }
      
      return intent;
    }
  }
  
  // Image generation
  const imageKeywords = [
    'draw', 'image', 'picture', 'create image', 'generate image', 
    'show me a', 'visualize', 'render', 'portrait', 'painting',
    'صورة', 'رسم', 'أرسم', 'إنشاء صورة', 'توليد صورة', 'تصور'
  ];
  
  if (imageKeywords.some(keyword => lowerText.includes(keyword))) {
    return {
      intent: "image_generation",
      confidence: 0.9,
      suggestedMode: "creative",
      needsTranslation: hasArabic,
      enhancedPrompt: text
    };
  }
  
  // Task creation
  const taskKeywords = [
    'create task', 'add task', 'remind me', 'set reminder', 'make a task',
    'schedule', 'add to calendar', 'appointment', 'create event',
    'إنشاء مهمة', 'أضف مهمة', 'ذكرني', 'ضبط تذكير', 'موعد', 'جدول'
  ];
  
  if (taskKeywords.some(keyword => lowerText.includes(keyword))) {
    return {
      intent: "task_creation",
      confidence: 0.85,
      suggestedMode: "assistant"
    };
  }
  
  // Writing assistance
  const writingKeywords = [
    'write', 'draft', 'compose', 'email', 'letter', 'essay',
    'poem', 'story', 'summarize', 'rewrite', 'edit',
    'اكتب', 'صياغة', 'رسالة', 'ملخص', 'قصة', 'مقال'
  ];
  
  if (writingKeywords.some(keyword => lowerText.includes(keyword))) {
    return {
      intent: "writing",
      confidence: 0.8,
      suggestedMode: "writer"
    };
  }
  
  // Default to general chat
  return {
    intent: "general_chat",
    confidence: 0.7,
    suggestedMode: null
  };
};

// Preprocess prompt based on intent and context
export const preprocessPrompt = (prompt: string, currentMode: AIMode): string => {
  if (!prompt) return prompt;
  
  const intent = detectIntent(prompt);
  
  if (intent.enhancedPrompt) {
    return intent.enhancedPrompt;
  }
  
  return prompt;
};

// Handle mode-specific prompt processing
export function processPromptForMode(prompt: string, mode: AIMode): string {
  switch (mode) {
    case 'creative':
      if (prompt.split(' ').length < 5) {
        return `${prompt} in high detail with realistic lighting and shadows`;
      }
      return prompt;
    case 'writer':
    case 'assistant':
    case 'general':
    default:
      return prompt;
  }
}

// Export unified brain interface
export const promptBrain = {
  detectIntent,
  preprocessPrompt,
  containsArabic,
  isReferringToPrevious,
  getMemory,
  updateMemory,
  processPromptForMode,
  enhanceImagePrompt
};

export default promptBrain;
