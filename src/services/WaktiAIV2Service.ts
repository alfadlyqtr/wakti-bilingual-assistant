import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | null;
  inputType?: 'text' | 'voice' | 'vision';
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  attachedFiles?: any[];
  isTextGenerated?: boolean;
  metadata?: any;
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;
  private conversationStorage = new Map<string, AIMessage[]>();
  private locationCache: { country: string | null; city: string | null } | null = null;

  constructor() {
    console.log('🤖 WAKTI AI SERVICE: Initialized as Backend Worker (Frontend Boss mode)');
    this.loadConversationsFromStorage();
    try { this.ensurePersonalTouch(); } catch {}
  }

  // Safely get user's personal touch preferences from cache or localStorage
  private getPersonalTouch(): any {
    try {
      if (this.personalTouchCache) return this.personalTouchCache;
      const raw = localStorage.getItem('wakti_personal_touch');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      this.personalTouchCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  // Simple stable hash for PT diagnostics (non-crypto)
  private hashPersonalTouch(pt: any): string | null {
    try {
      if (!pt) return null;
      const s = JSON.stringify({
        nickname: pt.nickname || '',
        tone: pt.tone || '',
        style: pt.style || '',
        instruction: pt.instruction || '',
        aiNickname: pt.aiNickname || ''
      });
      let hash = 5381;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
        hash = hash & 0xffffffff;
      }
      return `djb2_${(hash >>> 0).toString(16)}`;
    } catch {
      return null;
    }
  }

  // Ensure PT object exists with safe defaults and minimal normalization
  private ensurePersonalTouch(): any {
    const allowedTones = ['funny', 'serious', 'casual', 'encouraging', 'neutral'];
    const allowedStyles = ['short answers', 'bullet points', 'step-by-step', 'detailed', 'conversational', 'analytical'];

    let pt: any = null;
    try { pt = this.getPersonalTouch(); } catch {}

    if (!pt || typeof pt !== 'object') {
      pt = {
        nickname: '',
        aiNickname: '',
        tone: 'neutral',
        style: 'short answers',
        instruction: ''
      };
      pt.pt_version = 1;
      pt.pt_updated_at = new Date().toISOString();
    } else {
      // Normalize tone
      if (!pt.tone || !allowedTones.includes((pt.tone + '').toLowerCase())) {
        pt.tone = 'neutral';
      }
      // Normalize style
      const styleLower = (pt.style || '').toLowerCase();
      const normalizedStyle = allowedStyles.find(s => s === styleLower)
        || (styleLower.includes('short') ? 'short answers'
        : styleLower.includes('bullet') ? 'bullet points'
        : styleLower.includes('step') ? 'step-by-step'
        : styleLower.includes('detail') ? 'detailed'
        : styleLower.includes('convers') ? 'conversational'
        : styleLower.includes('analyt') ? 'analytical'
        : 'short answers');
      pt.style = normalizedStyle;

      // Trim instruction
      if (typeof pt.instruction === 'string') {
        pt.instruction = pt.instruction.slice(0, 500);
      } else {
        pt.instruction = '';
      }

      // Versioning metadata
      if (typeof pt.pt_version !== 'number') pt.pt_version = 1;
      if (!pt.pt_updated_at) pt.pt_updated_at = new Date().toISOString();
    }

    // Attach hash for transport
    try { pt.pt_hash = this.hashPersonalTouch(pt); } catch {}

    // Persist back and cache
    try {
      localStorage.setItem('wakti_personal_touch', JSON.stringify(pt));
      this.personalTouchCache = pt;
    } catch {}

    return pt;
  }

  // Fetch user's country/city once and cache (localStorage + memory)
  private async getUserLocation(userId: string): Promise<{ country: string | null; city: string | null }> {
    // In-memory cache first
    if (this.locationCache) return this.locationCache;
    // LocalStorage fallback
    try {
      const raw = localStorage.getItem('wakti_user_location');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.locationCache = { country: parsed.country || null, city: parsed.city || null };
          return this.locationCache;
        }
      }
    } catch {}

    // Fetch from profiles
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('country, city')
        .eq('id', userId)
        .maybeSingle();
      const loc = { country: (prof as any)?.country || null, city: (prof as any)?.city || null };
      this.locationCache = loc;
      try { localStorage.setItem('wakti_user_location', JSON.stringify(loc)); } catch {}
      return loc;
    } catch {
      const fallback = { country: null, city: null };
      this.locationCache = fallback;
      return fallback;
    }
  }

  // Allow UI to explicitly refresh location (e.g., when user updates account page)
  async refreshUserLocation(userId?: string) {
    try { this.locationCache = null; localStorage.removeItem('wakti_user_location'); } catch {}
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
    }
    await this.getUserLocation(userId);
  }

  private approxBase64Bytes(b64: string): number {
    if (!b64) return 0;
    const len = b64.length;
    const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
    return Math.floor((len * 3) / 4) - padding;
    }

  private isBrowser(): boolean {
    try { return typeof window !== 'undefined' && typeof document !== 'undefined'; } catch { return false; }
  }

  private async downscaleBase64(rawBase64: string, mimeType: string, maxLongEdge = 1280, quality = 0.75): Promise<string> {
    if (!this.isBrowser()) return rawBase64;
    const dataUrl = rawBase64.startsWith('data:') ? rawBase64 : `data:${mimeType || 'image/jpeg'};base64,${rawBase64}`;
    return await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width || 1;
        const h = img.height || 1;
        const long = Math.max(w, h);
        const ratio = long > maxLongEdge ? maxLongEdge / long : 1;
        const nw = Math.max(1, Math.round(w * ratio));
        const nh = Math.max(1, Math.round(h * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(rawBase64); return; }
        ctx.drawImage(img, 0, 0, nw, nh);
        const out = canvas.toDataURL((mimeType || 'image/jpeg'), quality);
        const base64 = out.split(',')[1] || '';
        resolve(base64 || rawBase64);
      };
      img.onerror = () => resolve(rawBase64);
      img.src = dataUrl;
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'image/jpeg' });
  }

  private async uploadVisionToStorage(files: any[], userId: string, requestId: string): Promise<{ url: string; mimeType: string }[]> {
    const out: { url: string; mimeType: string }[] = [];
    const bucket = 'wakti-ai-v2'; // reuse existing bucket
    for (let i = 0; i < files.length; i++) {
      const f = files[i] || {};
      const type = (f.type || f.mimeType || 'image/jpeg').toString();
      const raw = (typeof f.data === 'string' && f.data) ? f.data : (typeof f.content === 'string' ? f.content : '');
      if (!raw) continue;
      const blob = this.base64ToBlob(raw, type);
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const path = `vision-temp/${userId}/${requestId}/${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, upsert: true });
      if (upErr) throw upErr;
      const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);
      if (!publicUrl?.publicUrl) throw new Error('no_public_url');
      out.push({ url: publicUrl.publicUrl, mimeType: type });
    }
    return out;
  }

  private async prepareVisionAttachments(files: any[]): Promise<any[]> {
    if (!Array.isArray(files) || files.length === 0) return files || [];
    const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
    const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
    const processed: any[] = [];
    for (const f of files) {
      if (!f || typeof f !== 'object') { processed.push(f); continue; }
      const type = (f.type || f.mimeType || '').toString();
      const isImage = typeof type === 'string' && type.startsWith('image/');
      const raw = typeof f.data === 'string' && f.data ? f.data : (typeof f.content === 'string' ? f.content : '');
      if (!isImage || !raw) { processed.push(f); continue; }
      let outBase64 = raw;
      const bytes = this.approxBase64Bytes(raw);
      if (bytes > MAX_IMAGE_BYTES) {
        outBase64 = await this.downscaleBase64(raw, type, 1280, 0.75);
      }
      processed.push({ ...f, data: outBase64, content: outBase64, type });
    }
    let total = 0;
    for (const p of processed) {
      const type = (p.type || p.mimeType || '').toString();
      const isImage = typeof type === 'string' && type.startsWith('image/');
      const raw = typeof p.data === 'string' && p.data ? p.data : (typeof p.content === 'string' ? p.content : '');
      if (isImage && raw) total += this.approxBase64Bytes(raw);
    }
    if (total > MAX_TOTAL_BYTES) {
      throw new Error('Images too large. Please upload smaller images.');
    }
    return processed;
  }

  // Enhanced message handling with session storage
  private getEnhancedMessages(recentMessages: AIMessage[]): AIMessage[] {
    // Combine session storage with current messages
    const storedMessages = this.loadStoredMessages();
    const allMessages = [...storedMessages, ...recentMessages];
    
    // Remove duplicates by ID
    const uniqueMessages = allMessages.filter((msg, index, arr) => 
      arr.findIndex(m => m.id === msg.id) === index
    );
    
    // Sort by timestamp
    uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Apply smart filtering and return last 20
    return this.smartFilterMessages(uniqueMessages).slice(-20);
  }

  private smartFilterMessages(messages: AIMessage[]): AIMessage[] {
    if (!messages || messages.length === 0) return [];
    
    // Filter out redundant acknowledgments and keep important context
    const redundantPatterns = [
      /^(thank you|thanks|ok|okay|yes|no|sure|alright)$/i,
      /^(شكرا|حسنا|نعم|لا|طيب|ممتاز)$/i
    ];
    
    return messages.filter((msg, index) => {
      // Always keep the last 15 messages to maintain recent context
      if (index >= messages.length - 15) return true;
      
      // Filter out very short redundant responses
      if (msg.content && msg.content.length < 20) {
        return !redundantPatterns.some(pattern => pattern.test(msg.content.trim()));
      }
      
      // Keep longer, meaningful messages
      return true;
    });
  }

  // Generate conversation summary for ultra-fast performance
  private generateConversationSummary(messages: AIMessage[]): string {
    if (!messages || messages.length < 10) return '';
    
    // Take messages except the last 10 for summary (keep last 10 as recent context)
    const summaryMessages = messages.slice(0, -10);
    if (summaryMessages.length === 0) return '';
    
    // Extract key topics and context
    const topics = new Set<string>();
    const userQuestions: string[] = [];
    const assistantActions: string[] = [];
    
    summaryMessages.forEach(msg => {
      if (msg.role === 'user' && msg.content.length > 30) {
        // Extract potential topics/keywords
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['about', 'could', 'would', 'should', 'please'].includes(word)) {
            topics.add(word);
          }
        });
        
        if (msg.content.includes('?')) {
          userQuestions.push(msg.content.substring(0, 100));
        }
      } else if (msg.role === 'assistant' && msg.actionTaken) {
        assistantActions.push('Action taken');
      }
    });
    
    // Build concise summary
    let summary = '';
    if (topics.size > 0) {
      summary += `Topics discussed: ${Array.from(topics).slice(0, 5).join(', ')}. `;
    }
    if (userQuestions.length > 0) {
      summary += `User asked about: ${userQuestions[userQuestions.length - 1]}. `;
    }
    if (assistantActions.length > 0) {
      summary += `${assistantActions.length} actions performed. `;
    }
    
    return summary.trim();
  }

  private loadStoredMessages(): AIMessage[] {
    try {
      const stored = sessionStorage.getItem('wakti_conversation_memory');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored messages:', error);
    }
    return [];
  }

  private saveMessagesToStorage(messages: AIMessage[]) {
    try {
      // Keep only last 100 messages to prevent storage overflow
      const messagesToStore = messages.slice(-100);
      sessionStorage.setItem('wakti_conversation_memory', JSON.stringify(messagesToStore));
    } catch (error) {
      console.warn('Failed to save messages to storage:', error);
    }
  }

  private loadConversationsFromStorage() {
    try {
      const stored = sessionStorage.getItem('wakti_conversations');
      if (stored) {
        const conversations = JSON.parse(stored);
        Object.entries(conversations).forEach(([id, messages]) => {
          this.conversationStorage.set(id, messages as AIMessage[]);
        });
      }
    } catch (error) {
      console.warn('Failed to load conversations from storage:', error);
    }
  }

  private saveConversationsToStorage() {
    try {
      const conversations: Record<string, AIMessage[]> = {};
      this.conversationStorage.forEach((messages, id) => {
        conversations[id] = messages;
      });
      sessionStorage.setItem('wakti_conversations', JSON.stringify(conversations));
    } catch (error) {
      console.warn('Failed to save conversations to storage:', error);
    }
  }

  // Enhanced session management
  saveEnhancedChatSession(messages: AIMessage[], conversationId?: string | null) {
    this.saveMessagesToStorage(messages);
    
    if (conversationId) {
      this.conversationStorage.set(conversationId, messages);
      this.saveConversationsToStorage();
    }
  }

  loadEnhancedChatSession(conversationId?: string | null): AIMessage[] {
    if (conversationId && this.conversationStorage.has(conversationId)) {
      return this.conversationStorage.get(conversationId) || [];
    }
    return this.loadStoredMessages();
  }

  clearEnhancedChatSession(conversationId?: string | null) {
    if (conversationId) {
      this.conversationStorage.delete(conversationId);
      this.saveConversationsToStorage();
    } else {
      sessionStorage.removeItem('wakti_conversation_memory');
      sessionStorage.removeItem('wakti_conversations');
      this.conversationStorage.clear();
    }
  }

  // Allow UI to invalidate personal touch cache after saving settings
  clearPersonalTouchCache() {
    try {
      this.personalTouchCache = null;
    } catch {}
  }

  async sendStreamingMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = [],
    onToken?: (token: string) => void,
    onComplete?: (metadata: any) => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ) {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      // Generate a lightweight requestId for diagnostics across iOS/Safari
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`🚀 FRONTEND BOSS: Starting streaming request for ${activeTrigger} mode [${requestId}]`);

      // Compute client local hour and welcome-back flag (gap >= 12h)
      const clientLocalHour = new Date().getHours();
      let isWelcomeBack = false;
      try {
        const lastSeenStr = localStorage.getItem('wakti_last_seen_at');
        if (lastSeenStr) {
          const gapMs = Date.now() - Number(lastSeenStr);
          isWelcomeBack = gapMs >= 12 * 60 * 60 * 1000; // 12 hours
        }
      } catch {}

      // Load user location (country, city) to include in metadata
      const location = await this.getUserLocation(userId);

      // Enhanced message handling with 20-message memory
      const enhancedMessages = this.getEnhancedMessages(recentMessages);
      const generatedSummary = this.generateConversationSummary(enhancedMessages);

      // Load stored rolling summary (Supabase by conversation UUID, else local fallback)
      let storedSummary: string | null = null;
      const uuidLike = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId);
      try {
        if (uuidLike && conversationId) {
          const { data: row } = await supabase
            .from('ai_conversation_summaries')
            .select('summary_text')
            .eq('conversation_id', conversationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          storedSummary = row?.summary_text || null;
        } else if (conversationId) {
          storedSummary = localStorage.getItem(`wakti_local_summary_${conversationId}`) || null;
        }
      } catch {}

      // Combine provided summary (if any), stored summary, and generated summary
      const pieces = [conversationSummary, storedSummary, generatedSummary].filter((s) => !!(s && s.trim())) as string[];
      let finalSummary = pieces.join(' ').slice(0, 1200);

      // Get auth token for streaming request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session for streaming');
      }
      
      // Mobile-optimized anon key fallback for PWA environments
      let maybeAnonKey;
      try {
        maybeAnonKey = (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY)
          || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
      } catch (e) {
        maybeAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
      }

      // Inner attempt function: parameterize primary provider and stream
      const attemptStream = async (primary: 'claude' | 'openai') => {
        // Mobile-optimized SSE request with retry logic
        const maxRetries = 2;
        let response;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const pt = this.ensurePersonalTouch();
            const pt_version = pt?.pt_version ?? null;
            const pt_updated_at = pt?.pt_updated_at ?? null;
            const pt_hash = this.hashPersonalTouch(pt);

            console.log('🎛️ PT_OUT:', {
              tone: pt?.tone || null,
              style: pt?.style || null,
              pt_version,
              pt_updated_at,
              pt_hash
            });

            response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain-stream`, {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'omit',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'apikey': maybeAnonKey
              },
              body: JSON.stringify({
                message,
                language,
                conversationId,
                inputType,
                activeTrigger,
                attachedFiles,
                recentMessages: enhancedMessages,
                conversationSummary: finalSummary,
                personalTouch: pt,
                pt_version,
                pt_updated_at,
                pt_hash,
                clientLocalHour,
                isWelcomeBack,
                location,
                visionPrimary: primary,
                visionFallback: primary === 'claude' ? 'openai' : 'claude'
              }),
              signal
            });

            if (response.ok) break;

            if (attempt === maxRetries) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Brief delay before retry on mobile networks
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

          } catch (error: any) {
            if (attempt === maxRetries || error.name === 'AbortError') {
              throw error;
            }
            console.warn(`🔄 Retry attempt ${attempt}/${maxRetries} for mobile request [${requestId}]`);
          }
        }

        if (!response.ok) throw new Error(`Streaming request failed: ${response.status}`);

        // SSE parsing
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body reader available');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let metadata: any = {};
        let encounteredError: string | null = null;
        let isCompleted = false;

        const abortHandler = async () => { try { await reader.cancel(); } catch {} };
        if (signal) {
          if (signal.aborted) {
            await abortHandler();
            throw new Error('Streaming aborted');
          }
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        // Removed client-side idle timeout to avoid false timeouts on Safari/iOS
        let firstTokenReceived = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (!isCompleted) onComplete?.(metadata);
              console.log(`✅ FRONTEND BOSS: Stream closed cleanly [${requestId}] (primary=${primary})`);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);

              if (data === '[DONE]') {
                if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                console.log(`🏁 FRONTEND BOSS: Received [DONE] [${requestId}] (primary=${primary})`);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  const errObj = parsed.error;
                  const errMsg = typeof errObj === 'string'
                    ? errObj
                    : (errObj?.message || errObj?.type || JSON.stringify(errObj));
                  encounteredError = errMsg;
                  // If overload or Claude-specific error surfaces inside SSE, bubble up immediately
                  const low = errMsg.toLowerCase();
                  if (low.includes('overloaded') || low.includes('529') || low.includes('claude')) {
                    throw new Error(errMsg);
                  }
                  continue;
                }

                if (parsed.metadata?.pt_applied) {
                  console.log('🧩 PT_IN_APPLIED:', parsed.metadata.pt_applied);
                }

                if (typeof parsed.token === 'string') { 
                  if (!firstTokenReceived) {
                    firstTokenReceived = true;
                    console.log(`🎯 CLIENT: First token received [${requestId}] (primary=${primary})`);
                  }
                  fullResponse += parsed.token; 
                  onToken?.(parsed.token); 
                }
                else if (typeof parsed.response === 'string') { 
                  if (!firstTokenReceived) {
                    firstTokenReceived = true;
                    console.log(`🎯 CLIENT: First response chunk received [${requestId}] (primary=${primary})`);
                  }
                  fullResponse += parsed.response; 
                  onToken?.(parsed.response); 
                }
                else if (typeof parsed.content === 'string') { 
                  if (!firstTokenReceived) {
                    firstTokenReceived = true;
                    console.log(`🎯 CLIENT: First content chunk received [${requestId}] (primary=${primary})`);
                  }
                  fullResponse += parsed.content; 
                  onToken?.(parsed.content); 
                }

                if (parsed.metadata && typeof parsed.metadata === 'object') {
                  metadata = { ...metadata, ...parsed.metadata };
                }
                if (parsed.done === true) {
                  if (!isCompleted) { onComplete?.(parsed.metadata || metadata); isCompleted = true; }
                }
              } catch {
                if (!firstTokenReceived) {
                  firstTokenReceived = true;
                  console.log(`🎯 CLIENT: First raw token received [${requestId}] (primary=${primary})`);
                }
                fullResponse += data;
                onToken?.(data);
              }
            }
          }
        } finally {
          try { reader.releaseLock(); } catch {}
          if (signal) signal.removeEventListener('abort', abortHandler as any);
          try { localStorage.setItem('wakti_last_seen_at', String(Date.now())); } catch {}
        }

        // Persist updated rolling summary after stream
        try {
          const msgsForSummary: AIMessage[] = [
            ...enhancedMessages,
            { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() } as AIMessage,
            { id: `assistant-${Date.now()}`, role: 'assistant', content: fullResponse, timestamp: new Date() } as AIMessage
          ];
          const updatedSummary = this.generateConversationSummary(msgsForSummary);
          if (updatedSummary && updatedSummary.trim()) {
            const uuidLike = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId);
            if (uuidLike && conversationId) {
              const { data: existing } = await supabase
                .from('ai_conversation_summaries')
                .select('id')
                .eq('conversation_id', conversationId)
                .limit(1)
                .maybeSingle();
              if (existing?.id) {
                await supabase
                  .from('ai_conversation_summaries')
                  .update({ summary_text: updatedSummary, message_count: msgsForSummary.length })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('ai_conversation_summaries')
                  .insert({ user_id: userId, conversation_id: conversationId, summary_text: updatedSummary, message_count: msgsForSummary.length });
              }
            } else if (conversationId) {
              localStorage.setItem(`wakti_local_summary_${conversationId}`, updatedSummary);
            }
          }
        } catch {}

        if (encounteredError) throw new Error(String(encounteredError));

        console.log(`✅ FRONTEND BOSS: Streaming completed successfully [${requestId}] (primary=${primary})`);
        return { response: fullResponse, metadata };
      };

      // Vision-first path (Option A rollout): if chat upload has images, prefer new vision endpoint
      const attemptVision = async (primary: 'claude' | 'openai', visionFiles: any[]) => {
        if (!visionFiles || visionFiles.length === 0) {
          throw new Error('No images for vision');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No valid session for vision');
        }
        let maybeAnonKey;
        try {
          maybeAnonKey = (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY)
            || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
        } catch (e) {
          maybeAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
        }

        const pt = this.ensurePersonalTouch();
        const supabaseUrl = ((import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL)
          || 'https://hxauxozopvpzpdygoqwf.supabase.co';

        const resp = await fetch(`${supabaseUrl}/functions/v1/wakti-vision-stream`, {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'omit',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'apikey': maybeAnonKey
          },
          body: JSON.stringify({
            requestId,
            prompt: message,
            language,
            personalTouch: pt,
            provider: primary,
            images: visionFiles,
            options: { ocr: true, max_tokens: 1200 }
          }),
          signal
        });

        if (!resp.ok) throw new Error(`Vision HTTP ${resp.status}`);

        const reader = resp.body?.getReader();
        if (!reader) throw new Error('No response body reader for vision');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let metadata: any = {};
        let encounteredError: string | null = null;
        let isCompleted = false;

        const abortHandler = async () => { try { await reader.cancel(); } catch {} };
        if (signal) {
          if (signal.aborted) {
            await abortHandler();
            throw new Error('Streaming aborted');
          }
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (!isCompleted) onComplete?.(metadata);
              console.log(`✅ VISION: Stream closed cleanly [${requestId}] (primary=${primary})`);
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') {
                if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                console.log(`🏁 VISION: Received [DONE] [${requestId}] (primary=${primary})`);
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  encounteredError = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message || 'vision_error');
                  continue;
                }
                if (parsed.json && typeof parsed.json === 'object') {
                  metadata = { ...metadata, visionJson: parsed.json };
                  continue;
                }
                if (typeof parsed.token === 'string') {
                  onToken?.(parsed.token);
                  fullResponse += parsed.token;
                } else if (typeof parsed.content === 'string') {
                  onToken?.(parsed.content);
                  fullResponse += parsed.content;
                }
                if (parsed.metadata && typeof parsed.metadata === 'object') {
                  metadata = { ...metadata, ...parsed.metadata };
                }
              } catch {
                onToken?.(data);
                fullResponse += data;
              }
            }
          }
        } finally {
          try { reader.releaseLock(); } catch {}
          if (signal) signal.removeEventListener('abort', abortHandler as any);
          try { localStorage.setItem('wakti_last_seen_at', String(Date.now())); } catch {}
        }

        if (encounteredError) throw new Error(String(encounteredError));
        return { response: fullResponse, metadata };
      };

      // Try Claude first, then auto-fallback to OpenAI on 529/overloaded errors (text/search or fallback vision)
      try {
        // If we have images from Chat upload, attempt the new Vision endpoint first (Option A)
        if (attachedFiles && attachedFiles.length > 0 && activeTrigger !== 'image') {
          // Preflight: size-check and downscale large images client-side to avoid gateway aborts
          let processedFiles: any[] = [];
          try {
            processedFiles = await this.prepareVisionAttachments(attachedFiles);
          } catch (prepErr: any) {
            const msg = (prepErr?.message || 'Images too large. Please upload smaller images.');
            onError?.(msg);
            return { response: msg, conversationId, metadata: { vision: 'client_preflight_reject' } } as any;
          }
          // Compute client bytes total
          let clientBytesTotal = 0;
          for (const p of processedFiles) {
            const type = (p.type || p.mimeType || '').toString();
            const isImage = typeof type === 'string' && type.startsWith('image/');
            const raw = typeof p.data === 'string' && p.data ? p.data : (typeof p.content === 'string' ? p.content : '');
            if (isImage && raw) clientBytesTotal += this.approxBase64Bytes(raw);
          }
          // Send base64 directly to wakti-vision-stream (skip Storage)
          const base64Files = processedFiles.map((p, idx) => ({
            data: (typeof p.data === 'string' && p.data) ? p.data : (typeof p.content === 'string' ? p.content : ''),
            mimeType: (p.type || p.mimeType || 'image/jpeg').toString(),
            index: idx
          })).filter(it => it.data);
          try {
            const vres = await attemptVision('claude', base64Files);
            return { response: vres.response, conversationId, metadata: vres.metadata };
          } catch (vErr: any) {
            const msg = String(vErr?.message || vErr || '').toLowerCase();
            const shouldFallbackVision = msg.includes('overloaded') || msg.includes('529') || msg.includes('claude');
            if (shouldFallbackVision) {
              console.warn('⚠️ Vision Claude overloaded, falling back to OpenAI Vision...');
              const vres2 = await attemptVision('openai', base64Files);
              return { response: vres2.response, conversationId, metadata: vres2.metadata };
            }
            console.warn('⚠️ Vision endpoint failed, falling back to brain stream...');
          }
        }

        // Normal chat path (or vision fallback to brain)
        const res = await attemptStream('claude');
        return { response: res.response, conversationId, metadata: res.metadata };
      } catch (err: any) {
        const msg = String(err?.message || err || '').toLowerCase();
        const shouldFallback = msg.includes('overloaded') || msg.includes('529') || msg.includes('claude');
        if (shouldFallback) {
          console.warn('⚠️ Claude overloaded, auto-falling back to OpenAI Vision...');
          const res2 = await attemptStream('openai');
          return { response: res2.response, conversationId, metadata: res2.metadata };
        }
        throw err;
      }
    } catch (error: any) {
      console.error('❌ FRONTEND BOSS: Streaming failed:', error);
      onError?.(error.message || 'Streaming failed');
      throw error;
    }
  }

  async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = [],
    signal?: AbortSignal,
    imageMode?: string,
    imageQuality?: 'fast' | 'best_fast'
  ) {
    try {
      // Ensure user id
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      const pt = this.ensurePersonalTouch();

      // Compute client local hour and welcome-back flag
      const clientLocalHour = new Date().getHours();
      let isWelcomeBack = false;
      try {
        const lastSeenStr = localStorage.getItem('wakti_last_seen_at');
        if (lastSeenStr) {
          const gapMs = Date.now() - Number(lastSeenStr);
          isWelcomeBack = gapMs >= 12 * 60 * 60 * 1000; // 12 hours
        }
      } catch {}

      // Load user location once (country, city) to include in metadata
      const location = await this.getUserLocation(userId);

      // Enhanced message handling with 20-message memory
      const enhancedMessages = this.getEnhancedMessages(recentMessages);
      const generatedSummary = this.generateConversationSummary(enhancedMessages);

      // Load stored rolling summary (Supabase by conversation UUID, else local fallback)
      let storedSummary: string | null = null;
      const uuidLike = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId || '');
      try {
        if (uuidLike && conversationId) {
          const { data: row } = await supabase
            .from('ai_conversation_summaries')
            .select('summary_text')
            .eq('conversation_id', conversationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          storedSummary = (row as any)?.summary_text || null;
        } else if (conversationId) {
          storedSummary = localStorage.getItem(`wakti_local_summary_${conversationId}`) || null;
        }
      } catch {}

      const pieces = [conversationSummary, storedSummary, generatedSummary].filter((s) => !!(s && (s as string).trim())) as string[];
      const finalSummary = pieces.join(' ').slice(0, 1200);

      // Special-case: YouTube Search via Edge Function when in Search mode and message is prefixed with 'yt:' or 'yt '
      if (activeTrigger === 'search') {
        const ytPrefixMatch = /^(?:\s*yt:\s*|\s*yt\s+)(.*)$/i.exec(message || '');
        if (ytPrefixMatch) {
          const query = (ytPrefixMatch[1] || '').trim();
          if (!query) {
            return {
              response: language === 'ar' ? 'يرجى إدخال عبارة للبحث في يوتيوب.' : 'Please enter a query to search YouTube.',
              error: false,
              intent: 'search'
            } as any;
          }

          // Auth headers required for calling Edge Functions (mirror existing calls)
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('No valid session for YouTube search');
          }
          let maybeAnonKey;
          try {
            maybeAnonKey = (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY)
              || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
          } catch (e) {
            maybeAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
          }
          // Fallback to hosted project URL if local env var is missing
          const supabaseUrl = ((import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL)
            || 'https://hxauxozopvpzpdygoqwf.supabase.co';

          const resp = await fetch(`${supabaseUrl}/functions/v1/youtube-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': maybeAnonKey
            },
            body: JSON.stringify({ query }),
            signal
          });

          if (!resp.ok) {
            return {
              response: language === 'ar' ? 'تعذر الوصول إلى بحث يوتيوب حالياً.' : 'Unable to reach YouTube search right now.',
              error: true,
              intent: 'search',
              metadata: { youtubeError: 'network' }
            } as any;
          }

          const data = await resp.json();
          if (data?.error === 'quota_exceeded') {
            return {
              response: language === 'ar' ? 'تم استهلاك حصة واجهة برمجة تطبيقات يوتيوب لهذا اليوم. حاول لاحقًا.' : 'YouTube API quota is exhausted for today. Please try again later.',
              error: false,
              intent: 'search',
              metadata: { youtubeError: 'quota' }
            } as any;
          }
          if (data?.message === 'no_results' || (Array.isArray(data?.results) && data.results.length === 0)) {
            return {
              response: language === 'ar' ? 'لا توجد نتائج فيديو مطابقة لبحثك.' : 'No YouTube results matched your query.',
              error: false,
              intent: 'search',
              metadata: { youtubeError: 'no_results' }
            } as any;
          }

          const top = Array.isArray(data?.results) ? data.results[0] : null;
          if (!top?.videoId) {
            return {
              response: language === 'ar' ? 'لم يتم العثور على نتائج صالحة.' : 'No valid results found.',
              error: false,
              intent: 'search',
              metadata: { youtubeError: 'invalid' }
            } as any;
          }

          const title = top.title ? String(top.title) : '';
          const videoId = String(top.videoId);
          const description = top.description ? String(top.description) : '';
          const thumbnail = top.thumbnail ? String(top.thumbnail) : '';

          return {
            response: title || (language === 'ar' ? 'نتيجة من يوتيوب' : 'YouTube result'),
            error: false,
            intent: 'search',
            modelUsed: 'youtube-search',
            browsingUsed: true,
            metadata: { youtube: { videoId, title, description, thumbnail } }
          } as any;
        }
      }

      // Image generation uses dedicated non-streaming functions
      if (activeTrigger === 'image') {
        const mode = (imageMode as any) || 'text2image';
        // Common auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No valid session for non-streaming');
        }
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co';

        // Background removal/replace mode: send exact Runware shape via Edge Function
        if (mode === 'background-removal') {
          const firstImg = Array.isArray(attachedFiles) ? attachedFiles.find((f: any) => f?.type?.startsWith('image/')) : undefined;
          const rawB64 = firstImg?.data || firstImg?.content || '';
          if (!rawB64) {
            return { response: language === 'ar' ? 'الرجاء إرفاق صورة لإزالة/استبدال الخلفية.' : 'Please attach an image for background removal/replacement.', error: true };
          }
          // Normalize to data URI if needed (Runware expects URL or dataURI)
          const mime = (firstImg?.type && typeof firstImg.type === 'string') ? firstImg.type : 'image/jpeg';
          const imageParam = (typeof rawB64 === 'string' && (rawB64.startsWith('data:') || rawB64.startsWith('http')))
            ? rawB64
            : `data:${mime};base64,${rawB64}`;

          const resp = await fetch(`${supabaseUrl}/functions/v1/image-background-removal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              referenceImages: [imageParam],
              positivePrompt: (message || '').toString().replace(/"\s*$/,'').trim(),
              outputType: ["dataURI","URL"],
              outputFormat: 'JPEG',
              outputQuality: 85
            }),
            signal
          });

          const json = await resp.json().catch(() => ({} as any));
          if (!resp.ok) {
            console.error('image-background-removal failed', resp.status, json);
            return { response: language === 'ar' ? 'تعذر تنفيذ تحرير الخلفية حالياً.' : 'Background edit failed.', error: true } as any;
          }
          const outUrl = (json as any)?.imageUrl || (json as any)?.URL || null;
          const outData = (json as any)?.imageDataURI || (json as any)?.dataURI || null;
          if (!outUrl && !outData) {
            console.error('image-background-removal no output', json);
            return { response: language === 'ar' ? 'لم يتم توليد صورة. حاول تعديل التعليمات.' : 'No image generated. Please refine your instruction.', error: true } as any;
          }
          return {
            response: language === 'ar' ? 'تم تعديل الخلفية.' : 'Background edited.',
            imageUrl: outUrl || outData,
            error: false,
            metadata: { provider: 'runware', model: (json as any)?.model || 'google:4@1', mode }
          } as any;
        }

        if (mode === 'image2image') {
          // Extract first image base64 (raw) from attachedFiles
          const firstImg = Array.isArray(attachedFiles) ? attachedFiles.find((f: any) => f?.type?.startsWith('image/')) : undefined;
          const rawB64 = firstImg?.data || firstImg?.content || '';
          if (!rawB64) {
            return { response: language === 'ar' ? 'الرجاء إرفاق صورة لاستخدام التحويل صورة-إلى-صورة.' : 'Please attach an image to use image-to-image.', error: true };
          }
          const resp = await fetch(`${supabaseUrl}/functions/v1/wakti-image2image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              user_prompt: message,
              image_base64: rawB64, // function accepts raw base64 or dataURI
              user_id: userId
            }),
            signal
          });
          const json = await resp.json().catch(() => ({} as any));
          if (!resp.ok || !json?.success || !json?.url) {
            console.error('wakti-image2image failed', resp.status, json);
            return { response: language === 'ar' ? 'فشل إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'Image generation failed. Please try again.', error: true };
          }
          return {
            response: language === 'ar' ? 'تم إنشاء الصورة.' : 'Image generated.',
            imageUrl: json.url,
            error: false,
            metadata: { provider: 'runware', model: (json as any)?.model || 'runware:108@20', mode }
          } as any;
        }

        // Text2Image now uses a dedicated Edge Function (decoupled from the brain)
        // Reuse existing session and supabaseUrl from the image branch to avoid duplicate declarations
        if (!session?.access_token) {
          throw new Error('No valid session for text2image');
        }
        const resp = await fetch(`${supabaseUrl}/functions/v1/wakti-text2image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            prompt: message,
            quality: imageQuality || 'fast',
            user_id: userId
          }),
          signal
        });
        const json = await resp.json().catch(() => ({} as any));
        if (!resp.ok || !json?.success || !json?.url) {
          console.error('wakti-text2image failed', resp.status, json);
          return { response: language === 'ar' ? 'فشل إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'Image generation failed. Please try again.', error: true } as any;
        }
        return {
          response: language === 'ar' ? 'تم إنشاء الصورة.' : 'Image generated.',
          imageUrl: json.url,
          error: false,
          metadata: { provider: 'runware', model: (json as any)?.model || (imageQuality === 'best_fast' ? 'runware:108@20' : 'runware:106@1'), quality: imageQuality || 'fast', mode }
        } as any;
      }

      // Vision/chat/search accumulation via streaming method under the hood
      const streamed = await this.sendStreamingMessage(
        message,
        userId,
        language,
        conversationId,
        inputType,
        enhancedMessages,
        skipContextLoad,
        activeTrigger,
        finalSummary,
        attachedFiles,
        undefined,
        undefined,
        undefined,
        signal
      );

      const meta = streamed?.metadata || {};
      return {
        response: streamed?.response || '',
        conversationId: streamed?.conversationId || conversationId,
        error: false,
        browsingUsed: meta?.browsingUsed,
        browsingData: meta?.browsingData,
        modelUsed: meta?.model,
        responseTime: meta?.responseTime,
        fallbackUsed: meta?.fallbackUsed
      };
    } catch (error: any) {
      console.error('❌ FRONTEND BOSS: sendMessage failed:', error);
      // Return friendly shape expected by callers
      return {
        response: language === 'ar' ? 'أعتذر، لست متاح حالياً. يرجى المحاولة مرة أخرى.' : "I apologize, I'm not available right now. Please try again.",
        error: true
      };
    }
  }

  // Legacy methods - now handled by frontend
  async getConversations(): Promise<AIConversation[]> {
    console.log('⚠️ BACKEND WORKER: getConversations called - should use frontend memory instead');
    return [];
  }

  async getConversationMessages(conversationId: string): Promise<any[]> {
    console.log('⚠️ BACKEND WORKER: getConversationMessages called - should use frontend memory instead');
    return [];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    console.log('⚠️ BACKEND WORKER: deleteConversation called - should use frontend memory instead');
  }

  saveChatSession(messages: AIMessage[], conversationId?: string | null) {
    console.log('⚠️ BACKEND WORKER: saveChatSession called - should use EnhancedFrontendMemory instead');
  }

  loadChatSession(): { messages: AIMessage[], conversationId?: string | null } | null {
    console.log('⚠️ BACKEND BOSS: loadChatSession called - should use EnhancedFrontendMemory instead');
    return null;
  }

  clearChatSession() {
    console.log('⚠️ BACKEND WORKER: clearChatSession called - should use EnhancedFrontendMemory instead');
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
