import type { Session, User } from '@supabase/supabase-js';

export type GuestRestrictionCode = 'ANONYMOUS_CHAT_ONLY' | 'TRIAL_LIMIT_REACHED' | 'TRIAL_EXPIRED' | 'TRIAL_FEATURE_LOCKED';

export function isAnonymousUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if ((user as any).is_anonymous === true) return true;
  if ((user.app_metadata as any)?.provider === 'anonymous') return true;
  if ((user.app_metadata as any)?.is_anonymous === true) return true;
  if ((user.user_metadata as any)?.is_anonymous === true) return true;
  return false;
}

export function isAnonymousSession(session: Session | null | undefined): boolean {
  return isAnonymousUser(session?.user);
}

export function getGuestDisplayName(user: Pick<User, 'email' | 'user_metadata'> | null | undefined, language: 'en' | 'ar' = 'en'): string {
  const userMetadata = user?.user_metadata as Record<string, any> | undefined;
  const metadataName = typeof userMetadata?.full_name === 'string' && userMetadata.full_name.trim()
    ? userMetadata.full_name.trim()
    : typeof userMetadata?.display_name === 'string' && userMetadata.display_name.trim()
      ? userMetadata.display_name.trim()
      : null;

  if (metadataName) return metadataName;
  if (typeof user?.email === 'string' && user.email.includes('@')) {
    return user.email.split('@')[0] || user.email;
  }

  return language === 'ar' ? 'ضيف' : 'Guest';
}

export function isGuestRestrictionCode(value: unknown): value is GuestRestrictionCode {
  return value === 'ANONYMOUS_CHAT_ONLY'
    || value === 'TRIAL_LIMIT_REACHED'
    || value === 'TRIAL_EXPIRED'
    || value === 'TRIAL_FEATURE_LOCKED';
}
