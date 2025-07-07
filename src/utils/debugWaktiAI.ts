
import { supabase } from '@/integrations/supabase/client';

interface DebugTestResult {
  success: boolean;
  response?: any;
  error?: string;
  responseTime: number;
  logs: string[];
}

export class WaktiAIDebugger {
  private logs: string[] = [];

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    console.log(logEntry);
  }

  async testEdgeFunctionDirectly(testMessage: string = "what are the GCC countries?"): Promise<DebugTestResult> {
    this.logs = [];
    this.log('🧪 WAKTI AI DEBUG: Starting Edge Function test');
    
    const startTime = Date.now();

    try {
      // Get authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error(`Authentication failed: ${authError?.message || 'No session'}`);
      }
      this.log('✅ AUTH: Session obtained successfully');

      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found');
      }
      this.log(`✅ USER: ${user.email} (${user.id.substring(0, 8)}...)`);

      // Prepare test payload
      const testPayload = {
        message: testMessage,
        userId: user.id,
        language: 'en',
        conversationId: `debug_test_${Date.now()}`,
        inputType: 'text',
        activeTrigger: 'chat',
        attachedFiles: [],
        enableStreaming: false, // Disable streaming for test
        personalTouch: null,
        maxTokens: 1000,
        speedOptimized: true
      };

      this.log(`📨 PAYLOAD: Prepared test payload (${JSON.stringify(testPayload).length} bytes)`);

      // Call Edge Function
      this.log('🔗 CALLING: wakti-ai-v2-brain Edge Function');
      const { data: response, error: functionError } = await supabase.functions
        .invoke('wakti-ai-v2-brain', {
          body: testPayload,
          headers: {
            'Content-Type': 'application/json',
            'x-app-name': 'wakti-ai-debug-test',
            'x-auth-token': session.access_token,
            'x-skip-auth': 'true'
          }
        });

      const responseTime = Date.now() - startTime;
      this.log(`⏱️ RESPONSE TIME: ${responseTime}ms`);

      if (functionError) {
        this.log(`❌ FUNCTION ERROR: ${functionError.message}`);
        throw new Error(`Edge Function error: ${functionError.message}`);
      }

      if (!response) {
        this.log('❌ NO RESPONSE: Edge Function returned null');
        throw new Error('No response from Edge Function');
      }

      this.log('✅ RESPONSE: Received response from Edge Function');
      this.log(`📊 RESPONSE DETAILS: ${JSON.stringify({
        success: response.success,
        hasResponse: !!response.response,
        intent: response.intent,
        model: response.aiProvider,
        claude4: response.claude4Upgrade,
        contextRestored: response.contextRestored,
        fallbackUsed: response.fallbackUsed
      }, null, 2)}`);

      return {
        success: true,
        response,
        responseTime,
        logs: [...this.logs]
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.log(`❌ TEST FAILED: ${error.message}`);
      this.log(`⏱️ FAILURE TIME: ${responseTime}ms`);

      return {
        success: false,
        error: error.message,
        responseTime,
        logs: [...this.logs]
      };
    }
  }

  async testClaude4Integration(): Promise<DebugTestResult> {
    this.logs = [];
    this.log('🤖 CLAUDE 4 TEST: Testing Claude 4 integration specifically');

    return await this.testEdgeFunctionDirectly("Test Claude 4 integration - respond with model name and capabilities");
  }

  async testVisionCapabilities(): Promise<DebugTestResult> {
    this.logs = [];
    this.log('👁️ VISION TEST: Testing vision capabilities');

    // Create a test image data URL (simple red square)
    const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const testPayload = {
      message: "What do you see in this image?",
      userId: "test-user",
      language: 'en',
      conversationId: `vision_test_${Date.now()}`,
      inputType: 'text',
      activeTrigger: 'chat',
      attachedFiles: [{
        name: 'test-image.png',
        type: 'image/png',
        base64Data: testImageDataUrl.split(',')[1],
        image_url: { url: testImageDataUrl }
      }],
      enableStreaming: false,
      personalTouch: null,
      maxTokens: 1000,
      speedOptimized: true
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authentication session');

      const startTime = Date.now();
      const { data: response, error } = await supabase.functions
        .invoke('wakti-ai-v2-brain', {
          body: testPayload,
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': session.access_token,
            'x-skip-auth': 'true'
          }
        });

      const responseTime = Date.now() - startTime;

      if (error) throw new Error(error.message);

      this.log(`✅ VISION TEST: Completed in ${responseTime}ms`);
      this.log(`📊 VISION RESULT: ${response?.visionEnhanced ? 'Vision enabled' : 'Vision disabled'}`);

      return {
        success: true,
        response,
        responseTime,
        logs: [...this.logs]
      };

    } catch (error: any) {
      this.log(`❌ VISION TEST FAILED: ${error.message}`);
      return {
        success: false,
        error: error.message,
        responseTime: 0,
        logs: [...this.logs]
      };
    }
  }

  printLogs() {
    console.log('📋 WAKTI AI DEBUG LOGS:');
    this.logs.forEach(log => console.log(log));
  }
}

// Export a singleton instance
export const waktiAIDebugger = new WaktiAIDebugger();

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  (window as any).waktiAIDebugger = waktiAIDebugger;
}
