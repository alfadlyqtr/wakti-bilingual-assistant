
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

  async testMinimalEdgeFunction(testMessage: string = "Hello, can you confirm WAKTI AI is working?"): Promise<DebugTestResult> {
    this.logs = [];
    this.log('🧪 EMERGENCY DEBUG: Testing minimal Edge Function');
    
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

      // Prepare minimal test payload
      const testPayload = {
        message: testMessage,
        userId: user.id,
        language: 'en',
        conversationId: `debug_minimal_${Date.now()}`,
        inputType: 'text',
        activeTrigger: 'chat',
        attachedFiles: [],
        enableStreaming: false,
        maxTokens: 1000
      };

      this.log(`📨 PAYLOAD: Prepared minimal test payload`);

      // Call Edge Function with timeout
      this.log('🔗 CALLING: wakti-ai-v2-brain Edge Function (EMERGENCY MODE)');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const { data: response, error: functionError } = await supabase.functions
        .invoke('wakti-ai-v2-brain', {
          body: testPayload,
          headers: {
            'Content-Type': 'application/json',
            'x-app-name': 'wakti-ai-emergency-debug',
            'x-auth-token': session.access_token,
            'x-skip-auth': 'true'
          }
        });

      clearTimeout(timeoutId);
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
        emergencyMode: response.emergencyFix,
        debugMode: response.debugMode
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

  async quickHealthCheck(): Promise<DebugTestResult> {
    this.logs = [];
    this.log('🏥 HEALTH CHECK: Running quick diagnostic');

    return await this.testMinimalEdgeFunction("System check - respond with OK if you're working");
  }

  printLogs() {
    console.log('📋 EMERGENCY DEBUG LOGS:');
    this.logs.forEach(log => console.log(log));
  }
}

// Export a singleton instance
export const waktiAIDebugger = new WaktiAIDebugger();
