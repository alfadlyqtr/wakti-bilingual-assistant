
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { AIMode, ChatMessage } from "@/components/ai-assistant/types";

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
  message: string, 
  role: "user" | "assistant",
  mode: AIMode,
  metadata: any = {}
): Promise<string | null> {
  if (!userId) return null;
  
  try {
    // Using a stored function
    const { data, error } = await supabase
      .rpc('insert_ai_chat', {
        p_user_id: userId,
        p_content: message,
        p_role: role,
        p_mode: mode,
        p_metadata: metadata,
        p_has_media: metadata.hasMedia || false,
        p_expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      });
      
    if (error) {
      console.error("Error saving chat message:", error);
      return null;
    }
    
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
    // Using a stored function
    const { data, error } = await supabase
      .rpc('get_recent_chat_history', {
        p_user_id: userId,
        p_mode: mode,
        p_limit: limit
      });
    
    if (error) {
      console.error("Error fetching chat history:", error);
      return [];
    }
    
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    // Convert to ChatMessage format
    const chatMessages: ChatMessage[] = data.map((item: any) => ({
      id: item.id,
      role: item.role as "user" | "assistant",
      content: item.content,
      timestamp: new Date(item.created_at),
      mode: item.mode as AIMode,
      metadata: item.metadata
    }));
    
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
    // Create form data
    const formData = new FormData();
    formData.append("audio", audioBlob);

    // Call the Supabase Edge Function
    const response = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabase.auth.getSession().then(({ data }) => data.session?.access_token)}`
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Transcription failed");
    }

    const { text } = await response.json();
    return text;
  } catch (error) {
    console.error("Error in audio transcription:", error);
    return null;
  }
}

// Process AI request with intent detection
export async function processAIRequest(
  text: string,
  mode: AIMode,
  userId: string
): Promise<{
  response: string;
  intent?: string;
  intentData?: any;
}> {
  try {
    const getSession = await supabase.auth.getSession();
    const accessToken = getSession.data.session?.access_token;

    const response = await fetch(
      "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/process-ai-intent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          text,
          mode,
          userId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "AI processing failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Error in AI processing:", error);
    return {
      response: "I'm sorry, I encountered an error processing your request. Please try again.",
    };
  }
}

// Generate image based on prompt
export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const getSession = await supabase.auth.getSession();
    const accessToken = getSession.data.session?.access_token;
    
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
      const error = await response.json();
      throw new Error(error.error || "Image generation failed");
    }

    const { imageUrl } = await response.json();
    return imageUrl;
  } catch (error) {
    console.error("Error in image generation:", error);
    return null;
  }
}
