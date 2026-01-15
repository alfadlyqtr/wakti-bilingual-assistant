// @ts-nocheck
import { supabase, ensurePassport, getCurrentUserId } from '@/integrations/supabase/client';
import { getNativeLocation, queryNeedsFreshLocation, clearLocationCache } from '@/integrations/natively/locationBridge';

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
  chatSubmode?: 'chat' | 'study';
  replyTo?: string; // ID of the message being replied to
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

type UserLocationContext = {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  timezone?: string | null;
  source?: 'native' | 'ip' | 'profile';
  updatedAt?: number;
};

const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;
  private conversationStorage = new Map<string, AIMessage[]>();
  private locationCache: UserLocationContext | null = null;
  private lastPTFetchAt: number | null = null;

  constructor() {
    console.log('🤖 WAKTI AI SERVICE: Initialized as Backend Worker (Frontend Boss mode)');
    this.loadConversationsFromStorage();
    try { this.ensurePersonalTouch(); } catch {}
  }

  private async convertImage(base64Data: string, mimeType: string): Promise<{ data: string; type: string }> {
    if (!this.isBrowser()) return { data: base64Data, type: mimeType || 'image/jpeg' };
    const src = base64Data.startsWith('data:') ? base64Data : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;
    return await new Promise<{ data: string; type: string }>((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        console.error('❌ Image conversion timeout');
        reject(new Error('Image conversion timeout'));
      }, 10000); // 10s timeout
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const w = img.width || 1;
          const h = img.height || 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) { 
            console.error('❌ Failed to get canvas context');
            resolve({ data: base64Data, type: mimeType || 'image/jpeg' }); 
            return; 
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const out = canvas.toDataURL('image/jpeg', 0.9);
          const b64 = out.split(',')[1] || '';
          resolve({ data: b64 || base64Data, type: 'image/jpeg' });
        } catch (err) {
          console.error('❌ Image conversion error:', err);
          resolve({ data: base64Data, type: mimeType || 'image/jpeg' });
        }
      };
      img.onerror = (err) => {
        clearTimeout(timeout);
        console.error('❌ Image load error:', err);
        resolve({ data: base64Data, type: mimeType || 'image/jpeg' });
      };
      img.src = src;
    });
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

  // Option A cross-device: pull server PT if newer (lightweight, called lazily)
  private async maybeRefreshPersonalTouchFromServer(userId?: string) {
    try {
      const now = Date.now();
      if (this.lastPTFetchAt && now - this.lastPTFetchAt < 2 * 60 * 1000) return; // 2 min throttle
      const { data: { user } } = await supabase.auth.getUser();
      const uid = userId || user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from('user_personal_touch')
        .select('nickname, ai_nickname, tone, style, instruction, pt_version, updated_at')
        .eq('user_id', uid)
        .maybeSingle();
      this.lastPTFetchAt = now;
      if (error || !data) return;

      const serverPT: any = {
        nickname: data.nickname || '',
        aiNickname: data.ai_nickname || '',
        tone: data.tone || 'neutral',
        style: data.style || 'short answers',
        instruction: data.instruction || '',
        pt_version: typeof data.pt_version === 'number' ? data.pt_version : 1,
        pt_updated_at: data.updated_at || new Date().toISOString()
      };

      let localPT: any = null;
      try { const raw = localStorage.getItem('wakti_personal_touch'); localPT = raw ? JSON.parse(raw) : null; } catch {}

      const localVersion = typeof localPT?.pt_version === 'number' ? localPT.pt_version : 0;
      const serverVersion = typeof serverPT.pt_version === 'number' ? serverPT.pt_version : 0;
      const localUpdated = localPT?.pt_updated_at ? Date.parse(localPT.pt_updated_at) : 0;
      const serverUpdated = serverPT?.pt_updated_at ? Date.parse(serverPT.pt_updated_at) : 0;

      const serverIsNewer = serverVersion > localVersion || (serverVersion === localVersion && serverUpdated > localUpdated);
      if (serverIsNewer) {
        try {
          localStorage.setItem('wakti_personal_touch', JSON.stringify(serverPT));
          this.personalTouchCache = serverPT;
        } catch {}
      }
    } catch {}
  }

  // Fetch user's location context once and cache (localStorage + memory)
  // If forceFresh is true, skip cache and get fresh location (for "near me" queries)
  private async getUserLocation(userId: string, forceFresh: boolean = false): Promise<UserLocationContext> {
    const now = Date.now();
    
    // Skip cache if forceFresh is requested (e.g., "near me" queries)
    if (!forceFresh) {
      if (this.locationCache && this.locationCache.updatedAt && now - this.locationCache.updatedAt < LOCATION_CACHE_TTL) {
        return this.locationCache;
      }

      // LocalStorage fallback with TTL validation
      try {
        const raw = localStorage.getItem('wakti_user_location');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            parsed.timezone = parsed.timezone || this.getClientTimezone();
            parsed.updatedAt = parsed.updatedAt || now;
            const isFresh = parsed.updatedAt && (now - parsed.updatedAt) < LOCATION_CACHE_TTL;
            if (isFresh) {
              this.locationCache = parsed;
              return this.locationCache;
            }
          }
        }
      } catch {}
    } else {
      console.log('[WaktiAIV2Service] Force fresh location requested (near me / weather / traffic query)');
      // Clear the native location cache to force fresh fetch
      clearLocationCache();
    }

    const timezone = this.getClientTimezone();
    let resolved: UserLocationContext = {
      country: null,
      city: null,
      latitude: null,
      longitude: null,
      accuracy: null,
      timezone,
      source: undefined,
      updatedAt: now,
    };

    // Try native location first (Natively SDK)
    // If forceFresh, request fresh location with skipCache
    try {
      const nativeLoc = await getNativeLocation({ skipCache: forceFresh });
      if (nativeLoc && typeof nativeLoc.latitude === 'number' && typeof nativeLoc.longitude === 'number') {
        resolved = {
          ...resolved,
          latitude: nativeLoc.latitude,
          longitude: nativeLoc.longitude,
          accuracy: nativeLoc.accuracy ?? null,
          city: nativeLoc.city || resolved.city,
          country: nativeLoc.country || resolved.country,
          source: 'native',
        };
      }
    } catch (err) {
      console.warn('[WaktiAIV2Service] Native location error:', err);
    }

    // NOTE: Browser geolocation removed per user request - Wakti native app users rely on Natively SDK.
    // Fallback chain: Natively → profile → IP geo (no browser GPS prompts)

    // Fetch from profiles as fallback for city/country
    if (!resolved.city || !resolved.country) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('country, city')
          .eq('id', userId)
          .maybeSingle();
        if (prof) {
          resolved.city = resolved.city || (prof as any)?.city || null;
          resolved.country = resolved.country || (prof as any)?.country || null;
          resolved.source = resolved.source || 'profile';
        }
      } catch {
        // ignore
      }
    }

    // IP-based fallback for coordinates/city/country if still missing
    if (!resolved.latitude || !resolved.longitude || !resolved.city || !resolved.country) {
      const ipLoc = await this.fetchIpLocation();
      if (ipLoc) {
        resolved = {
          ...resolved,
          latitude: resolved.latitude ?? ipLoc.latitude ?? null,
          longitude: resolved.longitude ?? ipLoc.longitude ?? null,
          city: resolved.city || ipLoc.city || null,
          country: resolved.country || ipLoc.country || null,
          source: resolved.source || ipLoc.source || 'ip',
        };
      }
    }

    resolved.timezone = timezone;
    resolved.updatedAt = Date.now();
    this.locationCache = resolved;
    try { localStorage.setItem('wakti_user_location', JSON.stringify(resolved)); } catch {}
    return resolved;
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

  private getClientTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private async fetchIpLocation(): Promise<Partial<UserLocationContext> | null> {
    if (typeof fetch === 'undefined') return null;
    try {
      const resp = await fetch('https://ipapi.co/json/');
      if (!resp.ok) return null;
      const data = await resp.json();
      const latitude = typeof data.latitude === 'number' ? data.latitude : (typeof data.lat === 'number' ? data.lat : null);
      const longitude = typeof data.longitude === 'number' ? data.longitude : (typeof data.lon === 'number' ? data.lon : null);
      return {
        latitude,
        longitude,
        city: data.city || null,
        country: data.country_name || data.country || null,
        source: 'ip',
      };
    } catch (err) {
      console.warn('[WaktiAIV2Service] IP location lookup failed:', err);
      return null;
    }
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
    const MAX_IMAGE_BYTES = 1.2 * 1024 * 1024; // ~1.2MB per image
    const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024; // ~2.5MB total
    const processed: any[] = [];
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    for (const f of files) {
      if (!f || typeof f !== 'object') { processed.push(f); continue; }
      let type = (f.type || f.mimeType || '').toString();
      // Normalize common alias
      if (type === 'image/jpg') type = 'image/jpeg';

      // Helper to extract raw base64 and optionally mime from a data URL
      const fromDataUrl = (u?: string): { b64: string; mime?: string } | null => {
        if (typeof u !== 'string' || !u.startsWith('data:')) return null;
        const commaIdx = u.indexOf(',');
        if (commaIdx === -1) return null;
        const header = u.slice(5, commaIdx); // e.g., image/jpeg;base64
        const semi = header.indexOf(';');
        const mime = semi !== -1 ? header.slice(0, semi) : header;
        const b64 = u.slice(commaIdx + 1);
        return { b64, mime };
      };

      // Prefer explicit raw fields
      let rawCandidate = (typeof f.data === 'string' && f.data)
        ? f.data
        : (typeof f.content === 'string' && f.content)
          ? f.content
          : '';

      // Fall back to base64 or data URLs if needed
      if (!rawCandidate && typeof f.base64 === 'string' && f.base64) {
        const asData = fromDataUrl(f.base64);
        rawCandidate = asData?.b64 || (f.base64.startsWith('data:') ? '' : f.base64);
        if (!type && asData?.mime) type = asData.mime;
      }
      if (!rawCandidate) {
        const fromUrl = fromDataUrl(f.url);
        if (fromUrl) {
          rawCandidate = fromUrl.b64;
          if (!type && fromUrl.mime) type = fromUrl.mime;
        }
      }
      if (!rawCandidate) {
        const fromPrev = fromDataUrl(f.preview);
        if (fromPrev) {
          rawCandidate = fromPrev.b64;
          if (!type && fromPrev.mime) type = fromPrev.mime;
        }
      }

      // Finalize type normalization
      if (type === 'image/jpg') type = 'image/jpeg';
      const isImage = typeof type === 'string' && type.startsWith('image/');
      const raw = rawCandidate;
      if (!isImage || !raw) { processed.push(f); continue; }
      let outBase64 = raw;
      if (type && !supportedTypes.includes(type)) {
        const converted = await this.convertImage(outBase64, type);
        outBase64 = converted.data;
        type = converted.type;
      }
      const bytes = this.approxBase64Bytes(raw);
      if (bytes > MAX_IMAGE_BYTES) {
        outBase64 = await this.downscaleBase64(raw, type, 1024, 0.7);
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
    
    // Apply smart filtering and return last 100 for better context retention
    return this.smartFilterMessages(uniqueMessages).slice(-100);
  }

  private smartFilterMessages(messages: AIMessage[]): AIMessage[] {
    if (!messages || messages.length === 0) return [];
    
    // Filter out redundant acknowledgments and keep important context
    const redundantPatterns = [
      /^(thank you|thanks|ok|okay|yes|no|sure|alright)$/i,
      /^(شكرا|حسنا|نعم|لا|طيب|ممتاز)$/i
    ];
    
    return messages.filter((msg, index) => {
      // Always keep the last 100 messages to maintain extended context
      if (index >= messages.length - 100) return true;
      
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
    
    // Rolling summary: Take messages except the last 30 (keep last 30 as direct recent context)
    // This ensures the summary covers the middle section of conversation history
    const summaryMessages = messages.slice(0, -30);
    if (summaryMessages.length === 0) return '';
    
    // Extract key topics and context
    const topics = new Set<string>();
    const userQuestions: string[] = [];
    const assistantActions: string[] = [];
    
    summaryMessages.forEach(msg => {
      if (msg.role === 'user' && msg.content.length > 30) {
        // Extract potential topics/keywords from older messages
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['about', 'could', 'would', 'should', 'please', 'think', 'really', 'thing', 'know'].includes(word)) {
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
    
    // Build concise summary with context markers
    let summary = '';
    if (topics.size > 0) {
      const topicList = Array.from(topics).slice(0, 8).join(', ');
      summary += `Earlier topics: ${topicList}. `;
    }
    if (userQuestions.length > 0) {
      summary += `Key questions: ${userQuestions.slice(-2).join(' | ')}. `;
    }
    if (assistantActions.length > 0) {
      summary += `${assistantActions.length} actions performed. `;
    }
    
    // Add context marker to help AI understand this is older history
    if (summary.trim()) {
      summary = `[Earlier conversation context] ${summary.trim()}`;
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
      // Keep only last 30 messages to prevent storage overflow
      const messagesToStore = messages.slice(-30);
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
    signal?: AbortSignal,
    chatSubmode: 'chat' | 'study' = 'chat'
  ) {
    try {
      // Gate for emergency non-streaming fallback (disabled by default; streaming stays streaming)
      const ENABLE_CORS_FALLBACK = false;
      if (!userId) {
        await ensurePassport();
        userId = await getCurrentUserId();
        if (!userId) throw new Error('Authentication required');
      }

      try { await this.maybeRefreshPersonalTouchFromServer(userId); } catch {}

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
      // If query contains "near me", weather, or traffic patterns, force fresh location
      const needsFreshLocation = queryNeedsFreshLocation(message);
      if (needsFreshLocation) {
        console.log(`📍 LOCATION: Query needs fresh location - "${message.substring(0, 50)}..."`);
      }
      const location = await this.getUserLocation(userId, needsFreshLocation);
      const clientTimezone = location?.timezone || this.getClientTimezone();

      // Enhanced message handling with 100-message memory window
      // CRITICAL: Strip large data to avoid huge request bodies that crash Edge Functions
      const rawEnhanced = this.getEnhancedMessages(recentMessages);
      const enhancedMessages = rawEnhanced.map(msg => {
        const cleaned: any = { ...msg };
        
        // Strip base64 data from attachedFiles (vision images)
        if (cleaned.attachedFiles && Array.isArray(cleaned.attachedFiles)) {
          cleaned.attachedFiles = cleaned.attachedFiles.map((f: any) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            imageType: f.imageType,
          }));
        }
        
        // Strip search metadata (contains huge raw_content from web scraping)
        if (cleaned.metadata?.search) {
          cleaned.metadata = {
            ...cleaned.metadata,
            search: {
              answer: cleaned.metadata.search.answer?.substring(0, 500),
              total: cleaned.metadata.search.total,
              // Exclude full results array - it's massive
            }
          };
        }
        
        // Truncate very long content (e.g., from search results)
        if (cleaned.content && cleaned.content.length > 2000) {
          cleaned.content = cleaned.content.substring(0, 2000) + '... [truncated]';
        }
        
        return cleaned;
      });
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

            console.log(`📡 CHAT: Attempt ${attempt}/${maxRetries} - Calling brain-stream [${requestId}]`);
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
                chatSubmode,
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
                clientTimezone,
                visionPrimary: primary,
                visionFallback: primary === 'claude' ? 'openai' : 'claude'
              }),
              signal
            });
            console.log(`📡 CHAT: Response status=${response.status} ok=${response.ok} [${requestId}]`);

            if (response.ok) break;

            if (attempt === maxRetries) {
              // On last attempt, try non-streaming fallback before throwing
              const status = response.status;
              const statusText = response.statusText;
              const isGatewayish = [504, 502, 522, 524].includes(status);
              if (ENABLE_CORS_FALLBACK && isGatewayish) {
                try {
                  const supabaseUrl = ((import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || 'https://hxauxozopvpzpdygoqwf.supabase.co';
                  const fallbackResp = await fetch(`${supabaseUrl}/functions/v1/text-generator`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                      'apikey': maybeAnonKey
                    },
                    body: JSON.stringify({
                      message,
                      language,
                      conversationId,
                      activeTrigger,
                      recentMessages: enhancedMessages,
                      conversationSummary: finalSummary,
                      personalTouch: pt,
                      location,
                      clientTimezone
                    })
                  });
                  if (fallbackResp.ok) {
                    const json = await fallbackResp.json().catch(()=>({}));
                    const respText = (json?.response || json?.text || '').toString();
                    onToken?.(respText);
                    onComplete?.(json?.metadata || {});
                    return { response: respText, metadata: json?.metadata || {} } as any;
                  }
                } catch {}
              }
              throw new Error(`HTTP ${status}: ${statusText}`);
            }

            // Brief delay before retry on mobile networks
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

          } catch (error: any) {
            if (attempt === maxRetries || error.name === 'AbortError') {
              // On last attempt with a network/CORS style error, try non-streaming fallback once
              const msg = String(error?.message || error || '').toLowerCase();
              const looksCorsish = msg.includes('failed to fetch') || msg.includes('cors');
              if (ENABLE_CORS_FALLBACK && attempt === maxRetries && looksCorsish) {
                try {
                  const supabaseUrl = ((import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || 'https://hxauxozopvpzpdygoqwf.supabase.co';
                  const fallbackResp = await fetch(`${supabaseUrl}/functions/v1/text-generator`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session.access_token}`,
                      'Content-Type': 'application/json',
                      'apikey': maybeAnonKey
                    },
                    body: JSON.stringify({
                      message,
                      language,
                      conversationId,
                      activeTrigger,
                      recentMessages: enhancedMessages,
                      conversationSummary: finalSummary,
                      personalTouch: this.ensurePersonalTouch()
                    })
                  });
                  if (fallbackResp.ok) {
                    const json = await fallbackResp.json().catch(()=>({}));
                    const respText = (json?.response || json?.text || '').toString();
                    onToken?.(respText);
                    onComplete?.(json?.metadata || {});
                    return { response: respText, metadata: json?.metadata || {} } as any;
                  }
                } catch {}
              }
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
              // Flush any remaining buffered SSE data (prevents final chunk from being dropped)
              try {
                const tail = (buffer || '').trim();
                if (tail) {
                  const tailLines = tail.split('\n');
                  buffer = '';
                  for (const tailLine of tailLines) {
                    const line = tailLine.trim();
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    console.log('🔍 SSE RAW (tail):', data);

                    if (data === '[DONE]') {
                      if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                      console.log(`🏁 FRONTEND BOSS: Received [DONE] (tail) [${requestId}] (primary=${primary})`);
                      continue;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      console.log('🔍 SSE PARSED (tail):', parsed);
                      if (parsed.error) {
                        const errObj = parsed.error;
                        const errMsg = typeof errObj === 'string'
                          ? errObj
                          : (errObj?.message || errObj?.type || JSON.stringify(errObj));
                        encounteredError = errMsg;
                      } else {
                        if (typeof parsed.token === 'string') { fullResponse += parsed.token; onToken?.(parsed.token); }
                        else if (typeof parsed.response === 'string') { fullResponse += parsed.response; onToken?.(parsed.response); }
                        else if (typeof parsed.content === 'string') { fullResponse += parsed.content; onToken?.(parsed.content); }
                        if (parsed.metadata && typeof parsed.metadata === 'object') {
                          metadata = { ...metadata, ...parsed.metadata };
                        }
                        if (parsed.done === true) {
                          if (!isCompleted) { onComplete?.(parsed.metadata || metadata); isCompleted = true; }
                        }
                      }
                    } catch {
                      fullResponse += data;
                      onToken?.(data);
                    }
                  }
                }
              } catch {}
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
              console.log('🔍 SSE RAW:', data);

              if (data === '[DONE]') {
                if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                console.log(`🏁 FRONTEND BOSS: Received [DONE] [${requestId}] (primary=${primary})`);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                console.log('🔍 SSE PARSED:', parsed);
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

      // Vision-first path via Supabase Edge Function: stream SSE and honor provider
      const attemptVision = async (primary: 'claude' | 'openai', visionFiles: any[]) => {
        // Check if aborted before starting any work
        if (signal?.aborted) {
          throw new Error('Vision request aborted before start');
        }

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

        // Prefer URL-based images: upload to Supabase Storage, then send URLs; fallback to base64 if upload fails
        const bucket = (((import.meta as any).env && (import.meta as any).env.VITE_VISION_BUCKET) || 'vision-uploads') + '';
        const toBlob = (b64: string, mime: string) => {
          try {
            const cleaned = b64.startsWith('data:') ? b64.split(',')[1] || '' : b64;
            const bin = atob(cleaned);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: mime });
          } catch {
            return null;
          }
        };

        const payloadImages: { mimeType: string; url?: string; base64?: string }[] = [];
        for (let i = 0; i < (visionFiles || []).length; i++) {
          const p: any = visionFiles[i];
          const mime = ((p?.type || p?.mimeType || 'image/jpeg') + '').replace('image/jpg', 'image/jpeg');
          let base64 = typeof p?.data === 'string' && p.data ? p.data : (typeof p?.content === 'string' ? p.content : '');
          if (!base64 || base64.length < 100) continue;
          // Try upload -> signed URL
          let uploadedUrl: string | null = null;
          try {
            const idx = base64.indexOf(',');
            if (base64.startsWith('data:') && idx > -1) base64 = base64.slice(idx + 1);
            const blob = toBlob(base64, mime);
            if (!blob) throw new Error('blob_conv');
            const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
            // Use a single fixed bucket for simplicity
            const bucketName = 'vision-uploads';
            const uid = (userId || 'anon').toString();
            const path = `vision/${uid}/${requestId}/${Date.now()}_${i}.${ext}`;
            console.log('📤 VISION UPLOAD → bucket:', bucketName, 'path:', path, 'mime:', mime);
            const up = await supabase.storage.from(bucketName).upload(path, blob, { contentType: mime, upsert: true });
            if (up?.error) throw up.error;
            // Try public URL first
            const pub = supabase.storage.from(bucketName).getPublicUrl(path);
            if (pub?.data?.publicUrl) {
              uploadedUrl = pub.data.publicUrl;
            } else {
              const signed = await supabase.storage.from(bucketName).createSignedUrl(path, 600);
              if (signed?.data?.signedUrl) uploadedUrl = signed.data.signedUrl;
            }
          } catch (_) {
            uploadedUrl = null;
          }
          if (uploadedUrl) {
            payloadImages.push({ mimeType: mime, url: uploadedUrl });
          } else {
            // Do NOT fallback to base64 for large requests; fail fast to avoid EOF on body read
            console.error('❌ VISION UPLOAD failed for image index', i, 'mime:', mime, 'request:', requestId);
            throw new Error('vision_upload_failed');
          }
        }

        if (payloadImages.length === 0) {
          throw new Error('No valid images to send (all images filtered out)');
        }

        const visionPrompt = (() => {
          const n = payloadImages.length;
          // Normal analysis mode: analyze the images
          if (n <= 1) return message;
          const header = language === 'ar'
            ? `مهم جداً: لديك ${n} صور. يجب تحليل جميع الصور بالترتيب وعدم تجاهل أي صورة. اكتب نتيجتك بهذه الأقسام بالضبط: صورة 1، صورة 2${n >= 3 ? '، صورة 3' : ''}${n >= 4 ? '، صورة 4' : ''}. إذا كانت الصور مستندات، استخرج النص من كل صورة ثم قارن بينها.`
            : `CRITICAL: You received ${n} images. You MUST analyze ALL images in order and not ignore any. Format your answer with these exact sections: Image 1, Image 2${n >= 3 ? ', Image 3' : ''}${n >= 4 ? ', Image 4' : ''}. If the images are documents, extract text from each image and then compare.`;
          return `${header}\n\nUser prompt:\n${message}`;
        })();

        // Call Supabase Edge Function with SSE streaming (stream:true). Server may still return JSON if it chooses.
        let resp: Response | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`🚀 VISION(SSE): Attempt ${attempt}/2 - Calling ${supabaseUrl}/functions/v1/wakti-vision-stream (provider=${primary})`);
            const body = {
              requestId: requestId,
              prompt: visionPrompt,
              language,
              personalTouch: pt,
              provider: primary,
              model: primary === 'claude' ? 'claude-3-5-haiku-20241022' : 'gpt-4o',
              stream: true,
              images: payloadImages,
              options: { ocr: true, max_tokens: 2000 },
              chatSubmode: chatSubmode // Pass Study mode to Vision for tutor-style responses
            };
            resp = await fetch(`${supabaseUrl}/functions/v1/wakti-vision-stream`, {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'omit',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Accept': 'text/event-stream',
                'apikey': maybeAnonKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            });
            console.log(`📡 VISION: Response status=${resp.status} ok=${resp.ok}`);
            if (resp.ok) break;
            if (attempt === 2) throw new Error(`Vision HTTP ${resp.status}`);
          } catch (e: any) {
            console.error(`❌ VISION: Attempt ${attempt} failed:`, e.message || e);
            if (attempt === 2) throw e;
            await new Promise(r => setTimeout(r, 800 * attempt));
          }
        }
        const respNonNull = resp as Response;
        if (!respNonNull.ok) throw new Error(`Vision HTTP ${respNonNull.status}`);

        // If server returns plain JSON, consume it directly and finish without streaming
        const ct = (respNonNull.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const result = await respNonNull.json();
          let metadata: any = {};
          if (result?.json && typeof result.json === 'object') metadata.visionJson = result.json;
          if (result?.metadata && typeof result.metadata === 'object') metadata = { ...metadata, ...result.metadata };
          const summary = typeof result?.summary === 'string' ? result.summary : '';
          if (summary) onToken?.(summary);
          onComplete?.(metadata);
          return { response: summary, metadata };
        }

        // Otherwise fallback to SSE streaming parsing
        const reader = respNonNull.body?.getReader();
        if (!reader) throw new Error('No response body reader for vision');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let metadata: any = {};
        let encounteredError: string | null = null;
        let isCompleted = false;

        const abortHandler = async () => { try { await reader.cancel(); } catch {} };
        if (signal) {
          if (signal.aborted) { await abortHandler(); throw new Error('Streaming aborted'); }
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Flush any remaining buffered SSE data (prevents final chunk from being dropped)
              try {
                const tail = (buffer || '').trim();
                if (tail) {
                  const tailLines = tail.split('\n');
                  buffer = '';
                  for (const tailLine of tailLines) {
                    const line = tailLine.trim();
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                      if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                      continue;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.error) {
                        encounteredError = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message || 'vision_error');
                        continue;
                      }
                      if (parsed.json && typeof parsed.json === 'object') { metadata = { ...metadata, visionJson: parsed.json }; continue; }
                      if (typeof parsed.token === 'string') { onToken?.(parsed.token); fullResponse += parsed.token; }
                      else if (typeof parsed.content === 'string') { onToken?.(parsed.content); fullResponse += parsed.content; }
                      if (parsed.metadata && typeof parsed.metadata === 'object') { metadata = { ...metadata, ...parsed.metadata }; }
                    } catch {
                      onToken?.(data);
                      fullResponse += data;
                    }
                  }
                }
              } catch {}
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
              if (data === '[DONE]') { if (!isCompleted) { onComplete?.(metadata); isCompleted = true; } continue; }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) { encounteredError = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message || 'vision_error'); continue; }
                if (parsed.json && typeof parsed.json === 'object') { metadata = { ...metadata, visionJson: parsed.json }; continue; }
                if (typeof parsed.token === 'string') { onToken?.(parsed.token); fullResponse += parsed.token; }
                else if (typeof parsed.content === 'string') { onToken?.(parsed.content); fullResponse += parsed.content; }
                if (parsed.metadata && typeof parsed.metadata === 'object') { metadata = { ...metadata, ...parsed.metadata }; }
              } catch { onToken?.(data); fullResponse += data; }
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
          // Send processed base64 images directly (Option A)
          try {
            const vres = await attemptVision('claude', processedFiles);
            return { response: vres.response, conversationId, metadata: vres.metadata };
          } catch (vErr: any) {
            const msg = String(vErr?.message || vErr || '').toLowerCase();
            const shouldFallbackVision = msg.includes('overloaded') || msg.includes('529') || msg.includes('claude') || msg.includes('not_found') || msg.includes('404');
            if (shouldFallbackVision) {
              console.warn('⚠️ Vision Claude failed/overloaded, falling back to OpenAI Vision...');
              const vres2 = await attemptVision('openai', processedFiles);
              return { response: vres2.response, conversationId, metadata: vres2.metadata };
            }
            console.warn('⚠️ Vision endpoint failed, falling back to brain stream...');
          }
        }

        // Normal chat path (or vision fallback to brain)
        // Backend auto-tries Gemini → OpenAI → Claude
        const res = await attemptStream('claude');
        return { response: res.response, conversationId, metadata: res.metadata };
      } catch (err: any) {
        const msg = String(err?.message || err || '').toLowerCase();
        const shouldFallback = msg.includes('overloaded') || msg.includes('529') || msg.includes('claude');
        if (shouldFallback) {
          console.warn('⚠️ Claude overloaded, auto-falling back to OpenAI...');
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

      // Enhanced message handling with 100-message memory window
      // CRITICAL: Strip large data to avoid huge request bodies that crash Edge Functions
      const rawEnhanced = this.getEnhancedMessages(recentMessages);
      const enhancedMessages = rawEnhanced.map(msg => {
        const cleaned: any = { ...msg };
        
        // Strip base64 data from attachedFiles (vision images)
        if (cleaned.attachedFiles && Array.isArray(cleaned.attachedFiles)) {
          cleaned.attachedFiles = cleaned.attachedFiles.map((f: any) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            imageType: f.imageType,
          }));
        }
        
        // Strip search metadata (contains huge raw_content from web scraping)
        if (cleaned.metadata?.search) {
          cleaned.metadata = {
            ...cleaned.metadata,
            search: {
              answer: cleaned.metadata.search.answer?.substring(0, 500),
              total: cleaned.metadata.search.total,
              // Exclude full results array - it's massive
            }
          };
        }
        
        // Truncate very long content (e.g., from search results)
        if (cleaned.content && cleaned.content.length > 2000) {
          cleaned.content = cleaned.content.substring(0, 2000) + '... [truncated]';
        }
        
        return cleaned;
      });
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
      let finalSummary = pieces.join(' ').slice(0, 1200);

      // Follow-up anchoring: if the user message is very short/ambiguous, attach the previous assistant message
      // so questions like "since when?" don't lose context.
      try {
        const u = (message || '').trim();
        const isShort = u.length > 0 && u.length <= 24;
        const isAmbiguous = /^(since\s+when\??|when\??|why\??|how\??|what\??|which\??|who\??|من\s+متى\??|متى\??|ليش\??|لماذا\??|كيف\??|وش\??|ما\??)$/i.test(u);
        if (isShort || isAmbiguous) {
          const lastAssistant = [...enhancedMessages].reverse().find(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim().length > 0)?.content || '';
          if (lastAssistant) {
            const clipped = lastAssistant.length > 500 ? `${lastAssistant.slice(0, 500)}...` : lastAssistant;
            const anchor = language === 'ar'
              ? `\n\nسياق المتابعة (مهم): سؤال المستخدم القصير "${u}" يشير إلى آخر رد من المساعد:\n${clipped}`
              : `\n\nFollow-up context (important): The user's short follow-up "${u}" refers to the previous assistant reply:\n${clipped}`;
            finalSummary = (finalSummary + anchor).slice(0, 1700);
          }
        }
      } catch {}

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
          const hasImage = !!rawB64;

          // Normalize to data URI if needed (Runware expects URL or dataURI)
          const mime = (firstImg?.type && typeof firstImg.type === 'string') ? firstImg.type : 'image/jpeg';
          const imageParam = hasImage
            ? ((typeof rawB64 === 'string' && (rawB64.startsWith('data:') || rawB64.startsWith('http')))
              ? rawB64
              : `data:${mime};base64,${rawB64}`)
            : null;

          const resp = await fetch(`${supabaseUrl}/functions/v1/image-background-removal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              ...(imageParam ? { referenceImages: [imageParam] } : {}),
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
            response: hasImage
              ? (language === 'ar' ? 'تم تعديل الصورة.' : 'Image edited.')
              : (language === 'ar' ? 'تم إنشاء الصورة.' : 'Image generated.'),
            imageUrl: outUrl || outData,
            error: false,
            metadata: { provider: 'runware', model: (json as any)?.model || 'google:4@1', mode }
          } as any;
        }

        if (mode === 'image2image') {
          // Extract first image base64 (raw) from attachedFiles; ImageModeFileUpload uses base64/url/preview
          const firstImg = Array.isArray(attachedFiles) ? attachedFiles.find((f: any) => f?.type?.startsWith('image/')) : undefined;
          const rawB64 = firstImg?.data || firstImg?.content || firstImg?.base64 || firstImg?.url || firstImg?.preview || '';
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
          metadata: { provider: 'runware', model: (json as any)?.model || (imageQuality === 'best_fast' ? 'runware:400@1' : 'runware:111@1'), quality: imageQuality || 'fast', mode }
        } as any;
      }

      // Vision/chat/search accumulation via streaming method under the hood
      // Allow callers to stream tokens by optionally providing callbacks on the "attachedFiles" arg using a convention
      // If the caller passed functions on attachedFiles.__onToken / __onComplete / __onError, forward them through.
      const maybeOnToken = (attachedFiles as any)?.__onToken as (token: string) => void | undefined;
      const maybeOnComplete = (attachedFiles as any)?.__onComplete as (meta: any) => void | undefined;
      const maybeOnError = (attachedFiles as any)?.__onError as (err: string) => void | undefined;

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
        maybeOnToken,
        maybeOnComplete,
        maybeOnError,
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
