
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { AIMode, ChatMessage } from "@/components/ai-assistant/types";
import { modeController } from "@/utils/modeController";
import { saveImageToDatabase } from "./imageService";

// Define a type for the ai_chat_history table
interface AIChatHistory {
  id: string;
  user_id: string;
  content: string;
  role: "user" | "assistant";
  mode: string;
  metadata: any;
  has_media: boolean;
  expires_at: string;
  created_at: string;
}

// Save a message to the chat history
export async function saveChatMessage(
  userId: string, 
  content: string, 
  role: "user" | "assistant",
  mode: AIMode,
  metadata: any = {}
): Promise<string | null> {
  if (!userId) return null;
  
  try {
    console.log('Saving chat message:', { userId, role, mode });
    
    // Enhanced logging for mode switch actions
    if (metadata && metadata.modeSwitchAction) {
      console.log('Found modeSwitchAction in metadata being saved:', JSON.stringify(metadata.modeSwitchAction));
    } else {
      console.log('No modeSwitchAction in metadata being saved');
    }
    
    console.log('Full metadata being saved:', JSON.stringify(metadata));
    
    // Check if the message contains an image (for assistant responses)
    const hasMedia = content.includes("![") || (metadata && metadata.hasMedia);

    // Add the timestamp to metadata if it doesn't exist
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
    };
    
    // Convert to parameters required by the stored function
    const { data, error } = await supabase.functions.invoke('insert-ai-chat', {
      body: {
        userId,
        content,
        role,
        mode,
        metadata: enhancedMetadata,
        hasMedia,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      }
    });
      
    if (error) {
      console.error("Error saving chat message:", error);
      return null;
    }
    
    console.log('Message successfully saved to database, returned id:', data);
    return data;
  } catch (error) {
    console.error("Exception saving chat message:", error);
    return null;
  }
}

// Get recent chat history
export async function getRecentChatHistory(
  userId: string,
  mode: AIMode | null = null,
  limit: number = 20
): Promise<ChatMessage[]> {
  if (!userId) return [];
  
  try {
    console.log('Fetching chat history:', { userId, mode, limit });
    
    // Using a stored function
    const { data, error } = await supabase.functions.invoke('get-recent-chat-history', {
      body: {
        userId,
        mode,
        limit
      }
    });
    
    if (error) {
      console.error("Error fetching chat history:", error);
      return [];
    }
    
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    console.log('Chat history raw data received:', data);
    
    // Convert to ChatMessage format
    const chatMessages: ChatMessage[] = (data as AIChatHistory[]).map((item: any) => {
      // Enhanced debug logging for modeSwitchAction in each message's metadata
      if (item.metadata && item.metadata.modeSwitchAction) {
        console.log(`Message ${item.id} has modeSwitchAction in metadata:`, 
          JSON.stringify(item.metadata.modeSwitchAction));
      }
      
      return {
        id: item.id,
        role: item.role as "user" | "assistant",
        content: item.content,
        timestamp: new Date(item.created_at),
        mode: item.mode as AIMode,
        metadata: item.metadata || {},
        originalPrompt: item.metadata?.originalPrompt,
        modeSwitchAction: item.metadata?.modeSwitchAction,
        actionButtons: item.metadata?.actionButtons
      };
    });
    
    console.log('Processed chat messages with explicit modeSwitchAction check:', 
      chatMessages.map(m => ({
        id: m.id, 
        hasModeSwitchAction: !!m.modeSwitchAction,
        modeSwitchAction: m.modeSwitchAction
      }))
    );
    
    // Sort by timestamp
    return chatMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
  } catch (error) {
    console.error("Exception fetching chat history:", error);
    return [];
  }
}

// Handle audio transcription
export async function transcribeAudio(audioBlob: Blob): Promise<string | null> {
  try {
    console.log('Starting audio transcription...');
    // Create form data
    const formData = new FormData();
    formData.append("audio", audioBlob);

    // Get auth session
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      console.error('No auth session for transcription');
      return null;
    }

    // Call the Supabase Edge Function
    const response = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Transcription failed");
    }

    const { text } = await response.json();
    console.log('Transcription successful:', text);
    return text;
  } catch (error) {
    console.error("Error in audio transcription:", error);
    return null;
  }
}

// Process AI request with intent detection
export const processAIRequest = async (text: string, mode: string, userId: string) => {
  try {
    // Check if this is an echo from a mode switch
    const isEchoAfterModeSwitch = text.startsWith("__ECHO__");
    const processText = isEchoAfterModeSwitch 
      ? text.replace("__ECHO__", "") 
      : text;

    // First, check if this is an image generation request
    // If so, we'll handle it separately with special mode switching
    const isImageRequest = modeController.isImageGenerationRequest(processText);
    if (isImageRequest) {
      console.log("Image generation request detected, ensuring creative mode");
      
      // Ensure we're in creative mode
      const currentMode = modeController.getActiveMode();
      if (currentMode !== 'creative') {
        // We need to switch to creative mode first
        return {
          response: `You asked to create an image based on: "${processText}". This works better in Creative mode. Switching now...`,
          intent: "mode_switch",
          intentData: null,
          suggestedMode: "creative",
          originalPrompt: processText,
          modeSwitchAction: {
            targetMode: "creative",
            action: "generateImage",
            autoTrigger: true,
            prompt: processText,
          },
          echoOriginalPrompt: true
        };
      }
    }

    // Call the Supabase Edge Function to process the AI request
    const { data, error } = await supabase.functions.invoke("process-ai-intent", {
      body: { text: processText, mode, userId },
    });

    if (error) {
      console.error("Error processing AI request:", error);
      throw new Error(`Error processing AI request: ${error.message}`);
    }

    console.log("AI request processed, raw data:", data);
    
    // Enhanced mode switch handling with echoOriginalPrompt flag
    if (data.modeSwitchAction) {
      console.log("Mode switch action detected:", JSON.stringify(data.modeSwitchAction));
      
      // Adding auto trigger flag if not present
      if (data.modeSwitchAction.autoTrigger === undefined) {
        data.modeSwitchAction.autoTrigger = true;
      }
    }

    // Return the processed data
    return {
      response: data.response,
      intent: data.intent || "general_chat",
      intentData: data.intentData || null,
      suggestedMode: data.suggestedMode || null,
      originalPrompt: data.originalPrompt || text, // Always store the original prompt
      modeSwitchAction: data.modeSwitchAction || null,
      echoOriginalPrompt: data.echoOriginalPrompt || false
    };
  } catch (error) {
    console.error("Error in processAIRequest:", error);
    throw error;
  }
};

// Generate image based on prompt using Runware API
export async function generateImage(prompt: string): Promise<string | null> {
  try {
    console.log('Generating image with prompt:', prompt);
    
    const getSession = await supabase.auth.getSession();
    const accessToken = getSession.data.session?.access_token;
    
    if (!accessToken) {
      throw new Error('No auth session');
    }
    
    const response = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-image",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Image generation API error:", errorData);
      throw new Error(errorData.error || errorData.details || "Image generation failed");
    }

    const responseData = await response.json();
    console.log('Image generation response:', responseData);
    
    const { imageUrl } = responseData;
    console.log('Image generated successfully:', imageUrl);
    
    // Add validation to ensure we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      console.error("Invalid image URL returned:", imageUrl);
      throw new Error("Invalid image URL returned from API");
    }
    
    return imageUrl;
  } catch (error) {
    console.error("Error in image generation:", error);
    return null;
  }
}

// Helper function to check if text contains an image generation request
export function isImageGenerationRequest(text: string): boolean {
  return modeController.isImageGenerationRequest(text);
}

// Enhanced helper to detect if mode switch is needed based on text content
export function detectAppropriateMode(text: string, currentMode: AIMode): AIMode | null {
  return modeController.shouldSwitchMode(text, currentMode);
}

// Extract prompt from image generation request
export function extractImagePrompt(text: string): string {
  return modeController.extractImagePrompt(text);
}
