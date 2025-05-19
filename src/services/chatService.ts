import { supabase } from "@/integrations/supabase/client";

// Function to transcribe audio using the edge function
export async function transcribeAudio(recordingId: string, filePath?: string): Promise<string> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('Authentication required');
    }

    // Call the edge function with the recording UUID and optional file path
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { 
        recordingId,
        filePath 
      }
    });

    if (error) {
      console.error('Error transcribing audio:', error);
      throw new Error(error.message);
    }

    // Return the transcribed text
    return data?.text || '';
  } catch (error) {
    console.error('Error in transcribeAudio:', error);
    throw error;
  }
}

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

// Other service functions...
