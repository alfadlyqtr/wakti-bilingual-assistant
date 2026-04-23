// @ts-nocheck
import { supabase, ensurePassport, getCurrentUserId, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getNativeLocation, queryNeedsFreshLocation, clearLocationCache } from '@/integrations/natively/locationBridge';
import { parseReminderFromResponse, createScheduledReminder, cancelRecentPendingReminders } from '@/services/ReminderService';
import { emitEvent } from '@/utils/eventBus';

// Module-level session cache — avoids a Supabase network round-trip on every message send.
// Token validity is 1 hour; we refresh 5 minutes early to be safe.
let _cachedSession: { access_token: string; expires_at?: number } | null = null;
let _sessionCachedAt = 0;
const SESSION_CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes

async function getCachedSession() {
  const now = Date.now();
  if (_cachedSession?.access_token && (now - _sessionCachedAt) < SESSION_CACHE_TTL_MS) {
    return _cachedSession;
  }
  const t0 = Date.now();
  const { data: { session } } = await supabase.auth.getSession();
  const elapsed = Date.now() - t0;
  if (session?.access_token) {
    _cachedSession = session;
    _sessionCachedAt = now;
  } else {
    // Invalidate cache on failure — prevent ghost logged-out state
    _cachedSession = null;
    _sessionCachedAt = 0;
    console.warn(`🔑 AUTH: getSession() returned no session after ${elapsed}ms — cache invalidated`);
  }
  return session;
}

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
  replyQuote?: string; // One-line preview of the replied-to content (for rendering)
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

type DurableMemoryType = 'identity_context' | 'project_context' | 'recurring_goal' | 'working_style' | 'priority';
type DurableMemoryLayer = 'always_use' | 'routine' | 'project' | 'candidate';
type DurableMemorySensitivity = 'normal' | 'careful';

type DurableMemoryAction = 'remember' | 'forget';

type DurableMemoryItem = {
  key: string;
  type: DurableMemoryType;
  layer?: DurableMemoryLayer;
  sensitivity?: DurableMemorySensitivity;
  action?: DurableMemoryAction;
  text: string;
  confidence: 'high' | 'medium';
  evidenceCount: number;
  keywords: string[];
  source: 'conversation';
};

const LOCATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - people move around!

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;
  private conversationStorage = new Map<string, AIMessage[]>();
  private locationCache: UserLocationContext | null = null;
  private locationWarmupPromise: Promise<UserLocationContext> | null = null;
  private lastPTFetchAt: number | null = null;

  constructor() {
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

  // Resolve the Supabase anon key via a single source of truth.
  // Priority: runtime window global (for Natively / webview injection) -> canonical
  // SUPABASE_ANON_KEY exported by client.ts (which itself reads from Vite env or
  // falls back to the project-default anon key). No new baked secrets here.
  private getAnonKey(): string {
    const fromWindow = (typeof window !== 'undefined' && (window as { __SUPABASE_ANON_KEY?: string }).__SUPABASE_ANON_KEY) || '';
    return (fromWindow || SUPABASE_ANON_KEY || '').toString();
  }

  // Read display_name / username from the cached UserProfile (set by UserProfileContext).
  // Used as a fallback AFTER nickname in greetings. Returns null if nothing usable.
  private getCachedDisplayName(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith('wakti_profile_')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const p = parsed?.data || parsed;
          const candidate = (p?.display_name || p?.first_name || p?.username || '').toString().trim();
          if (candidate) return candidate;
        } catch { /* ignore bad entries */ }
      }
    } catch { /* no-op */ }
    return null;
  }

  // Async variant: if the local PT is missing a nickname, await a DB refresh BEFORE returning.
  // This ensures the FIRST chat/vision message of a session uses the correct nickname from DB,
  // instead of firing with an empty PT and getting a 'friend' fallback on the backend.
  private async ensurePersonalTouchAwaitingDB(userId?: string): Promise<any> {
    try {
      let current: any = null;
      try { current = this.getPersonalTouch(); } catch {}
      const hasNickname = !!(current && typeof current === 'object' && (current.nickname || '').toString().trim());
      if (!hasNickname && userId) {
        // Bypass 2-minute throttle for the first-session load by resetting lastPTFetchAt
        this.lastPTFetchAt = 0;
        await this.maybeRefreshPersonalTouchFromServer(userId);
      }
    } catch { /* non-fatal */ }
    return this.ensurePersonalTouch();
  }

  // Ensure PT object exists with safe defaults and minimal normalization
  private ensurePersonalTouch(): any {
    const allowedTones = ['funny', 'serious', 'casual', 'encouraging', 'neutral'];
    const allowedStyles = ['short answers', 'bullet points', 'step-by-step', 'detailed', 'conversational', 'analytical'];

    let pt: any = null;
    try { pt = this.getPersonalTouch(); } catch {}

    const wasDefaulted = !pt || typeof pt !== 'object';
    if (wasDefaulted) {
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

    // Attach display_name / username from cached profile as fallback for greeting (after nickname).
    // This lets the backend build greetings like: nickname || displayName || 'friend' (last-resort).
    try {
      const displayName = this.getCachedDisplayName();
      if (displayName) pt.displayName = displayName;
    } catch {}

    // Attach hash for transport
    try { pt.pt_hash = this.hashPersonalTouch(pt); } catch {}

    // Persist back and cache — but NEVER poison localStorage with a defaulted empty PT,
    // otherwise subsequent reads keep returning the empty object and DB sync never wins.
    if (!wasDefaulted) {
      try {
        localStorage.setItem('wakti_personal_touch', JSON.stringify(pt));
      } catch {}
    }
    this.personalTouchCache = pt;

    return pt;
  }

  // Option A cross-device: pull server PT if newer (lightweight, called lazily)
  private async maybeRefreshPersonalTouchFromServer(userId?: string) {
    try {
      const now = Date.now();
      if (this.lastPTFetchAt && now - this.lastPTFetchAt < 2 * 60 * 1000) return; // 2 min throttle
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      const uid = userId || user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from('user_personal_touch')
        .select('nickname, ai_nickname, tone, style, instruction, engine_tier, pt_version, updated_at')
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
        engineTier: (data as any).engine_tier || 'speed',
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
  private getCachedUserLocation(now: number = Date.now()): UserLocationContext | null {
    if (this.locationCache?.updatedAt && (now - this.locationCache.updatedAt) < LOCATION_CACHE_TTL) {
      return this.locationCache;
    }

    try {
      const raw = localStorage.getItem('wakti_user_location');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      parsed.timezone = parsed.timezone || this.getClientTimezone();
      parsed.updatedAt = parsed.updatedAt || now;
      const isFresh = parsed.updatedAt && (now - parsed.updatedAt) < LOCATION_CACHE_TTL;
      if (!isFresh) return null;
      this.locationCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  private queueLocationWarmup(userId: string, forceFresh: boolean = false): Promise<UserLocationContext> {
    if (!forceFresh && this.locationWarmupPromise) {
      return this.locationWarmupPromise;
    }

    const promise = this.getUserLocation(userId, forceFresh).finally(() => {
      if (this.locationWarmupPromise === promise) {
        this.locationWarmupPromise = null;
      }
    });

    this.locationWarmupPromise = promise;
    return promise;
  }

  async prewarmUserLocation(userId?: string, forceFresh: boolean = false) {
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      const resolvedUserId = session?.user?.id;
      if (!resolvedUserId) return;
      userId = resolvedUserId;
    }

    await this.queueLocationWarmup(userId, forceFresh);
  }

  private async getUserLocation(userId: string, forceFresh: boolean = false): Promise<UserLocationContext> {
    const now = Date.now();

    if (!forceFresh) {
      const cached = this.getCachedUserLocation(now);
      if (cached) return cached;
    } else {
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

    // Try native location first (Natively SDK + browser geolocation fallback)
    // If forceFresh, request fresh location with skipCache
    let hasDeviceGPS = false;
    try {
      const nativeLoc = await getNativeLocation({ skipCache: forceFresh, timeoutMs: forceFresh ? 3500 : 1800 });
      if (nativeLoc && typeof nativeLoc.latitude === 'number' && typeof nativeLoc.longitude === 'number') {
        hasDeviceGPS = true;
        resolved = {
          ...resolved,
          latitude: nativeLoc.latitude,
          longitude: nativeLoc.longitude,
          accuracy: nativeLoc.accuracy ?? null,
          city: nativeLoc.city || resolved.city,
          country: nativeLoc.country || resolved.country,
          source: nativeLoc.source === 'browser' ? 'native' : 'native',
        };
      } else {
        // Native location returned null or invalid — will try fallbacks
      }
    } catch (err) {
      console.warn('[WaktiAIV2Service] Native location error:', err);
    }

    // Fetch from profiles as fallback for city/country text ONLY (not coordinates)
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

    // IP-based fallback: ONLY use for city/country text when device GPS is unavailable.
    // NEVER use IP coordinates — they give wrong results (e.g., Doha instead of Al Khor)
    // due to ISP routing all traffic through a central location.
    if (!hasDeviceGPS && (!resolved.latitude || !resolved.longitude || !resolved.city || !resolved.country)) {
      const ipLoc = await this.fetchIpLocation();
      if (ipLoc) {
        resolved = {
          ...resolved,
          // Only use IP coordinates if we have absolutely nothing (non-search fallback)
          latitude: resolved.latitude ?? (forceFresh ? null : (ipLoc.latitude ?? null)),
          longitude: resolved.longitude ?? (forceFresh ? null : (ipLoc.longitude ?? null)),
          city: resolved.city || ipLoc.city || null,
          country: resolved.country || ipLoc.country || null,
          source: resolved.source || 'ip',
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
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
    
    // Remove duplicates by ID — O(n) Map instead of O(n²) findIndex
    const seen = new Map<string, AIMessage>();
    for (const msg of allMessages) {
      if (msg.id) seen.set(msg.id, msg);
    }
    const uniqueMessages = Array.from(seen.values());
    
    // Sort by timestamp — parse once per message, not twice per comparison
    uniqueMessages.sort((a, b) => {
      const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return ta - tb;
    });
    
    // Apply smart filtering and return a leaner context window.
    return this.smartFilterMessages(uniqueMessages).slice(-60);
  }

  private smartFilterMessages(messages: AIMessage[]): AIMessage[] {
    if (!messages || messages.length === 0) return [];
    
    // Filter out redundant acknowledgments and keep important context
    const redundantPatterns = [
      /^(thank you|thanks|ok|okay|yes|no|sure|alright)$/i,
      /^(شكرا|حسنا|نعم|لا|طيب|ممتاز)$/i
    ];
    
    return messages.filter((msg, index) => {
      // Always keep the most recent working window intact.
      if (index >= messages.length - 60) return true;
      
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
    
    // Cap at 20 messages max — topics from older history have diminishing value
    const skipWordList = new Set(['about', 'could', 'would', 'should', 'please', 'think', 'really', 'thing', 'know']);
    summaryMessages.slice(-20).forEach(msg => {
      if (msg.role === 'user' && msg.content.length > 30) {
        // Only scan first 200 chars — sufficient for topic extraction, avoids huge splits
        const words = msg.content.substring(0, 200).toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 4 && !skipWordList.has(word)) topics.add(word);
          if (topics.size >= 8) break; // Stop early once we have enough
        }
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

  private normalizeConversationSummary(summary?: string | null, maxLength: number = 1200): string {
    if (!summary || typeof summary !== 'string') return '';
    return summary.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private pickConversationSummary(...candidates: Array<string | null | undefined>): string {
    for (const candidate of candidates) {
      const normalized = this.normalizeConversationSummary(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private normalizeDurableMemoryText(input: unknown, maxLength: number = 180): string {
    if (typeof input !== 'string') return '';
    return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private extractDurableMemoryKeywords(...inputs: string[]): string[] {
    const stopwords = new Set([
      'about', 'after', 'again', 'being', 'could', 'doing', 'from', 'have', 'just', 'like', 'make', 'more', 'need',
      'only', 'really', 'should', 'that', 'their', 'them', 'then', 'they', 'this', 'want', 'with', 'would', 'your',
      'there', 'while', 'into', 'over', 'under', 'plain', 'english', 'stage', 'stages', 'audit', 'report'
    ]);

    return Array.from(new Set(
      inputs
        .join(' ')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((word) => word.trim())
        .filter((word) => word.length >= 4 && !stopwords.has(word))
    )).slice(0, 8);
  }

  private buildDurableMemoryCandidates(
    messages: AIMessage[],
    conversationSummary: string,
    personalTouch: any
  ): DurableMemoryItem[] {
    const userMessages = (Array.isArray(messages) ? messages : [])
      .filter((msg) => msg?.role === 'user' && typeof msg.content === 'string')
      .map((msg) => this.normalizeDurableMemoryText(msg.content, 320))
      .filter(Boolean)
      .slice(-30);

    if (userMessages.length === 0) return [];

    const summaryLower = this.normalizeConversationSummary(conversationSummary, 700).toLowerCase();
    const ptInstruction = this.normalizeDurableMemoryText(personalTouch?.instruction || '', 220).toLowerCase();
    const candidates = new Map<string, DurableMemoryItem>();

    // FORBIDDEN: financial, children's private info, credentials — never silently saved
    const forbiddenPatterns = [
      /\b(bank|iban|swift|account\s+number|credit\s+card|debit\s+card|cvv|pin\s+code|password|otp|salary|income|debt|loan|mortgage|net\s+worth|paycheck|wage)\b/i,
      /بنك|آيبان|حساب\s+رقم|بطاقة\s+ائتمان|كلمة\s+السر|رقم\s+سري|راتب|دخل|دين|قرض/,
      /\bmy\s+(son|daughter|kid|child)\s+(?:is\s+\d|goes\s+to|attends|studies\s+at)/i
    ];
    const isForbidden = (t: string) => forbiddenPatterns.some((p) => p.test(t));

    const keySlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '_').slice(0, 40);

    const addCandidate = (
      key: string,
      type: DurableMemoryType,
      layer: DurableMemoryLayer,
      sensitivity: DurableMemorySensitivity,
      text: string,
      evidenceCount: number,
      confidence: 'high' | 'medium' = 'medium',
      extraKeywords: string[] = []
    ) => {
      const normalizedText = this.normalizeDurableMemoryText(text, 180);
      if (!normalizedText || evidenceCount <= 0) return;
      if (isForbidden(normalizedText)) return;
      const existing = candidates.get(key);
      const mergedKeywords = this.extractDurableMemoryKeywords(normalizedText, key, ...extraKeywords, ...(existing?.keywords || []));
      const next: DurableMemoryItem = {
        key,
        type,
        layer,
        sensitivity,
        text: normalizedText,
        confidence: existing?.confidence === 'high' || confidence === 'high' ? 'high' : 'medium',
        evidenceCount: Math.max(existing?.evidenceCount || 0, evidenceCount),
        keywords: mergedKeywords,
        source: 'conversation'
      };
      candidates.set(key, next);
    };

    // FORGET intent — captured on the *latest* user message only. The backend
    // matches these against existing memories and removes / rewrites them.
    const latestUserMessage = userMessages[userMessages.length - 1] || '';
    const forgetPatterns: RegExp[] = [
      /\bi\s+no\s+longer\s+(?:like|love|enjoy|play|watch|eat|drink|listen\s+to|follow|support|root\s+for|cheer\s+for|work\s+(?:as|at|in)|live\s+in|study\s+at|go\s+to|attend|do|use|want|need|have|own)\s+([^.!?\n]{2,80})/i,
      /\bi\s+don'?t\s+(?:like|love|enjoy|play|watch|eat|drink|listen\s+to|follow|support|root\s+for|cheer\s+for|do|use|want|need|have|own)\s+([^.!?\n]{2,80}?)\s+anymore\b/i,
      /\b(?:please\s+)?forget\s+(?:that\s+|about\s+)?([^.!?\n]{2,80})/i,
      /\bstop\s+remembering\s+(?:that\s+|about\s+)?([^.!?\n]{2,80})/i,
      /\bremove\s+(?:the\s+)?memory\s+(?:that\s+|about\s+)?([^.!?\n]{2,80})/i,
      /لم\s+أعد\s+([^.!?\n]{2,80})/,
      /انسى?\s+(?:أن\s+|عن\s+)?([^.!?\n]{2,80})/,
      /احذف\s+(?:ذكرى\s+)?([^.!?\n]{2,80})/
    ];
    const cleanForgetSubject = (raw: string): string => {
      let s = this.normalizeDurableMemoryText(raw || '', 120);
      // Strip leading filler
      s = s.replace(/^(that\s+i\s+|i\s+|about\s+)/i, '');
      // Cut at trailing noise words that signal end-of-intent
      s = s.split(/\s+(?:forget(?:\s+(?:that|it))?|please|pls|thanks|thank\s+you|okay|ok|now|already|anymore)\b/i)[0] || s;
      // Strip trailing punctuation/fillers
      s = s.replace(/[.,;:!?\-\s]+$/, '').trim();
      return s;
    };
    const trivialSubjects = /^(please|pls|thanks|thank\s+you|it|that|this|them|you|me|ok|okay|yes|no|sure|fine|now)$/i;

    for (const pattern of forgetPatterns) {
      const match = pattern.exec(latestUserMessage);
      const subject = cleanForgetSubject(match?.[1] || '');
      if (!subject || subject.length < 2) continue;
      if (trivialSubjects.test(subject)) continue;
      const key = `forget_${keySlug(subject)}`;
      if (candidates.has(key)) continue;
      candidates.set(key, {
        key,
        type: 'identity_context',
        layer: 'always_use',
        sensitivity: 'normal',
        action: 'forget',
        text: subject,
        confidence: 'high',
        evidenceCount: 1,
        keywords: ['forget', subject.toLowerCase()],
        source: 'conversation'
      });
    }

    // Emoji-usage preference: if the user uses ≥3 emojis across their recent
    // messages, capture a style hint so the assistant mirrors their vibe.
    // Uses a conservative property escape for emoji presentation characters.
    try {
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu;
      let emojiCount = 0;
      let messagesWithEmoji = 0;
      for (const text of userMessages) {
        const matches = text.match(emojiRegex);
        if (matches && matches.length > 0) {
          emojiCount += matches.length;
          messagesWithEmoji += 1;
        }
      }
      if (emojiCount >= 3 && messagesWithEmoji >= 2) {
        addCandidate(
          'style_emoji_friendly',
          'working_style',
          'always_use',
          'normal',
          'Uses emojis often — prefers replies that include emojis naturally.',
          2,
          'high',
          ['emoji', 'style', 'playful']
        );
      }
    } catch {
      // Emoji detection is best-effort; never block capture.
    }

    // Explicit "remember this" — highest-priority capture
    const rememberPatterns = [
      /\b(?:please\s+)?remember\s+(?:that\s+)?([^.!?\n]{6,140})/i,
      /\balways\s+remember\s+(?:that\s+)?([^.!?\n]{6,140})/i,
      /\bdon'?t\s+forget\s+(?:that\s+)?([^.!?\n]{6,140})/i,
      /\bsave\s+(?:that|this)\s+([^.!?\n]{6,140})/i,
      /تذكر\s+(?:أن\s+)?([^.!?\n]{6,140})/,
      /احفظ\s+([^.!?\n]{6,140})/,
      /لا\s+تنسى\s+(?:أن\s+)?([^.!?\n]{6,140})/
    ];
    for (const text of userMessages) {
      for (const pattern of rememberPatterns) {
        const match = pattern.exec(text);
        const subject = this.normalizeDurableMemoryText(match?.[1] || '', 140);
        if (!subject || isForbidden(subject)) continue;
        addCandidate(`remember_${keySlug(subject)}`, 'identity_context', 'always_use', 'normal', subject, 3, 'high', ['remember']);
      }
    }

    // Projects (subject extraction, widened with AR)
    const explicitProjectPatterns = [
      /\b(?:i am|i'm|we are|we're)\s+(?:building|creating|developing|working on|launching|shipping|improving|refining)\s+([^.!?\n]{4,90})/i,
      /\b(?:my|our)\s+(?:current\s+)?project\s+is\s+([^.!?\n]{4,90})/i,
      /\b(?:building|creating|developing|working on|improving|refining)\s+(wakti ai|wakti|the app|our app|our product|the product)\b/i,
      /أعمل\s+على\s+([^.!?\n]{4,90})/,
      /مشروعي\s+(?:الحالي\s+)?(?:هو\s+)?([^.!?\n]{4,90})/
    ];
    for (const text of userMessages) {
      for (const pattern of explicitProjectPatterns) {
        const match = pattern.exec(text);
        const rawSubject = this.normalizeDurableMemoryText(match?.[1] || '', 90);
        if (!rawSubject || isForbidden(rawSubject)) continue;
        if (/wakti/i.test(rawSubject)) {
          addCandidate('project_wakti_ai', 'project_context', 'project', 'normal', 'User is building and refining Wakti AI.', 3, 'high', ['wakti', 'product', 'app', 'chat']);
        } else if (rawSubject.length >= 6) {
          addCandidate(`project_${keySlug(rawSubject)}`, 'project_context', 'project', 'normal', `User is working on ${rawSubject}.`, 2, 'medium', [rawSubject]);
        }
      }
    }

    // Identity: grade
    for (const text of userMessages) {
      const m = /\b(?:i(?:'m| am)?\s+in\s+)?(?:grade|year)\s+(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b|في\s+الصف\s+(\d{1,2})/i.exec(text);
      const grade = m?.[1] || m?.[2] || m?.[3];
      const g = grade ? parseInt(grade, 10) : NaN;
      if (g >= 1 && g <= 13) {
        addCandidate(`identity_grade_${g}`, 'identity_context', 'always_use', 'normal', `User is in Grade ${g}.`, 3, 'high', ['grade', 'school', 'student']);
      }
    }

    // Identity: favorite subject
    for (const text of userMessages) {
      const m = /\b(?:my\s+)?favorite\s+subject\s+is\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s-]{2,30})/i.exec(text)
            || /\b(?:i\s+love|i\s+enjoy)\s+(math|maths|science|biology|chemistry|physics|history|geography|english|arabic|islamic\s+studies|art|music|pe|computer\s+science)\b/i.exec(text)
            || /مادتي\s+المفضلة\s+(?:هي\s+)?([^.!?\n]{2,30})/.exec(text);
      const subject = this.normalizeDurableMemoryText(m?.[1] || '', 40);
      if (subject && !isForbidden(subject)) {
        addCandidate(`identity_subject_${keySlug(subject)}`, 'identity_context', 'always_use', 'normal', `Favorite subject is ${subject}.`, 2, 'high', ['subject', 'favorite', 'study']);
      }
    }

    // Identity: location (I live in X / I'm from X / I'm based in X)
    for (const text of userMessages) {
      const m = /\b(?:i\s+live\s+in|i['\u2019]?m\s+(?:from|based\s+in)|i\s+reside\s+in)\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s,'-]{2,60})/i.exec(text)
            || /\b(?:glad|happy|lucky)\s+(?:i\s+)?live\s+in\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s,'-]{2,60})/i.exec(text)
            || /أنا\s+(?:من|أعيش\s+في|أسكن\s+في)\s+([^.!?\n,]{2,60})/.exec(text);
      const place = this.normalizeDurableMemoryText(m?.[1] || '', 60);
      if (place && !isForbidden(place) && place.length >= 3) {
        addCandidate(`identity_location_${keySlug(place)}`, 'identity_context', 'always_use', 'normal', `Lives in ${place}.`, 3, 'high', ['location', 'home', 'city']);
      }
    }

    // Identity: favorite team / sport / game / food / show / band / movie / song
    for (const text of userMessages) {
      // "X is my favorite <thing>" and "my favorite <thing> is X"
      const themePattern = /\b(?:my\s+)?favorite\s+(team|sport(?:s)?(?:\s+team)?|game|food|dish|show|tv\s+show|series|movie|film|song|band|artist|singer|book|author|drink|color|colour|place)\s+(?:is|are)\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s&,'-]{1,60})/i;
      const reversePattern = /\b(?:the\s+)?([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s&'-]{1,40})\s+(?:is|are)\s+my\s+(?:favorite|favourite|#?1)\s+(team|sport(?:s)?(?:\s+team)?|game|food|dish|show|tv\s+show|series|movie|film|song|band|artist|singer|book|author|drink|color|colour|place)/i;
      const arPattern = /\bفريقي\s+المفضل\s+(?:هو\s+)?([^.!?\n]{2,40})/;
      const m = themePattern.exec(text) || reversePattern.exec(text) || arPattern.exec(text);
      if (m) {
        const kind = (m[1] || 'favorite').toString().toLowerCase().trim();
        const value = this.normalizeDurableMemoryText((reversePattern.exec(text) ? m[1] : m[2]) || m[1] || '', 60);
        if (value && !isForbidden(value) && value.length >= 2) {
          const key = `fav_${keySlug(kind)}_${keySlug(value)}`;
          const isTeam = /team|sport/i.test(kind);
          addCandidate(key, 'identity_context', 'always_use', 'normal', `Favorite ${kind}: ${value}.`, isTeam ? 3 : 2, 'high', ['favorite', kind.replace(/\s+/g, '_'), value.toLowerCase()]);
        }
      }
      // "I'm a fan of X" / "I love X" (team/artist style) / "I support X"
      const fanMatch = /\b(?:i['\u2019]?m\s+a\s+(?:huge\s+|big\s+)?fan\s+of|i\s+support|i\s+root\s+for|i\s+cheer\s+for)\s+(?:the\s+)?([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s&'-]{2,50})/i.exec(text)
                  || /\bأشجع\s+([^.!?\n]{2,50})/.exec(text);
      const fanOf = this.normalizeDurableMemoryText(fanMatch?.[1] || '', 50);
      if (fanOf && !isForbidden(fanOf) && fanOf.length >= 3) {
        addCandidate(`fan_of_${keySlug(fanOf)}`, 'identity_context', 'always_use', 'normal', `Fan of ${fanOf}.`, 2, 'high', ['fan', fanOf.toLowerCase()]);
      }
    }

    // Identity: profession / work
    for (const text of userMessages) {
      const m = /\b(?:i\s+work\s+as\s+(?:an?\s+)?|i['\u2019]?m\s+(?:an?\s+)|my\s+job\s+is\s+(?:an?\s+)?)([a-z][a-z\s-]{2,40}?)(?=[.!?\n,]|\s+(?:in|at|for|and|but)\b|$)/i.exec(text)
            || /\bأعمل\s+(?:ك)?([^.!?\n]{2,40})/.exec(text);
      const raw = this.normalizeDurableMemoryText(m?.[1] || '', 40).toLowerCase();
      // filter common non-profession fits that the loose regex may grab
      const blocklist = /\b(fan|bit|little|lot|huge|big|good|bad|tired|happy|sad|glad|sure|right|fine|old|new|late|early|busy|free|here|there)\b/;
      if (raw && raw.length >= 4 && !blocklist.test(raw) && !isForbidden(raw)) {
        addCandidate(`profession_${keySlug(raw)}`, 'identity_context', 'always_use', 'normal', `Works as ${raw}.`, 2, 'medium', ['profession', 'work', 'job']);
      }
    }

    // Identity: pet
    for (const text of userMessages) {
      const m = /\b(?:i\s+have|we\s+have|i\s+own)\s+(?:an?\s+|two\s+|three\s+)?(dog|cat|bird|parrot|rabbit|hamster|fish|turtle|horse|cow|sheep|goat|chicken|chickens|falcon)s?\b(?:\s+(?:named|called)\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s'-]{1,30}))?/i.exec(text)
            || /\bعندي\s+(كلب|قطة|قط|طير|ببغاء|أرنب|سمك|صقر)\b(?:\s+اسمه\s+([^.!?\n]{1,30}))?/.exec(text);
      if (m) {
        const animal = this.normalizeDurableMemoryText(m[1] || '', 30);
        const name = this.normalizeDurableMemoryText(m[2] || '', 30);
        const descriptor = name ? `${animal} named ${name}` : `${animal}`;
        if (animal && !isForbidden(descriptor)) {
          addCandidate(`pet_${keySlug(animal)}_${keySlug(name || 'unnamed')}`, 'identity_context', 'always_use', 'normal', `Has a ${descriptor}.`, 2, 'high', ['pet', animal.toLowerCase()]);
        }
      }
    }

    // Routines: every weekday + every week
    const weekdayMap: Record<string, string> = {
      monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
      thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
    };
    for (const text of userMessages) {
      const m = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s+([^.!?\n]{4,140})/i.exec(text)
            || /كل\s+(اثنين|ثلاثاء|أربعاء|خميس|جمعة|سبت|أحد)\s+([^.!?\n]{4,140})/.exec(text);
      if (m) {
        const day = (m[1] || '').toLowerCase();
        const normalizedDay = weekdayMap[day] || m[1];
        const action = this.normalizeDurableMemoryText(m[2] || '', 140);
        if (action && !isForbidden(action)) {
          const careful = /\b(wife|husband|son|daughter|kids?|children|family)\b|زوجتي|زوجي|ابني|ابنتي|أطفالي/i.test(action);
          addCandidate(`routine_${keySlug(day)}_${keySlug(action)}`, 'recurring_goal', 'routine', careful ? 'careful' : 'normal', `Every ${normalizedDay}: ${action}`, 2, 'high', ['routine', 'every', normalizedDay.toLowerCase()]);
        }
      }
      const weekly = /\bevery\s+week\s+([^.!?\n]{4,140})/i.exec(text);
      if (weekly) {
        const action = this.normalizeDurableMemoryText(weekly[1] || '', 140);
        if (action && !isForbidden(action)) {
          addCandidate(`routine_weekly_${keySlug(action)}`, 'recurring_goal', 'routine', 'normal', `Every week: ${action}`, 2, 'medium', ['routine', 'weekly']);
        }
      }
    }

    // Preferences: language + brevity + step-by-step
    for (const text of userMessages) {
      if (/\b(?:reply|respond|talk)\s+(?:to\s+me\s+)?in\s+arabic\b|أجبني\s+بالعربية/i.test(text)) {
        addCandidate('pref_reply_arabic', 'working_style', 'always_use', 'normal', 'Prefers replies in Arabic.', 2, 'medium', ['arabic', 'language']);
      }
      if (/\b(?:reply|respond|talk)\s+(?:to\s+me\s+)?in\s+english\b|أجبني\s+بالإنجليزية/i.test(text)) {
        addCandidate('pref_reply_english', 'working_style', 'always_use', 'normal', 'Prefers replies in English.', 2, 'medium', ['english', 'language']);
      }
      if (/\b(keep it|make it)\s+(short|brief|concise)\b|اختصر|باختصار/i.test(text)) {
        addCandidate('pref_concise', 'working_style', 'always_use', 'normal', 'Prefers concise replies.', 1, 'medium', ['concise', 'short']);
      }
      if (/\bstep[\s-]?by[\s-]?step\b|خطوة\s+بخطوة/i.test(text)) {
        addCandidate('pref_step_by_step', 'working_style', 'always_use', 'normal', 'Prefers step-by-step explanations.', 1, 'medium', ['steps']);
      }
    }

    // Health: allergies + dietary
    for (const text of userMessages) {
      const allergy = /\b(?:i'?m|i am)\s+allergic\s+to\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s,-]{2,50})|\ballergy\s+to\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s,-]{2,50})|لدي\s+حساسية\s+من\s+([^.!?\n]{2,60})/i.exec(text);
      const subject = this.normalizeDurableMemoryText(allergy?.[1] || allergy?.[2] || allergy?.[3] || '', 50);
      if (subject) {
        addCandidate(`health_allergy_${keySlug(subject)}`, 'identity_context', 'always_use', 'normal', `User is allergic to ${subject}.`, 2, 'high', ['allergy', 'health']);
      }
      const diet = /\b(?:i'?m|i am)\s+(vegetarian|vegan|pescatarian)\b/i.exec(text);
      if (diet?.[1]) {
        addCandidate(`diet_${diet[1].toLowerCase()}`, 'identity_context', 'always_use', 'normal', `User is ${diet[1].toLowerCase()}.`, 1, 'high', ['diet', 'food']);
      }
      const needs = /\b(halal\s+only|no\s+pork|gluten[-\s]?free|lactose\s+intolerant|diabetic)\b/i.exec(text);
      if (needs?.[1]) {
        addCandidate(`diet_${keySlug(needs[1])}`, 'identity_context', 'always_use', 'normal', `Dietary need: ${needs[1]}.`, 1, 'high', ['diet', 'food']);
      }
    }

    // Religion (allowed per user direction, flagged careful)
    for (const text of userMessages) {
      const m = /\b(?:i'?m|i am)\s+(muslim|christian|jewish|hindu|buddhist|catholic|orthodox)\b|أنا\s+(مسلم|مسيحي|يهودي)/i.exec(text);
      const faith = this.normalizeDurableMemoryText(m?.[1] || m?.[2] || '', 30);
      if (faith) {
        addCandidate(`religion_${keySlug(faith)}`, 'identity_context', 'always_use', 'careful', `User is ${faith}.`, 2, 'high', ['religion']);
      }
      if (/\bi\s+fast\s+during\s+ramadan\b|أصوم\s+رمضان/i.test(text)) {
        addCandidate('religion_fasts_ramadan', 'identity_context', 'always_use', 'careful', 'Fasts during Ramadan.', 1, 'high', ['religion', 'ramadan', 'fasting']);
      }
    }

    // Relationship helper (careful — only when user is explicit)
    for (const text of userMessages) {
      const wife = /\bmy\s+wife'?s\s+(?:nickname|name)\s+is\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s'-]{1,30})|زوجتي\s+(?:اسمها|كنيتها)\s+([^.!?\n]{1,30})/i.exec(text);
      const husband = /\bmy\s+husband'?s\s+(?:nickname|name)\s+is\s+([a-z\u0600-\u06FF][a-z\u0600-\u06FF\s'-]{1,30})|زوجي\s+(?:اسمه|كنيته)\s+([^.!?\n]{1,30})/i.exec(text);
      const wifeName = this.normalizeDurableMemoryText(wife?.[1] || wife?.[2] || '', 30);
      const husbandName = this.normalizeDurableMemoryText(husband?.[1] || husband?.[2] || '', 30);
      if (wifeName) {
        addCandidate('rel_wife_name', 'identity_context', 'always_use', 'careful', `User's wife is called ${wifeName}.`, 1, 'high', ['family', 'wife']);
      }
      if (husbandName) {
        addCandidate('rel_husband_name', 'identity_context', 'always_use', 'careful', `User's husband is called ${husbandName}.`, 1, 'high', ['family', 'husband']);
      }
    }

    // Legacy PM/product rules (kept, now layer-tagged)
    const categoryRules: Array<{
      key: string;
      type: DurableMemoryType;
      layer: DurableMemoryLayer;
      sensitivity: DurableMemorySensitivity;
      text: string;
      minCount: number;
      patterns: RegExp[];
      keywords: string[];
      skip?: () => boolean;
    }> = [
      {
        key: 'priority_speed_quality',
        type: 'priority',
        layer: 'always_use',
        sensitivity: 'normal',
        text: 'Speed, low token waste, and strong answer quality are top priorities.',
        minCount: 2,
        patterns: [/\bspeed\b|fast|faster|fastest|performance|latency|lightning fast|token waste|token taxation|lean/i],
        keywords: ['speed', 'performance', 'latency', 'quality', 'tokens']
      },
      {
        key: 'workflow_pm_audit',
        type: 'working_style',
        layer: 'always_use',
        sensitivity: 'normal',
        text: 'User prefers staged, audit-driven work with PM-style guidance and self-checks.',
        minCount: 2,
        patterns: [/\baudit\b|report back|self-audit|project manager|\bpm\b|\bstage\b|staged/i],
        keywords: ['audit', 'stage', 'pm', 'workflow', 'report']
      },
      {
        key: 'workflow_plain_english',
        type: 'working_style',
        layer: 'always_use',
        sensitivity: 'normal',
        text: 'User prefers plain-English explanations with low jargon.',
        minCount: 1,
        patterns: [/plain english|simple english|avoid jargon|clear and human/i],
        keywords: ['plain', 'english', 'clarity', 'simple'],
        skip: () => ptInstruction.includes('plain english')
      },
      {
        key: 'project_ai_chat_quality',
        type: 'project_context',
        layer: 'project',
        sensitivity: 'normal',
        text: 'User is actively improving Wakti AI chat quality, continuity, and prompt behavior.',
        minCount: 2,
        patterns: [/\bwakti ai\b|\bai chat\b|conversation summary|continuity|stay hot|prompt|routing|search mode|semantic memory/i],
        keywords: ['wakti', 'chat', 'continuity', 'prompts', 'routing']
      },
      {
        key: 'goal_reliability_actions',
        type: 'recurring_goal',
        layer: 'always_use',
        sensitivity: 'normal',
        text: 'User wants reminders, location, and action reliability to be strong and trustworthy.',
        minCount: 2,
        patterns: [/\breminder\b|location|gps|notification|schedule|reliable|reliability/i],
        keywords: ['reminders', 'location', 'reliability', 'actions']
      }
    ];

    for (const rule of categoryRules) {
      if (rule.skip?.()) continue;
      let count = userMessages.reduce((total, text) => total + (rule.patterns.some((pattern) => pattern.test(text)) ? 1 : 0), 0);
      if (summaryLower && rule.patterns.some((pattern) => pattern.test(summaryLower))) {
        count += 1;
      }
      if (count >= rule.minCount) {
        addCandidate(rule.key, rule.type, rule.layer, rule.sensitivity, rule.text, count, count >= rule.minCount + 1 ? 'high' : 'medium', rule.keywords);
      }
    }

    return Array.from(candidates.values()).slice(0, 12);
  }

  private scoreDurableMemoryRelevance(
    item: DurableMemoryItem,
    message: string,
    activeTrigger: string,
    chatSubmode: 'chat' | 'study' = 'chat'
  ): number {
    const query = this.normalizeDurableMemoryText(message, 240).toLowerCase();
    let score = item.evidenceCount * 12 + (item.confidence === 'high' ? 10 : 4);

    const overlaps = item.keywords.filter((keyword) => query.includes(keyword.toLowerCase())).length;
    score += overlaps * 12;

    if (item.type === 'project_context' && /project|product|app|build|feature|fix|chat|wakti|prompt|memory|route|routing/i.test(query)) score += 10;
    if (item.type === 'recurring_goal' && /need|goal|improve|fix|make|solve|reliable|better/i.test(query)) score += 8;
    if (item.type === 'working_style' && /explain|plan|audit|report|stage|help|walk me through/i.test(query)) score += 8;
    if (item.type === 'priority' && /speed|fast|performance|latency|quality|lean|token/i.test(query)) score += 10;
    if (activeTrigger === 'search' && item.type === 'working_style') score -= 6;
    if (chatSubmode === 'study' && item.type === 'project_context') score -= 4;

    return score;
  }

  private buildDurableMemoryTransport(
    message: string,
    messages: AIMessage[],
    conversationSummary: string,
    personalTouch: any,
    activeTrigger: string,
    chatSubmode: 'chat' | 'study' = 'chat'
  ): DurableMemoryItem[] {
    const candidates = this.buildDurableMemoryCandidates(messages, conversationSummary, personalTouch);
    if (candidates.length === 0) return [];

    const limit = activeTrigger === 'search' ? 2 : 3;

    // Forget items MUST bypass relevance scoring — they are imperative user
    // instructions, not contextual context. Keep them all, transport them all.
    const forgetItems = candidates.filter((c) => c.action === 'forget');
    const rememberItems = candidates.filter((c) => c.action !== 'forget');

    const selectedRemember = rememberItems
      .map((item) => ({ item, score: this.scoreDurableMemoryRelevance(item, message, activeTrigger, chatSubmode) }))
      .filter((entry) => entry.score >= 18)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);

    return [...forgetItems, ...selectedRemember].map((item) => ({
      key: item.key,
      type: item.type,
      layer: item.layer,
      sensitivity: item.sensitivity,
      action: item.action,
      text: item.text,
      confidence: item.confidence,
      evidenceCount: item.evidenceCount,
      keywords: item.keywords.slice(0, 6),
      source: item.source
    }));
  }

  private buildTransportRecentMessages(
    messages: AIMessage[],
    activeTrigger: string,
    chatSubmode: 'chat' | 'study' = 'chat'
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const limit = activeTrigger === 'search'
      ? 10
      : chatSubmode === 'study'
        ? 12
        : 16;

    const clipped = messages
      .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .slice(-limit)
      .map((msg, index, arr) => {
        const isLast = index === arr.length - 1;
        const maxLength = activeTrigger === 'search'
          ? (msg.role === 'assistant' ? 500 : 700)
          : chatSubmode === 'study'
            ? (msg.role === 'assistant' ? 900 : 1100)
            : (isLast ? 1200 : (msg.role === 'assistant' ? 700 : 900));

        return {
          role: msg.role,
          content: msg.content.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        };
      })
      .filter((msg) => msg.content.length > 0);

    return clipped;
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

      // ═══════════════════════════════════════════════════════════════════
      // FRONT DESK PATTERN: Parallel pipeline — fetch fires in < 50ms
      // Auth, session, location all resolve in parallel.
      // Message prep runs synchronously during the parallel await.
      // ═══════════════════════════════════════════════════════════════════

      // 1) PARALLEL TRACK A: Auth (only if no userId provided)
      const authPromise = !userId
        ? (async () => { await ensurePassport(); return getCurrentUserId(); })()
        : Promise.resolve(userId);

      // 2) PARALLEL TRACK B: Session token (module-level cache — instant if warm)
      const sessionPromise = getCachedSession();

      // 3) PARALLEL TRACK C: Location — NEVER blocks chat or search.
      //    Always use cached location for search — forceFresh only for explicit "near me" GPS queries.
      //    This eliminates the 30-second GPS wait on every search request.
      const needsLocation = activeTrigger === 'search' || queryNeedsFreshLocation(message);
      const forceFreshLocation = queryNeedsFreshLocation(message); // only true for "near me" type queries
      const cachedLocation = needsLocation ? this.getCachedUserLocation() : null;
      const locationPromise: Promise<UserLocationContext | null> = needsLocation
        ? (cachedLocation
            ? Promise.resolve(cachedLocation)
            : Promise.race([
                this.getUserLocation(userId || '', forceFreshLocation),
                new Promise<null>(r => setTimeout(() => r(null), forceFreshLocation ? 1600 : 900))
              ]))
        : Promise.resolve(null);

      if (needsLocation && userId) {
        this.queueLocationWarmup(userId, forceFreshLocation || !cachedLocation).catch(() => {});
      }

      // 4) Fire-and-forget: personal touch refresh (background, never blocks)
      if (userId) this.maybeRefreshPersonalTouchFromServer(userId).catch(() => {});

      // 5) SYNC: Message prep + summary (runs while auth/session/location resolve)
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const clientLocalHour = new Date().getHours();
      let isWelcomeBack = false;
      try {
        const lastSeenStr = localStorage.getItem('wakti_last_seen_at');
        if (lastSeenStr) {
          isWelcomeBack = (Date.now() - Number(lastSeenStr)) >= 12 * 60 * 60 * 1000;
        }
      } catch {}

      const rawEnhanced = this.getEnhancedMessages(recentMessages);
      const enhancedMessages = rawEnhanced.map(msg => {
        const cleaned: any = { ...msg };
        if (cleaned.attachedFiles && Array.isArray(cleaned.attachedFiles)) {
          cleaned.attachedFiles = cleaned.attachedFiles.map((f: any) => ({
            name: f.name, type: f.type, size: f.size, imageType: f.imageType,
          }));
        }
        if (cleaned.metadata?.search) {
          cleaned.metadata = {
            ...cleaned.metadata,
            search: { answer: cleaned.metadata.search.answer?.substring(0, 500), total: cleaned.metadata.search.total }
          };
        }
        if (cleaned.content && cleaned.content.length > 2000) {
          cleaned.content = cleaned.content.substring(0, 2000) + '... [truncated]';
        }
        return cleaned;
      });
      const generatedSummary = this.generateConversationSummary(enhancedMessages);
      const localSummary = conversationId ? (localStorage.getItem(`wakti_local_summary_${conversationId}`) || null) : null;
      let finalSummary = this.pickConversationSummary(conversationSummary, localSummary, generatedSummary);
      const transportMessages = this.buildTransportRecentMessages(enhancedMessages, activeTrigger, chatSubmode);

      // 6) RESOLVE ALL PARALLEL TRACKS (auth + session + location)
      const [resolvedUserId, session, location] = await Promise.all([
        authPromise,
        sessionPromise,
        locationPromise
      ]);
      userId = resolvedUserId || userId;
      if (needsLocation && userId && !location) {
        this.queueLocationWarmup(userId, forceFreshLocation).catch(() => {});
      }
      if (!userId) throw new Error('Authentication required');
      if (!session?.access_token) throw new Error('No valid session for streaming');

      // Build Personal Touch AFTER auth resolves. If local PT has no nickname, await DB refresh.
      // This guarantees the FIRST message of a session sends the correct nickname instead of
      // falling back to 'friend' on the backend.
      const pt = await this.ensurePersonalTouchAwaitingDB(userId);
      const durableMemory = this.buildDurableMemoryTransport(message, enhancedMessages, finalSummary, pt, activeTrigger, chatSubmode);

      const clientTimezone = location?.timezone || this.getClientTimezone();

      const maybeAnonKey = this.getAnonKey();

      // Inner attempt function: parameterize primary provider and stream
      const attemptStream = async (primary: 'gemini-brain' | 'claude' | 'openai') => {
        const maxRetries = 2;
        let response;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const pt_version = pt?.pt_version ?? null;
            const pt_updated_at = pt?.pt_updated_at ?? null;
            const pt_hash = this.hashPersonalTouch(pt);
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
                recentMessages: transportMessages,
                conversationSummary: finalSummary,
                durableMemory,
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
                      recentMessages: transportMessages,
                      conversationSummary: finalSummary,
                      durableMemory,
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
                      recentMessages: transportMessages,
                      conversationSummary: finalSummary,
                      durableMemory,
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

                    if (data === '[DONE]') {
                      if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
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

                  // Trial limit reached — dispatch global event and stop cleanly
                  if (errMsg === 'TRIAL_LIMIT_REACHED' || parsed.trialLimitReached) {
                    emitEvent('wakti-trial-limit-reached', { feature: parsed.feature || 'ai_chat' });
                    if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                    return;
                  }

                  // If overload or Claude-specific error surfaces inside SSE, bubble up immediately
                  const low = errMsg.toLowerCase();
                  if (low.includes('overloaded') || low.includes('529') || low.includes('claude')) {
                    throw new Error(errMsg);
                  }
                  continue;
                }


                // Handle search confirmation request from backend (Yes/No card)
                if (parsed.searchConfirmation) {
                  metadata = { ...metadata, searchConfirmation: parsed.searchConfirmation };
                  continue;
                }

                // Handle reminder scheduled confirmation from backend interception
                if (parsed.reminderScheduled) {
                  metadata = { ...metadata, reminderScheduled: parsed.reminderScheduled };
                  continue;
                }

                if (typeof parsed.token === 'string') { 
                  if (!firstTokenReceived) { firstTokenReceived = true; }
                  fullResponse += parsed.token; 
                  if (!fullResponse.includes('{"action"')) {
                    onToken?.(parsed.token);
                  }
                }
                else if (typeof parsed.response === 'string') { 
                  if (!firstTokenReceived) { firstTokenReceived = true; }
                  fullResponse += parsed.response; 
                  onToken?.(parsed.response); 
                }
                else if (typeof parsed.content === 'string') { 
                  if (!firstTokenReceived) { firstTokenReceived = true; }
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
                if (!firstTokenReceived) { firstTokenReceived = true; }
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

        if (encounteredError) throw new Error(String(encounteredError));

        // Persist updated rolling summary — fire-and-forget, never blocks the stream return.
        // Captures fullResponse in closure at the moment stream completes.
        const _summarySnapshot = fullResponse;
        (async () => {
          try {
            const msgsForSummary: AIMessage[] = [
              ...enhancedMessages,
              { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() } as AIMessage,
              { id: `assistant-${Date.now()}`, role: 'assistant', content: _summarySnapshot, timestamp: new Date() } as AIMessage
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
        })();

        // Reminder scheduling is now handled entirely by the backend (edge function interception).
        // The backend detects the JSON block, schedules via schedule-reminder-push, and strips it.
        // Frontend receives a `reminderScheduled` event in the SSE stream when a reminder is set.
        // No frontend parsing needed — just log if backend confirmed a reminder was scheduled.
        // Invisibility cloak: strip only a TRAILING action JSON block (not mid-response)
        const stripTrailing = (t: string) => {
          const idx = t.lastIndexOf('{"action"');
          if (idx === -1) return t.trim();
          const after = t.slice(idx).trim();
          try {
            const parsed = JSON.parse(after);
            if (parsed && typeof parsed === 'object' && 'action' in parsed) return t.slice(0, idx).trim();
          } catch {}
          return t.trim();
        };
        const cleanResponse = stripTrailing(fullResponse);
        return { response: cleanResponse, metadata };
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
        const maybeAnonKey = this.getAnonKey();

        // Await DB refresh if local PT has no nickname (prevents 'friend' fallback on first vision call).
        const pt = await this.ensurePersonalTouchAwaitingDB(userId);
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
          } catch (uploadErr: any) {
            console.error('❌ VISION UPLOAD error (will try base64 fallback):', uploadErr?.message || uploadErr, 'mime:', mime, 'request:', requestId);
            uploadedUrl = null;
          }
          if (uploadedUrl) {
            payloadImages.push({ mimeType: mime, url: uploadedUrl });
          } else {
            // Fallback: send base64 directly (capped at 1.2MB to avoid gateway abort)
            const approxBytes = Math.round(base64.length * 0.75);
            if (approxBytes <= 1.2 * 1024 * 1024) {
              console.warn('⚠️ VISION: Upload failed, using base64 fallback (size:', approxBytes, 'bytes)');
              payloadImages.push({ mimeType: mime, base64 });
            } else {
              console.error('❌ VISION: Upload failed and image too large for base64 fallback', approxBytes, 'bytes');
              throw new Error('vision_upload_failed');
            }
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
            // Extract visionCategory from the first image's imageType.id (set by the UI dropdown)
            const visionCategory = (visionFiles[0] as any)?.imageType?.id || 'general';
            const body = {
              requestId: requestId,
              prompt: visionPrompt,
              language,
              personalTouch: pt,
              provider: primary,
              // NOTE: `model` is intentionally NOT sent here. The edge function picks
              // its own model per provider (Claude 3.5 Sonnet / GPT-4o) and ignores any
              // client hint. Sending one caused confusing client/server disagreements.
              stream: true,
              images: payloadImages,
              options: { ocr: true, max_tokens: 4000 },
              chatSubmode: chatSubmode, // Pass Study mode to Vision for tutor-style responses
              visionCategory // Pass the UI dropdown category for intent-based prompt routing
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
        let chunkCount = 0;

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
              break;
            }
            chunkCount++;
            const rawChunk = decoder.decode(value, { stream: true });
            buffer += rawChunk;
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

        // Check for reminder CONFIRMATION in vision response and create scheduled reminder
        // ONLY create reminder on CONFIRM (user said yes), NOT on OFFER
        try {
          const reminderData = parseReminderFromResponse(fullResponse);
          if (reminderData && reminderData.type === 'confirm') {
            const data = reminderData.data as { scheduled_for?: string; reminder_text?: string; timezone?: string; replaces_previous?: boolean };
            let scheduledTime = data.scheduled_for;
            const reminderText = data.reminder_text || 'Reminder from Wakti AI';
            const replacesPrevious = data.replaces_previous === true;
            
            // SAFETY NET: If AI calculated a time in the past, try to fix it
            if (scheduledTime) {
              const scheduledDate = new Date(scheduledTime);
              const now = new Date();
              const oneMinuteAgo = now.getTime() - 60000;
              
              if (scheduledDate.getTime() < oneMinuteAgo) {
                console.warn('⚠️ REMINDER FIX (Vision): AI output past time, attempting to recalculate...', { 
                  aiTime: scheduledTime, 
                  now: now.toISOString() 
                });
                
                // Use the current user message (in scope from sendStreamingMessage param)
                const lastUserMsg = (message || '').toLowerCase();
                
                const minuteMatch = lastUserMsg.match(/in\s+(\d+|a|one|an)\s*min/i);
                const hourMatch = lastUserMsg.match(/in\s+(\d+|a|one|an)\s*hour/i);
                
                let fixedTime: Date | null = null;
                
                if (minuteMatch) {
                  const numStr = minuteMatch[1].toLowerCase();
                  const minutes = (numStr === 'a' || numStr === 'one' || numStr === 'an') ? 1 : parseInt(numStr, 10);
                  if (!isNaN(minutes) && minutes > 0 && minutes <= 1440) {
                    fixedTime = new Date(now.getTime() + minutes * 60000);
                    console.log(`🔧 REMINDER FIX (Vision): Recalculated "in ${minutes} minute(s)" → ${fixedTime.toISOString()}`);
                  }
                } else if (hourMatch) {
                  const numStr = hourMatch[1].toLowerCase();
                  const hours = (numStr === 'a' || numStr === 'one' || numStr === 'an') ? 1 : parseInt(numStr, 10);
                  if (!isNaN(hours) && hours > 0 && hours <= 24) {
                    fixedTime = new Date(now.getTime() + hours * 3600000);
                    console.log(`🔧 REMINDER FIX (Vision): Recalculated "in ${hours} hour(s)" → ${fixedTime.toISOString()}`);
                  }
                }
                
                if (fixedTime) {
                  scheduledTime = fixedTime.toISOString();
                } else {
                  console.error('❌ REMINDER FIX (Vision): Could not recalculate time, skipping reminder creation');
                  scheduledTime = undefined;
                }
              }
            }
            
            if (scheduledTime && userId) {
              // Only cancel previous reminders if AI explicitly says it's replacing/adjusting one
              if (replacesPrevious) {
                console.log('🔔 REMINDER (Vision): AI indicated this replaces a previous reminder, cancelling old one...');
                const cancelledCount = await cancelRecentPendingReminders(userId, 30);
                if (cancelledCount > 0) {
                  console.log(`🔔 REMINDER (Vision): Cancelled ${cancelledCount} previous reminder(s) - replacing with corrected time`);
                }
              }
              
              console.log('🔔 REMINDER (Vision): Creating scheduled reminder (user confirmed)', { scheduledTime, reminderText, replacesPrevious });
              const result = await createScheduledReminder(
                userId,
                reminderText,
                scheduledTime,
                `AI Chat Reminder`
              );
              if (result.success) {
                console.log('✅ REMINDER (Vision): Successfully created reminder', result.id);
              } else {
                console.error('❌ REMINDER (Vision): Failed to create reminder', result.error);
              }
            }
          } else if (reminderData && reminderData.type === 'offer') {
            console.log('🔔 REMINDER (Vision): AI offered reminder, waiting for user confirmation...');
          }
        } catch (reminderErr) {
          console.warn('⚠️ REMINDER (Vision): Error processing reminder', reminderErr);
        }

        return { response: fullResponse, metadata };
      };

      // Try Claude first, then auto-fallback to OpenAI on 529/overloaded errors (text/search or fallback vision)
      try {
        // Short-circuit: no files → skip all vision processing, go straight to brain-stream
        if (attachedFiles && attachedFiles.length > 0 && activeTrigger !== 'image') {
          console.log('✅ VISION PATH: Entering vision processing with', attachedFiles.length, 'files');
          // Preflight: size-check and downscale large images client-side to avoid gateway aborts
          let processedFiles: any[] = [];
          try {
            processedFiles = await this.prepareVisionAttachments(attachedFiles);
            console.log('✅ VISION PREFLIGHT: Processed', processedFiles.length, 'files');
          } catch (prepErr: any) {
            const msg = (prepErr?.message || 'Images too large. Please upload smaller images.');
            console.error('❌ VISION PREFLIGHT FAILED:', msg);
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
        // Backend uses Gemini 3 Flash (Brain-First) → auto-falls back to OpenAI → Claude
        const res = await attemptStream('gemini-brain');
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
        const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      const pt = this.ensurePersonalTouch();

      // FAST-PATH: YouTube Search via 'yt:' or 'yt ' prefix — short-circuit BEFORE any location fetch,
      // PT assembly, message enhancement, or LLM streaming. YouTube search does not need geolocation.
      if (activeTrigger === 'search') {
        const ytPrefixMatchEarly = /^(?:\s*yt:\s*|\s*yt\s+)(.*)$/i.exec(message || '');
        if (ytPrefixMatchEarly) {
          const query = (ytPrefixMatchEarly[1] || '').trim();
          if (!query) {
            return {
              response: language === 'ar' ? 'يرجى إدخال عبارة للبحث في يوتيوب.' : 'Please enter a query to search YouTube.',
              error: false,
              intent: 'search'
            } as any;
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('No valid session for YouTube search');
          }
          const anonKey = this.getAnonKey();
          const supabaseUrl = ((import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL)
            || 'https://hxauxozopvpzpdygoqwf.supabase.co';

          try {
            console.log(`📺 YOUTUBE FAST-PATH: query="${query}"`);
            const resp = await fetch(`${supabaseUrl}/functions/v1/youtube-search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': anonKey
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

            const results = Array.isArray(data?.results) ? data.results.filter((r: any) => r?.videoId) : [];
            if (results.length === 0) {
              return {
                response: language === 'ar' ? 'لم يتم العثور على نتائج صالحة.' : 'No valid results found.',
                error: false,
                intent: 'search',
                metadata: { youtubeError: 'invalid' }
              } as any;
            }

            const youtubeResults = results.map((r: any) => ({
              videoId: String(r.videoId),
              title: r.title ? String(r.title) : '',
              description: r.description ? String(r.description) : '',
              thumbnail: r.thumbnail ? String(r.thumbnail) : '',
              publishedAt: r.publishedAt ? String(r.publishedAt) : '',
            }));

            console.log(`📺 YOUTUBE FAST-PATH: got ${youtubeResults.length} results`);
            return {
              response: language === 'ar' ? 'إليك نتائج يوتيوب' : 'Here are the YouTube results',
              error: false,
              intent: 'search',
              modelUsed: 'youtube-search',
              browsingUsed: true,
              metadata: { youtubeResults }
            } as any;
          } catch (ytErr: any) {
            console.error('📺 YOUTUBE FAST-PATH error:', ytErr);
            return {
              response: language === 'ar' ? 'تعذر الوصول إلى بحث يوتيوب حالياً.' : 'Unable to reach YouTube search right now.',
              error: true,
              intent: 'search',
              metadata: { youtubeError: 'exception' }
            } as any;
          }
        }
      }

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

      // Load user location (country, city) to include in metadata
      // If query contains "near me", weather, traffic, or place patterns, force fresh location
      const needsFreshLocation = activeTrigger === 'search' || queryNeedsFreshLocation(message);
      if (needsFreshLocation) {
        console.log(`📍 LOCATION (non-streaming): Query needs fresh location - "${message.substring(0, 50)}..."`);
      }
      const location = await this.getUserLocation(userId, needsFreshLocation);

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

      let finalSummary = this.pickConversationSummary(conversationSummary, storedSummary, generatedSummary);

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

      // YouTube search is handled by the fast-path above (before location fetch). No duplicate here.

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
