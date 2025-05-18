
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
  intent: string; // Type of action: image_generation, task_creation, writing, general_chat
  confidence: number; // 0-1 confidence score
  suggestedMode: AIMode | null;
  action?: string; // Suggested action
  needsTranslation?: boolean; // Whether prompt needs translation (Arabic)
  enhancedPrompt?: string; // Rewritten prompt if vague
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
    
    // Check if memory is older than 30 minutes (1800000 ms)
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
  
  // English patterns
  const englishPatterns = [
    'try again',
    'do it again',
    'once more',
    'one more time',
    'make it better',
    'another one',
    'improve it',
    'regenerate',
    'redo',
    'retry',
    'do that again',
    'make another',
    'can you try again',
    'do the same',
  ];
  
  // Arabic patterns for "try again", "once more", etc.
  const arabicPatterns = [
    'حاول مرة أخرى',
    'مرة أخرى',
    'أعد المحاولة',
    'حاول مجدداً',
    'كرر',
    'جرب ثانية',
    'مرة ثانية',
    'تحسين',
  ];
  
  // Check if text matches any pattern
  return englishPatterns.some(pattern => lowerText.includes(pattern)) ||
         arabicPatterns.some(pattern => lowerText.includes(pattern));
};

// Check if text is a vague image request
export const isVagueImageRequest = (text: string): boolean => {
  const lowerText = text.toLowerCase().trim();
  
  // English vague patterns
  const vagueEnglishPatterns = [
    'draw something',
    'create an image',
    'make a picture',
    'generate an image',
    'show me an image',
    'draw me',
    'create art',
  ];
  
  // Arabic vague patterns
  const vagueArabicPatterns = [
    'ارسم شيئا',
    'أرسم شيء',
    'صورة',
    'إنشاء صورة',
    'اصنع صورة',
  ];
  
  return vagueEnglishPatterns.some(pattern => lowerText.startsWith(pattern)) ||
         vagueArabicPatterns.some(pattern => lowerText.startsWith(pattern));
};

// Improves vague image prompts with more details
export const enhanceImagePrompt = (prompt: string): string => {
  const lowerPrompt = prompt.toLowerCase().trim();
  
  // Handle very vague requests
  if (lowerPrompt === 'draw something' || lowerPrompt === 'ارسم شيئا') {
    return 'Create a beautiful digital art landscape with mountains, rivers and a sunset';
  }
  
  if (lowerPrompt === 'create an image' || lowerPrompt === 'إنشاء صورة') {
    return 'Generate a vibrant cityscape at night with neon lights and rainy streets';
  }
  
  if (lowerPrompt.includes('make a picture') || lowerPrompt.includes('اصنع صورة')) {
    return 'Create a photorealistic portrait of a person with dramatic lighting';
  }
  
  // Add more details to existing prompt
  if (!lowerPrompt.includes('style of') && !lowerPrompt.includes('with') && prompt.split(' ').length < 5) {
    return `${prompt} in a photorealistic style with detailed lighting and high resolution`;
  }
  
  return prompt;
};

// Detect the intent behind a prompt
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
  
  // Check for references to previous actions/prompts
  if (isReferringToPrevious(text)) {
    // If we have a previous prompt, use it as context
    if (memory.lastPrompt) {
      const intent: IntentDetection = {
        intent: memory.lastAction || "general_chat",
        confidence: 0.9,
        suggestedMode: memory.lastMode || "general",
        enhancedPrompt: memory.lastPrompt
      };
      
      // If the previous was an image generation, use that context
      if (memory.lastAction === "image_generation" && memory.lastImagePrompt) {
        intent.intent = "image_generation";
        intent.enhancedPrompt = memory.lastImagePrompt;
        intent.suggestedMode = "creative";
      }
      
      return intent;
    }
  }
  
  // Check for image generation intent
  const imageKeywords = [
    'draw', 'image', 'picture', 'create image', 'generate image', 
    'show me a', 'visualize', '/image', 'render', 'portrait', 'painting',
    // Arabic keywords
    'صورة', 'رسم', 'أرسم', 'إنشاء صورة', 'توليد صورة', 'تصور'
  ];
  
  if (imageKeywords.some(keyword => lowerText.includes(keyword))) {
    let enhancedPrompt = text;
    
    // Check if prompt is very vague
    if (isVagueImageRequest(text)) {
      enhancedPrompt = enhanceImagePrompt(text);
    }
    
    return {
      intent: "image_generation",
      confidence: 0.9,
      suggestedMode: "creative",
      needsTranslation: hasArabic,
      enhancedPrompt
    };
  }
  
  // Check for task/reminder creation intent
  const taskKeywords = [
    'create task', 'add task', 'remind me', 'set reminder', 'make a task',
    'schedule', 'add to calendar', 'appointment', 'create event',
    // Arabic keywords
    'إنشاء مهمة', 'أضف مهمة', 'ذكرني', 'ضبط تذكير', 'موعد', 'جدول'
  ];
  
  if (taskKeywords.some(keyword => lowerText.includes(keyword))) {
    return {
      intent: "task_creation",
      confidence: 0.85,
      suggestedMode: "assistant"
    };
  }
  
  // Check for writing assistance intent
  const writingKeywords = [
    'write', 'draft', 'compose', 'email', 'letter', 'essay',
    'poem', 'story', 'summarize', 'rewrite', 'edit',
    // Arabic keywords
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
  
  const memory = getMemory();
  const intent = detectIntent(prompt);
  
  // If referring to previous prompt, use it
  if (intent.enhancedPrompt) {
    return intent.enhancedPrompt;
  }
  
  // If it's a vague image request, enhance it
  if (intent.intent === "image_generation" && isVagueImageRequest(prompt)) {
    const enhancedPrompt = enhanceImagePrompt(prompt);
    return enhancedPrompt;
  }
  
  return prompt;
};

// Rewrite prompt to fix common issues or make it more effective
export const rewritePrompt = (prompt: string, purpose: string = 'general'): string => {
  if (!prompt) return prompt;
  
  if (purpose === 'image' || purpose === 'creative') {
    // Make image prompts more detailed
    const words = prompt.split(' ').length;
    
    if (words < 5) {
      return `${prompt} in high detail with realistic lighting and shadows`;
    }
    
    if (!prompt.toLowerCase().includes('style') && words < 10) {
      return `${prompt}, photorealistic style with detailed textures`;
    }
  }
  
  return prompt;
};

// Handle mode-specific prompt processing
export function processPromptForMode(prompt: string, mode: AIMode): string {
  switch (mode) {
    case 'creative':
      return rewritePrompt(prompt, 'image');
    case 'writer':
      return prompt; // Writer mode uses prompts as-is
    case 'assistant':
      return prompt; // Assistant mode uses prompts as-is
    case 'general':
    default:
      return prompt;
  }
}

// Export a unified brain interface
export const promptBrain = {
  detectIntent,
  preprocessPrompt,
  rewritePrompt,
  containsArabic,
  isReferringToPrevious,
  enhanceImagePrompt,
  getMemory,
  updateMemory,
  processPromptForMode
};

export default promptBrain;
