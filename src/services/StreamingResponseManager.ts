
// Streaming Response Manager for real-time UI updates
interface StreamingState {
  conversationId: string;
  isStreaming: boolean;
  currentResponse: string;
  onUpdate: (chunk: string, isComplete: boolean) => void;
}

class StreamingResponseManagerClass {
  private activeStreams = new Map<string, StreamingState>();
  
  // Start streaming response
  startStream(
    conversationId: string, 
    onUpdate: (chunk: string, isComplete: boolean) => void
  ): void {
    this.activeStreams.set(conversationId, {
      conversationId,
      isStreaming: true,
      currentResponse: '',
      onUpdate
    });
    
    console.log('🌊 STREAM STARTED:', conversationId);
  }
  
  // Add chunk to stream
  addChunk(conversationId: string, chunk: string): void {
    const stream = this.activeStreams.get(conversationId);
    if (!stream || !stream.isStreaming) return;
    
    stream.currentResponse += chunk;
    stream.onUpdate(chunk, false);
  }
  
  // Complete stream
  completeStream(conversationId: string, finalResponse?: string): void {
    const stream = this.activeStreams.get(conversationId);
    if (!stream) return;
    
    stream.isStreaming = false;
    if (finalResponse) {
      stream.currentResponse = finalResponse;
    }
    
    stream.onUpdate('', true);
    this.activeStreams.delete(conversationId);
    
    console.log('✅ STREAM COMPLETED:', conversationId);
  }
  
  // Check if conversation is streaming
  isStreaming(conversationId: string): boolean {
    const stream = this.activeStreams.get(conversationId);
    return stream?.isStreaming || false;
  }
  
  // Get current response
  getCurrentResponse(conversationId: string): string {
    const stream = this.activeStreams.get(conversationId);
    return stream?.currentResponse || '';
  }
  
  // Stop all streams
  stopAllStreams(): void {
    for (const [conversationId, stream] of this.activeStreams) {
      stream.isStreaming = false;
      stream.onUpdate('', true);
    }
    this.activeStreams.clear();
    console.log('🛑 ALL STREAMS STOPPED');
  }
}

export const StreamingResponseManager = new StreamingResponseManagerClass();
