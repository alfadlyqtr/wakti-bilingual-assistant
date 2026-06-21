// @ts-nocheck
import { supabase, ensurePassport, getCurrentUserId, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { clearLocationCache, getExactLocation, getNativeLocation, queryNeedsFreshLocation, containsNearMePattern } from '@/integrations/natively/locationBridge';
import { emitEvent } from '@/utils/eventBus';

// Module-level session cache — avoids a Supabase network round-trip on every message send.
// Token validity is 1 hour; we refresh 5 minutes early to be safe.
let _cachedSession: { access_token: string; expires_at?: number } | null = null;
let _sessionCachedAt = 0;
const SESSION_CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes

/** Call after guest → full-user conversion to force the next message to use the fresh JWT. */
export function clearCachedSession() {
  _cachedSession = null;
  _sessionCachedAt = 0;
}

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
  is_active?: boolean;
  conversation_id?: string | null;
  is_saved?: boolean;
  is_custom_title?: boolean;
  message_count?: number;
}

type UserLocationContext = {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  timezone?: string | null;
  source?: 'native' | 'browser' | 'unknown';
  updatedAt?: number;
};

const LOCATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - people move around!
const NEAR_ME_LOCATION_REQUIRED_MESSAGE = 'I need your exact location to find the best spots around you. Please ensure your device GPS is enabled and try again.';
const STRICT_NEAR_ME_BROWSER_MAX_ACCURACY = 1000;

const extractBackendErrorCode = (payload: any): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.code,
    payload.error_code,
    payload.errorCode,
    payload.reason_code,
    payload.reasonCode,
    payload.error?.code,
    payload.error?.error_code,
    payload.error?.errorCode,
    payload.error?.type,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

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
  private async ensurePersonalTouchAwaitingDB(userId?: string, opts?: { forceRefresh?: boolean }): Promise<any> {
    try {
      let current: any = null;
      try { current = this.getPersonalTouch(); } catch {}
      const hasNickname = !!(current && typeof current === 'object' && (current.nickname || '').toString().trim());
      const forceRefresh = opts?.forceRefresh === true;
      if ((forceRefresh || !hasNickname) && userId) {
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

    try {
      const displayName = this.getCachedDisplayName();
      if (!pt.nickname && displayName) pt.displayName = displayName;
      else if (pt.nickname && pt.displayName) delete pt.displayName;
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
      if (typeof this.locationCache.latitude === 'number' && typeof this.locationCache.longitude === 'number') {
        return this.locationCache;
      }
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
      if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') return null;
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

  private isReliableNearMeLocation(loc: UserLocationContext | null): boolean {
    if (!loc) return false;
    if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return false;
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return false;
    if (Math.abs(loc.latitude) > 90 || Math.abs(loc.longitude) > 180) return false;
    if (loc.latitude === 0 || loc.longitude === 0) return false;

    const accuracy = typeof loc.accuracy === 'number' && Number.isFinite(loc.accuracy)
      ? loc.accuracy
      : null;

    if (accuracy !== null) {
      if (accuracy > 5000) return false;
      if (loc.source === 'browser' && accuracy > STRICT_NEAR_ME_BROWSER_MAX_ACCURACY) return false;
    }

    return true;
  }

  private buildNearMeLocationRequiredResult() {
    return {
      response: NEAR_ME_LOCATION_REQUIRED_MESSAGE,
      error: false,
      intent: 'search',
      metadata: {
        locationRequired: true,
        gpsRequired: true,
      },
    } as any;
  }

  private async getUserLocation(userId: string, forceFresh: boolean = false): Promise<UserLocationContext> {
    const now = Date.now();
    const previousCached = this.getCachedUserLocation(now);

    if (!forceFresh) {
      if (previousCached) return previousCached;
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

    try {
      if (forceFresh) {
        this.locationCache = null;
        try { localStorage.removeItem('wakti_user_location'); } catch {}
        clearLocationCache();
      }
      const nativeLoc = forceFresh
        ? await getExactLocation({
            timeoutMs: 10000,
            allowBrowserFallback: true,
          })
        : await getNativeLocation({
            timeoutMs: 6000,
            allowBrowserFallback: true,
          });
      if (nativeLoc && typeof nativeLoc.latitude === 'number' && typeof nativeLoc.longitude === 'number') {
        resolved = {
          ...resolved,
          latitude: nativeLoc.latitude,
          longitude: nativeLoc.longitude,
          accuracy: nativeLoc.accuracy ?? null,
          city: nativeLoc.city || resolved.city,
          country: nativeLoc.country || resolved.country,
          source: nativeLoc.source === 'browser' ? 'browser' : 'native',
        };
      }
    } catch (err) {
      console.warn('[WaktiAIV2Service] Native location error:', err);
    }

    if (forceFresh && !this.isReliableNearMeLocation(resolved)) {
      resolved = {
        ...resolved,
        latitude: null,
        longitude: null,
        accuracy: null,
        city: null,
        country: null,
        source: undefined,
      };
    }

    resolved.timezone = timezone;
    resolved.updatedAt = Date.now();
    const hasPreciseCoords = typeof resolved.latitude === 'number' && typeof resolved.longitude === 'number';
    if (hasPreciseCoords) {
      this.locationCache = resolved;
      try { localStorage.setItem('wakti_user_location', JSON.stringify(resolved)); } catch {}
    } else {
      this.locationCache = null;
      try { localStorage.removeItem('wakti_user_location'); } catch {}
    }
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

  private buildTransportRecentMessages(
    messages: AIMessage[],
    activeTrigger: string,
    chatSubmode: 'chat' | 'study' = 'chat'
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const limit = activeTrigger === 'search'
      ? 14
      : chatSubmode === 'study'
        ? 12
        : 16;

    const clipped = messages
      .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .slice(-limit)
      .map((msg, index, arr) => {
        const isLast = index === arr.length - 1;
        const maxLength = activeTrigger === 'search'
          ? (isLast ? 1400 : (msg.role === 'assistant' ? 900 : 1100))
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
      const forceFreshLocation = containsNearMePattern(message);
      const cachedLocation = needsLocation ? this.getCachedUserLocation() : null;
      const getBestSearchLocation = async (): Promise<UserLocationContext | null> => {
        if (!forceFreshLocation) {
          if (cachedLocation) return cachedLocation;
          return await Promise.race([
            this.getUserLocation(userId || '', false),
            new Promise<null>(r => setTimeout(() => r(null), 12000))
          ]);
        }

        try {
          const freshLocation = await this.getUserLocation(userId || '', true);
          if (this.isReliableNearMeLocation(freshLocation)) return freshLocation;
        } catch {
          // fall back below
        }

        try {
          this.locationCache = null;
          localStorage.removeItem('wakti_user_location');
        } catch {}

        return null;
      };
      const locationPromise: Promise<UserLocationContext | null> = needsLocation
        ? getBestSearchLocation()
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
            name: f.name,
            type: f.type,
            size: f.size,
            imageType: f.imageType,
            url: f.url,
            preview: f.preview,
            data: f.data,
            content: f.content,
            base64: f.base64,
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
      if (forceFreshLocation && !this.isReliableNearMeLocation(location)) {
        const refusal = this.buildNearMeLocationRequiredResult();
        onToken?.(refusal.response);
        onComplete?.(refusal.metadata);
        return { response: refusal.response, conversationId, metadata: refusal.metadata } as any;
      }
      userId = resolvedUserId || userId;
      if (needsLocation && userId && !location) {
        this.queueLocationWarmup(userId, forceFreshLocation).catch(() => {});
      }
      if (!userId) throw new Error('Authentication required');
      if (!session?.access_token) throw new Error('No valid session for streaming');

      // Build Personal Touch AFTER auth resolves. If local PT has no nickname, await DB refresh.
      // This guarantees the FIRST message of a session sends the correct nickname instead of
      // falling back to 'friend' on the backend.
      const pt = await this.ensurePersonalTouchAwaitingDB(userId, { forceRefresh: activeTrigger === 'search' });

      const clientTimezone = location?.timezone || this.getClientTimezone();

      const maybeAnonKey = this.getAnonKey();

      let streamAttachedFiles: any[] = attachedFiles;
      if (Array.isArray(attachedFiles) && attachedFiles.length > 0 && activeTrigger !== 'image') {
        try {
          streamAttachedFiles = await this.prepareVisionAttachments(attachedFiles);
          console.log('✅ MULTIMODAL PREFLIGHT: Processed attachments for brain stream', streamAttachedFiles.length);
        } catch (prepErr: any) {
          const msg = (prepErr?.message || 'Images too large. Please upload smaller images.');
          console.error('❌ MULTIMODAL PREFLIGHT FAILED:', msg);
          onError?.(msg);
          return { response: msg, conversationId, metadata: { multimodal: 'client_preflight_reject' } } as any;
        }
      }

      // Inner attempt function: parameterize primary provider and stream
      const attemptStream = async (primary: 'gemini-brain' | 'claude' | 'openai') => {
        const maxRetries = 2;
        let response;
        const normalizeStreamMetadata = (incoming: any) => {
          if (!incoming || typeof incoming !== 'object') return {};
          const next = { ...incoming };
          const geminiSearch = next.geminiSearch && typeof next.geminiSearch === 'object'
            ? next.geminiSearch
            : null;

          if (geminiSearch) {
            next.browsingUsed = true;
            next.browsingData = {
              provider: 'gemini-search',
              searchType: typeof geminiSearch.searchType === 'string' ? geminiSearch.searchType : undefined,
              cardType: typeof geminiSearch.cardType === 'string' ? geminiSearch.cardType : undefined,
              queries: Array.isArray(geminiSearch.queries) ? geminiSearch.queries : [],
              mapSearchQuery: typeof geminiSearch.mapSearchQuery === 'string' ? geminiSearch.mapSearchQuery : undefined,
              isNearMeQuery: typeof geminiSearch.isNearMeQuery === 'boolean' ? geminiSearch.isNearMeQuery : undefined,
              summary: typeof geminiSearch.summary === 'string' ? geminiSearch.summary : undefined,
              sources: Array.isArray(geminiSearch.sources) ? geminiSearch.sources : [],
              supports: Array.isArray(geminiSearch.supports) ? geminiSearch.supports : [],
              cards: Array.isArray(geminiSearch.cards) ? geminiSearch.cards : [],
              places: Array.isArray(geminiSearch.places) ? geminiSearch.places : [],
              finishReason: typeof geminiSearch.finishReason === 'string' ? geminiSearch.finishReason : undefined,
              truncated: typeof geminiSearch.truncated === 'boolean' ? geminiSearch.truncated : undefined,
              googleMapsWidgetContextToken: typeof geminiSearch.googleMapsWidgetContextToken === 'string'
                ? geminiSearch.googleMapsWidgetContextToken
                : undefined,
              searchEntryPointHtml: typeof geminiSearch.searchEntryPointHtml === 'string'
                ? geminiSearch.searchEntryPointHtml
                : undefined,
            };
          }

          return next;
        };

        const requestId = crypto.randomUUID();

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
                'apikey': maybeAnonKey,
                'x-request-id': requestId
              },
              body: JSON.stringify({
                message,
                language,
                conversationId,
                inputType,
                activeTrigger,
                chatSubmode,
                attachedFiles: streamAttachedFiles,
                recentMessages: transportMessages,
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
                      personalTouch: pt,
                      location,
                      clientTimezone
                    })
                  });
                  if (fallbackResp.ok) {
                    const json = await fallbackResp.json().catch(()=>({}));
                    const respText = (json?.response || json?.text || '').toString();
                    const normalizedMetadata = normalizeStreamMetadata(json?.metadata || {});
                    onToken?.(respText);
                    onComplete?.(normalizedMetadata);
                    return { response: respText, metadata: normalizedMetadata } as any;
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
                      personalTouch: this.ensurePersonalTouch()
                    })
                  });
                  if (fallbackResp.ok) {
                    const json = await fallbackResp.json().catch(()=>({}));
                    const respText = (json?.response || json?.text || '').toString();
                    const normalizedMetadata = normalizeStreamMetadata(json?.metadata || {});
                    onToken?.(respText);
                    onComplete?.(normalizedMetadata);
                    return { response: respText, metadata: normalizedMetadata } as any;
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
                        const backendCode = extractBackendErrorCode(parsed) || extractBackendErrorCode(errObj);
                        const errMsg = backendCode || (typeof errObj === 'string'
                          ? errObj
                          : (errObj?.message || errObj?.type || JSON.stringify(errObj)));
                        encounteredError = errMsg;
                      } else {
                        if (typeof parsed.token === 'string') { 
                          if (!firstTokenReceived) { firstTokenReceived = true; }
                          fullResponse += parsed.token; 
                          if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                            onToken?.(parsed.token);
                          }
                        }
                        else if (typeof parsed.response === 'string') { 
                          if (!firstTokenReceived) { firstTokenReceived = true; }
                          fullResponse += parsed.response; 
                          if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                            onToken?.(parsed.response);
                          }
                        }
                        else if (typeof parsed.content === 'string') { 
                          if (!firstTokenReceived) { firstTokenReceived = true; }
                          fullResponse += parsed.content; 
                          if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                            onToken?.(parsed.content);
                          }
                        }

                        if (parsed.metadata && typeof parsed.metadata === 'object') {
                          metadata = { ...metadata, ...normalizeStreamMetadata(parsed.metadata) };
                        }
                        if (parsed.done === true) {
                          if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
                        }
                      }
                    } catch {
                      if (!firstTokenReceived) { firstTokenReceived = true; }
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
                  const backendCode = extractBackendErrorCode(parsed) || extractBackendErrorCode(errObj);
                  const errMsg = backendCode || (typeof errObj === 'string'
                    ? errObj
                    : (errObj?.message || errObj?.type || JSON.stringify(errObj)));
                  encounteredError = errMsg;

                  // Trial limit reached — dispatch global event and stop cleanly
                  if (errMsg === 'TRIAL_LIMIT_REACHED' || parsed.trialLimitReached) {
                    emitEvent('wakti-trial-limit-reached', {
                      feature: parsed.feature || 'ai_chat',
                      reason: parsed.reason,
                      code: parsed.code,
                      consumed: parsed.consumed,
                      limit: parsed.limit,
                      remaining: parsed.remaining,
                    });
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
                  if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                    onToken?.(parsed.token);
                  }
                }
                else if (typeof parsed.response === 'string') { 
                  if (!firstTokenReceived) { firstTokenReceived = true; }
                  fullResponse += parsed.response; 
                  if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                    onToken?.(parsed.response);
                  }
                }
                else if (typeof parsed.content === 'string') { 
                  if (!firstTokenReceived) { firstTokenReceived = true; }
                  fullResponse += parsed.content; 
                  if (!/\{\s*"action"\s*:/.test(fullResponse)) {
                    onToken?.(parsed.content);
                  }
                }

                if (parsed.metadata && typeof parsed.metadata === 'object') {
                  const trialQuotaFinished = (parsed.metadata as { trialQuotaFinished?: { feature?: string; consumed?: number; limit?: number; remaining?: number; justExhausted?: boolean } }).trialQuotaFinished;
                  if (trialQuotaFinished) {
                    emitEvent('wakti-trial-quota-finished', {
                      feature: trialQuotaFinished.feature || 'ai_chat',
                      consumed: trialQuotaFinished.consumed,
                      limit: trialQuotaFinished.limit,
                      remaining: trialQuotaFinished.remaining,
                      justExhausted: trialQuotaFinished.justExhausted,
                    });
                  }
                  metadata = { ...metadata, ...normalizeStreamMetadata(parsed.metadata) };
                }
                if (parsed.done === true) {
                  if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
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

        // Action scheduling/storage is handled by the backend interception layer.
        // Frontend still strips any trailing action JSON blocks as a final safety net.
        const stripTrailing = (t: string) => {
          const lines = (t || '').split('\n');
          let cursor = lines.length - 1;
          let strippedAny = false;

          while (cursor >= 0) {
            const trimmed = lines[cursor].trim();
            if (!trimmed) {
              cursor -= 1;
              continue;
            }

            if (!(trimmed.startsWith('{') && trimmed.includes('"action"'))) {
              break;
            }

            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed === 'object' && 'action' in parsed) {
                strippedAny = true;
                cursor -= 1;
                continue;
              }
              break;
            } catch {
              strippedAny = true;
              cursor -= 1;
            }
          }

          if (!strippedAny) return t.trim();
          return lines.slice(0, cursor + 1).join('\n').trim();
        };
        const cleanResponse = stripTrailing(fullResponse);
        return { response: cleanResponse, metadata };
      };

      // Try Claude first, then auto-fallback to OpenAI on 529/overloaded errors (text/search or fallback vision)
      try {
        // Unified path: always use wakti-ai-v2-brain-stream (text + multimodal attachments)
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
      // Only explicit near-me requests should force a fresh GPS lookup.
      const needsFreshLocation = containsNearMePattern(message);
      if (needsFreshLocation) {
        console.log(`📍 LOCATION (non-streaming): Query needs fresh location - "${message.substring(0, 50)}..."`);
      }
      const location = await this.getUserLocation(userId, needsFreshLocation);
      if (needsFreshLocation && !this.isReliableNearMeLocation(location)) {
        return this.buildNearMeLocationRequiredResult();
      }

      // Enhanced message handling with 100-message memory window
      // CRITICAL: Strip large data to avoid huge request bodies that crash Edge Functions
      const rawEnhanced = this.getEnhancedMessages(recentMessages);
      const enhancedMessages = rawEnhanced.map(msg => {
        const cleaned: any = { ...msg };
        
        // Keep attachment payload fields for persistence and reload continuity
        if (cleaned.attachedFiles && Array.isArray(cleaned.attachedFiles)) {
          cleaned.attachedFiles = cleaned.attachedFiles.map((f: any) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            imageType: f.imageType,
            url: f.url,
            preview: f.preview,
            data: f.data,
            content: f.content,
            base64: f.base64,
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
