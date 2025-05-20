import { supabase } from "@/integrations/supabase/client";
import { AIMode, ChatMessage } from "@/components/ai-assistant/types";

// Function to process AI intent
export async function processIntent(userInput: string, mode: string, metadata: any = {}) {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('Authentication required');
    }

    const { data, error } = await supabase.functions.invoke('process-ai-intent', {
      body: { 
        userInput, 
        mode,
        metadata
      }
    });

    if (error) {
      console.error('Error processing AI intent:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Error in processIntent:', error);
    throw error;
  }
}

// Add all missing exported functions that are needed by the hooks

// Save chat message function
export async function saveChatMessage(
  userId: string,
  content: string,
  role: string,
  mode: AIMode,
  metadata: any = {}
) {
  try {
    console.log(`Saving ${role} message for user ${userId} in ${mode} mode`);
    
    const { data, error } = await supabase.functions.invoke('insert-ai-chat', {
      body: {
        userId,
        content,
        role,
        mode,
        metadata
      }
    });

    if (error) {
      console.error('Error saving chat message:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveChatMessage:', error);
    throw error;
  }
}

// Get recent chat history function
export async function getRecentChatHistory(
  userId: string,
  mode: AIMode | null,
  limit: number = 20
): Promise<ChatMessage[]> {
  try {
    console.log(`Fetching recent chat history for user ${userId}${mode ? ` in ${mode} mode` : ''}, limit: ${limit}`);
    
    const { data, error } = await supabase.functions.invoke('get-recent-chat-history', {
      body: {
        userId,
        mode,
        limit
      }
    });

    if (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }

    // Map the data to ChatMessage format
    return data?.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      mode: msg.mode,
      metadata: msg.metadata || {}
    })) || [];
  } catch (error) {
    console.error('Error in getRecentChatHistory:', error);
    return [];
  }
}

// Process AI request function
export async function processAIRequest(
  message: string,
  mode: AIMode,
  userId: string
) {
  try {
    console.log(`Processing AI request in ${mode} mode for user ${userId}`);
    
    // Call edge function for AI processing
    const { data, error } = await supabase.functions.invoke('process-ai-intent', {
      body: {
        userInput: message,
        mode,
        userId
      }
    });

    if (error) {
      console.error('Error processing AI request:', error);
      throw error;
    }

    return {
      response: data.response || '',
      intent: data.intent || 'general_chat',
      intentData: data.intentData || {},
      suggestedMode: data.suggestedMode || null,
      originalPrompt: data.originalPrompt || message
    };
  } catch (error) {
    console.error('Error in processAIRequest:', error);
    throw error;
  }
}

// Image generation functions
export async function generateImage(prompt: string) {
  try {
    console.log('Generating image with prompt:', prompt);
    
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: {
        prompt
      }
    });

    if (error) {
      console.error('Error generating image:', error);
      throw error;
    }

    return {
      imageUrl: data?.imageUrl || '',
      metadata: data?.metadata || {}
    };
  } catch (error) {
    console.error('Error in generateImage:', error);
    throw error;
  }
}

// Direct image generation function
export async function directImageGeneration(prompt: string, userId: string) {
  try {
    console.log('Direct image generation with prompt:', prompt);
    
    const { data, error } = await supabase.functions.invoke('generate-image', {
      body: {
        prompt,
        userId,
        directGeneration: true
      }
    });

    if (error) {
      console.error('Error in direct image generation:', error);
      throw error;
    }

    return {
      imageUrl: data?.imageUrl || '',
      metadata: data?.metadata || {}
    };
  } catch (error) {
    console.error('Error in directImageGeneration:', error);
    throw error;
  }
}

// Utility functions for image generation
export function isImageGenerationRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('generate an image') ||
    lowerMessage.includes('create an image') ||
    lowerMessage.includes('draw a') ||
    lowerMessage.includes('create a picture') ||
    lowerMessage.includes('generate a picture') ||
    lowerMessage.includes('make an image') ||
    lowerMessage.startsWith('image of') ||
    lowerMessage.startsWith('picture of')
  );
}

export function extractImagePrompt(message: string): string {
  // Extract the image prompt, removing any prefixes
  const prefixes = [
    'generate an image of',
    'create an image of',
    'draw a',
    'create a picture of',
    'generate a picture of',
    'make an image of',
    'image of',
    'picture of'
  ];
  
  let result = message;
  
  for (const prefix of prefixes) {
    if (message.toLowerCase().startsWith(prefix)) {
      result = message.substring(prefix.length).trim();
      break;
    }
  }
  
  return result;
}

// Other service functions...
