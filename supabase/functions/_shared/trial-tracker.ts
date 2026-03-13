export type TrialFeatureKey =
  | 'ai_chat'
  | 'tasjeel'
  | 't2i'
  | 'i2i'
  | 'bg_removal'
  | 'music'
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

export interface TrialCheckResult {
  allowed: boolean;
  consumed: number;
  limit: number;
  isVip?: boolean;
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
  supabaseClient: any,
  userId: string,
  featureKey: TrialFeatureKey,
  maxLimit: number
): Promise<TrialCheckResult> {
  const { data: profile, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('trial_usage, is_subscribed, payment_method, next_billing_date')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    console.error('[trial-tracker] Failed to fetch profile:', fetchError);
    return { allowed: false, consumed: 0, limit: maxLimit };
  }

  const isPaid = profile.is_subscribed === true;
  const isActiveGift =
    profile.payment_method === 'manual' &&
    profile.next_billing_date != null &&
    new Date(profile.next_billing_date as string) > new Date();

  if (isPaid || isActiveGift) {
    return { allowed: true, consumed: 0, limit: maxLimit, isVip: true };
  }

  const usage: Record<string, number> = (profile.trial_usage as unknown as Record<string, number>) ?? {};
  const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;

  if (current >= maxLimit) {
    return { allowed: false, consumed: current, limit: maxLimit };
  }

  const newValue = current + 1;
  const updatedUsage = { ...usage, [featureKey]: newValue };

  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ trial_usage: updatedUsage })
    .eq('id', userId);

  if (updateError) {
    console.error('[trial-tracker] Failed to increment usage:', updateError);
    return { allowed: false, consumed: current, limit: maxLimit };
  }

  return { allowed: true, consumed: newValue, limit: maxLimit };
}
