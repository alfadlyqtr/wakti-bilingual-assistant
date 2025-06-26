
import { supabase } from '@/integrations/supabase/client';

export interface StreamingResponse {
  id: string;
  content: string;
  isComplete: boolean;
  error?: string;
}

export class AIStreamingServiceClass {
  private activeStreams = new Map<string, AbortController>();

  async streamResponse(
    message: string,
    language: string,
    conversationId?: string | null,
    activeTrigger: string = 'chat',
    attachedFiles: any[] = [],
    onToken?: (response: StreamingResponse) => void,
    onComplete?: (response: StreamingResponse) => void,
    onError?: (error: string) => void
  ): Promise<string> {
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abortController = new AbortController();
    this.activeStreams.set(streamId, abortController);

    try {
      console.log("🚀 STREAMING CLIENT: Starting stream request");
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      // Use the new streaming function
      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          language,
          conversationId,
          activeTrigger,
          attachedFiles,
          stream: true
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      let fullContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const finalResponse: StreamingResponse = {
                id: streamId,
                content: fullContent,
                isComplete: true
              };
              onComplete?.(finalResponse);
              return fullContent;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                fullContent += parsed.token;
                const streamResponse: StreamingResponse = {
                  id: streamId,
                  content: fullContent,
                  isComplete: false
                };
                onToken?.(streamResponse);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      return fullContent;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return ''; // Stream was cancelled
      }
      
      const errorMessage = error.message || 'Streaming failed';
      console.error("🚀 STREAMING CLIENT ERROR:", errorMessage);
      onError?.(errorMessage);
      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }

  cancelAllStreams(): void {
    for (const [id, controller] of this.activeStreams) {
      controller.abort();
    }
    this.activeStreams.clear();
  }
}

export const AIStreamingService = new AIStreamingServiceClass();
