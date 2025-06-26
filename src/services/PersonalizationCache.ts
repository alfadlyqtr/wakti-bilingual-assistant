
export interface UserPersonalization {
  nickname?: string;
  role?: string;
  main_use?: string;
  interests?: string[];
  ai_tone?: string;
  reply_style?: string;
  traits?: string[];
  communication_style?: string;
  response_length?: string;
  personal_note?: string;
  auto_enable?: boolean;
}

const PERSONALIZATION_KEY = "wakti_user_personalization";
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

interface CachedPersonalization {
  data: UserPersonalization;
  timestamp: number;
  expires: number;
}

export class PersonalizationCache {
  static save(data: UserPersonalization): void {
    try {
      const cached: CachedPersonalization = {
        data,
        timestamp: Date.now(),
        expires: Date.now() + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000)
      };
      localStorage.setItem(PERSONALIZATION_KEY, JSON.stringify(cached));
      console.log('✅ Personalization cached successfully');
    } catch (error) {
      console.warn('Failed to cache personalization:', error);
    }
  }

  static load(): UserPersonalization | null {
    try {
      const stored = localStorage.getItem(PERSONALIZATION_KEY);
      if (!stored) return null;

      const cached: CachedPersonalization = JSON.parse(stored);
      
      // Check if cache has expired
      if (Date.now() > cached.expires) {
        console.log('⏰ Personalization cache expired, clearing');
        this.clear();
        return null;
      }

      console.log('🚀 Loaded personalization from cache');
      return cached.data;
    } catch (error) {
      console.warn('Failed to load personalization cache:', error);
      this.clear();
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(PERSONALIZATION_KEY);
      console.log('🗑️ Personalization cache cleared');
    } catch (error) {
      console.warn('Failed to clear personalization cache:', error);
    }
  }

  static isValid(): boolean {
    try {
      const stored = localStorage.getItem(PERSONALIZATION_KEY);
      if (!stored) return false;

      const cached: CachedPersonalization = JSON.parse(stored);
      return Date.now() < cached.expires;
    } catch {
      return false;
    }
  }

  static update(updates: Partial<UserPersonalization>): void {
    const current = this.load() || {};
    const updated = { ...current, ...updates };
    this.save(updated);
  }
}
