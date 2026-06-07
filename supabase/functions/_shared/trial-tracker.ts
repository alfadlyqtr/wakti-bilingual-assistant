export type TrialFeatureKey =
  | 'ai_chat'
  | 'tasjeel'
  | 't2i'
  | 'i2i'
  | 'bg_removal'
  | 'music'
  | 'ai_video'
  | 'i2v'
  | 't2v'
  | '2i2v'
  | 'compose'
  | 'reply'
  | 'diagrams'
  | 'ppt'
  | 'tts'
  | 'translate'
  | 'interpreter'
  | 'voice_clone'
  | 'ai_coder'
  | 'ai_chatbot';

export type TrialBlockReason = 'feature_locked' | 'limit_reached' | 'trial_expired' | 'profile_unavailable';

export interface TrialCheckResult {
  allowed: boolean;
  consumed: number;
  limit: number;
  remaining?: number;
  isVip?: boolean;
  reason?: TrialBlockReason;
  justExhausted?: boolean;
  trialActive?: boolean;
}

export interface TrialProfileShape {
  trial_usage?: Record<string, unknown> | null;
  is_subscribed?: boolean | null;
  payment_method?: string | null;
  next_billing_date?: string | null;
  admin_gifted?: boolean | null;
  free_access_start_at?: string | null;
  updated_at?: string | null;
}

export interface TrialTimerState {
  started: boolean;
  active: boolean;
  expired: boolean;
  startAt: number | null;
}

const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const TRIAL_CONSUMPTION_LEDGER_KEY = '__consumed_once';

function normalizeUsage(profile: TrialProfileShape): Record<string, number> {
  const rawUsage = profile.trial_usage;
  if (!rawUsage || typeof rawUsage !== 'object') {
    return {};
  }

  return Object.entries(rawUsage).reduce<Record<string, number>>((acc, [key, value]) => {
    if (key === TRIAL_CONSUMPTION_LEDGER_KEY) {
      return acc;
    }

    acc[key] = typeof value === 'number' ? value : 0;
    return acc;
  }, {});
}

function getConsumptionLedger(profile: TrialProfileShape): Record<string, boolean> {
  const rawUsage = profile.trial_usage;
  if (!rawUsage || typeof rawUsage !== 'object') {
    return {};
  }

  const ledger = (rawUsage as Record<string, unknown>)[TRIAL_CONSUMPTION_LEDGER_KEY];
  if (!ledger || typeof ledger !== 'object') {
    return {};
  }

  return Object.entries(ledger as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [key, value]) => {
    if (value === true) {
      acc[key] = true;
    }
    return acc;
  }, {});
}

function buildUpdatedTrialUsage(
  profile: TrialProfileShape,
  featureKey: TrialFeatureKey,
  newValue: number,
  onceKey?: string,
): Record<string, unknown> {
  const rawUsage = profile.trial_usage && typeof profile.trial_usage === 'object'
    ? { ...profile.trial_usage }
    : {};

  rawUsage[featureKey] = newValue;

  if (onceKey) {
    const currentLedger = getConsumptionLedger(profile);
    rawUsage[TRIAL_CONSUMPTION_LEDGER_KEY] = {
      ...currentLedger,
      [onceKey]: true,
    };
  }

  return rawUsage;
}

function buildBlockedResult(
  profile: TrialProfileShape | null,
  featureKey: TrialFeatureKey,
  maxLimit: number,
  reason: TrialBlockReason,
): TrialCheckResult {
  const usage = profile ? normalizeUsage(profile) : {};
  const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
  const normalizedLimit = Math.max(0, maxLimit);
  const remaining = reason === 'feature_locked' || reason === 'trial_expired'
    ? 0
    : Math.max(0, normalizedLimit - current);

  return {
    allowed: false,
    consumed: current,
    limit: normalizedLimit,
    remaining,
    reason,
    trialActive: reason === 'feature_locked' || reason === 'limit_reached',
  };
}

export function getTrialTimerState(profile: TrialProfileShape | null | undefined): TrialTimerState {
  const rawStart = profile?.free_access_start_at;
  if (!rawStart) {
    return {
      started: false,
      active: false,
      expired: false,
      startAt: null,
    };
  }

  const startAt = Date.parse(rawStart);
  if (!Number.isFinite(startAt)) {
    return {
      started: false,
      active: false,
      expired: false,
      startAt: null,
    };
  }

  const now = Date.now();
  const elapsed = now - startAt;
  // Guarded rollout:
  // - Trials that are still within 24h (including all new trials) get a 48h window
  // - Trials that already passed 24h remain expired (window stays 24h)
  const windowMs = elapsed < TRIAL_WINDOW_MS ? (2 * TRIAL_WINDOW_MS) : TRIAL_WINDOW_MS;
  const active = elapsed >= 0 && elapsed < windowMs;

  return {
    started: true,
    active,
    expired: !active,
    startAt,
  };
}

export function isTrialTimerActive(profile: TrialProfileShape | null | undefined): boolean {
  return getTrialTimerState(profile).active;
}

function resolveTrialAccess(
  profile: TrialProfileShape,
  featureKey: TrialFeatureKey,
  maxLimit: number,
): TrialCheckResult {
  const isPaid = profile.is_subscribed === true;
  const isGifted = profile.admin_gifted === true;
  const pm = profile.payment_method;
  const hasRealPaymentMethod =
    pm != null && typeof pm === 'string' && pm.trim().length > 0 && pm !== 'manual';
  const isActiveSubscriber =
    hasRealPaymentMethod && profile.next_billing_date != null &&
    new Date(profile.next_billing_date as string) > new Date();

  if (isPaid || isActiveSubscriber || isGifted) {
    return { allowed: true, consumed: 0, limit: maxLimit, remaining: maxLimit, isVip: true, trialActive: false };
  }

  const timerState = getTrialTimerState(profile);

  if (!timerState.started) {
    return { allowed: true, consumed: 0, limit: maxLimit, remaining: maxLimit, trialActive: false };
  }

  if (timerState.expired) {
    return buildBlockedResult(profile, featureKey, maxLimit, 'trial_expired');
  }

  if (maxLimit <= 0) {
    return buildBlockedResult(profile, featureKey, maxLimit, 'feature_locked');
  }

  const usage = normalizeUsage(profile);
  const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
  const remaining = Math.max(0, maxLimit - current);

  if (current >= maxLimit) {
    return buildBlockedResult(profile, featureKey, maxLimit, 'limit_reached');
  }

  return {
    allowed: true,
    consumed: current,
    limit: maxLimit,
    remaining,
    trialActive: true,
  };
}

async function fetchTrialProfile(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
): Promise<TrialProfileShape | null> {
  const { data: profile, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('trial_usage, is_subscribed, payment_method, next_billing_date, admin_gifted, free_access_start_at, updated_at')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    console.error('[trial-tracker] Failed to fetch profile:', fetchError);
    return null;
  }

  return profile as TrialProfileShape;
}

export function getTrialErrorCode(result: TrialCheckResult): 'TRIAL_LIMIT_REACHED' | 'TRIAL_FEATURE_LOCKED' | 'TRIAL_EXPIRED' {
  if (result.reason === 'feature_locked') {
    return 'TRIAL_FEATURE_LOCKED';
  }

  if (result.reason === 'trial_expired') {
    return 'TRIAL_EXPIRED';
  }

  return 'TRIAL_LIMIT_REACHED';
}

export function buildTrialErrorPayload(featureKey: TrialFeatureKey, result: TrialCheckResult) {
  return {
    error: 'TRIAL_LIMIT_REACHED',
    code: getTrialErrorCode(result),
    feature: featureKey,
    reason: result.reason,
    consumed: result.consumed,
    limit: result.limit,
    remaining: result.remaining ?? Math.max(0, result.limit - result.consumed),
  };
}

export function buildTrialSuccessPayload(featureKey: TrialFeatureKey, result: TrialCheckResult) {
  if (result.isVip || result.trialActive !== true) {
    return null;
  }

  return {
    feature: featureKey,
    consumed: result.consumed,
    limit: result.limit,
    remaining: result.remaining ?? Math.max(0, result.limit - result.consumed),
    justExhausted: result.justExhausted === true,
  };
}

export async function checkTrialAccess(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  featureKey: TrialFeatureKey,
  maxLimit: number
): Promise<TrialCheckResult> {
  const profile = await fetchTrialProfile(supabaseClient, userId);

  if (!profile) {
    return buildBlockedResult(null, featureKey, maxLimit, 'profile_unavailable');
  }

  return resolveTrialAccess(profile, featureKey, maxLimit);
}

async function tryUpdateTrialUsage(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  profile: TrialProfileShape,
  updatedUsage: Record<string, unknown>,
): Promise<boolean> {
  let query = supabaseClient
    .from('profiles')
    .update({ trial_usage: updatedUsage })
    .eq('id', userId);

  if (profile.updated_at == null) {
    query = query.is('updated_at', null);
  } else {
    query = query.eq('updated_at', profile.updated_at);
  }

  const { data, error } = await query
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[trial-tracker] Failed to update usage row:', error);
    return false;
  }

  return !!data;
}

/**
 * Checks whether a trial user has quota remaining for a feature, then atomically
 * increments the counter if they do.
 *
 * @param supabaseClient  - A Supabase client initialised with the service-role key
 * @param userId          - The authenticated user's UUID
 * @param featureKey      - Which feature to check/consume (see TrialFeatureKey)
 * @param maxLimit        - Maximum uses allowed during the trial for this feature
 * @returns { allowed, consumed, limit }
 *   - allowed:  true  → counter was incremented, caller may proceed
 *   - allowed:  false → limit already reached, caller must block and prompt subscribe
 *   - consumed: value AFTER increment (or current value if blocked)
 *   - limit:    the maxLimit that was applied
 */
// deno-lint-ignore-file no-explicit-any
export async function checkAndConsumeTrialToken(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  featureKey: TrialFeatureKey,
  maxLimit: number
): Promise<TrialCheckResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const profile = await fetchTrialProfile(supabaseClient, userId);

    if (!profile) {
      return buildBlockedResult(null, featureKey, maxLimit, 'profile_unavailable');
    }

    const access = resolveTrialAccess(profile, featureKey, maxLimit);

    if (!access.allowed || access.isVip || access.trialActive !== true) {
      return access;
    }

    const usage = normalizeUsage(profile);
    const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
    const newValue = current + 1;
    const updatedUsage = buildUpdatedTrialUsage(profile, featureKey, newValue);
    const updated = await tryUpdateTrialUsage(supabaseClient, userId, profile, updatedUsage);

    if (!updated) {
      continue;
    }

    return {
      allowed: true,
      consumed: newValue,
      limit: maxLimit,
      remaining: Math.max(0, maxLimit - newValue),
      justExhausted: newValue >= maxLimit,
      trialActive: true,
    };
  }

  return buildBlockedResult(null, featureKey, maxLimit, 'profile_unavailable');
}

export async function checkAndConsumeTrialTokenOnce(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  featureKey: TrialFeatureKey,
  maxLimit: number,
  onceKey: string,
): Promise<TrialCheckResult> {
  const normalizedOnceKey = onceKey.trim();
  if (!normalizedOnceKey) {
    return checkAndConsumeTrialToken(supabaseClient, userId, featureKey, maxLimit);
  }

  const ledgerKey = `${featureKey}:${normalizedOnceKey}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const profile = await fetchTrialProfile(supabaseClient, userId);

    if (!profile) {
      return buildBlockedResult(null, featureKey, maxLimit, 'profile_unavailable');
    }

    const usage = normalizeUsage(profile);
    const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
    const ledger = getConsumptionLedger(profile);
    const timerState = getTrialTimerState(profile);

    if (ledger[ledgerKey] === true) {
      return {
        allowed: true,
        consumed: current,
        limit: maxLimit,
        remaining: Math.max(0, maxLimit - current),
        justExhausted: current >= maxLimit,
        trialActive: timerState.active,
      };
    }

    const access = resolveTrialAccess(profile, featureKey, maxLimit);
    if (!access.allowed || access.isVip || access.trialActive !== true) {
      return access;
    }

    const newValue = current + 1;
    const updatedUsage = buildUpdatedTrialUsage(profile, featureKey, newValue, ledgerKey);
    const updated = await tryUpdateTrialUsage(supabaseClient, userId, profile, updatedUsage);

    if (!updated) {
      continue;
    }

    return {
      allowed: true,
      consumed: newValue,
      limit: maxLimit,
      remaining: Math.max(0, maxLimit - newValue),
      justExhausted: newValue >= maxLimit,
      trialActive: true,
    };
  }

  return buildBlockedResult(null, featureKey, maxLimit, 'profile_unavailable');
}
