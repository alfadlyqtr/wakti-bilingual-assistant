import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

/**
 * Item #8 Batch C1: Encapsulates the "start free trial" flow that used to live
 * inline inside `CustomPaywallModal.handleSkip`. Extracting it gives us:
 *
 *   1. A single source of truth for trial-start logic (Edge Function + legacy
 *      fallback), so future callers (e.g. re-trial flows, admin utilities)
 *      don't have to re-copy the same 60-line block.
 *   2. Testability — this hook has no UI concerns.
 *   3. Clear split of responsibilities: the hook owns DB/Edge-Function + event
 *      dispatches, the caller owns UI side effects (toasts, modal close,
 *      OneSignal permission request).
 *
 * Primary path: invokes the atomic `start-trial` Edge Function, which returns
 * the fresh profile and schedules push reminders server-side.
 *
 * Legacy fallback: if the Edge Function is unreachable or errors out, upsert
 * the trial flags on the client and schedule the push reminders via the
 * `schedule-reminder-push` Edge Function — matching the behaviour that shipped
 * before the atomic endpoint existed.
 */

type StartTrialLanguage = 'en' | 'ar' | string;

export interface StartTrialResult {
  ok: boolean;
  source?: 'edge' | 'legacy';
  error?: unknown;
}

export interface StartTrialOptions {
  language: StartTrialLanguage;
  /**
   * When the Edge Function fails and we fall through to the legacy upsert
   * path, also schedule the three client-side push reminders (12h / 22h / 24h).
   * Default: true. Set to false if the caller is in a context where reminders
   * should not fire (e.g. internal admin "mark trial started" tools).
   */
  schedulePushes?: boolean;
}

const LEGACY_PUSH_REMINDERS: Array<{ delayHours: number; en: string; ar: string }> = [
  {
    delayHours: 12,
    en: '12 hours left of your Wakti trial subscribe now and get 3 more free days',
    ar: 'باقي 12 ساعة على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية',
  },
  {
    delayHours: 22,
    en: '2 hours left of your Wakti trial subscribe now and get 3 more free days',
    ar: 'باقي ساعتين على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية',
  },
  {
    delayHours: 24,
    en: 'Your Wakti trial has ended. Subscribe to continue guess what you still get 3 more free days',
    ar: 'انتهت تجربتك في وقتي. اشترك للمتابعة والمفاجأة، لا تزال تحصل على 3 أيام مجانية',
  },
];

function broadcastTrialStarted(): void {
  try {
    window.dispatchEvent(new CustomEvent('wakti-trial-started'));
    window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
  } catch {
    // SSR / non-window envs — no-op
  }
}

export function useStartTrial() {
  const { user } = useAuth();
  const { applyFreshProfile } = useUserProfile();

  const startTrial = useCallback(
    async (options: StartTrialOptions): Promise<StartTrialResult> => {
      const uid = user?.id;
      if (!uid) return { ok: false, error: new Error('No authenticated user') };

      const language = options.language;
      const schedulePushes = options.schedulePushes !== false;

      try {
        // ─── Preferred path: atomic Edge Function ─────────────────────────────
        const { data, error } = await supabase.functions.invoke('start-trial', {
          body: { language },
        });

        if (!error && data?.success && data?.profile) {
          applyFreshProfile(data.profile);
          broadcastTrialStarted();
          return { ok: true, source: 'edge' };
        }

        console.error('[useStartTrial] start-trial Edge Function failed, using legacy path:', error || data?.error);

        // ─── Legacy fallback: client-side upsert ──────────────────────────────
        const trialStartedAt = new Date().toISOString();
        const upsertPayload = {
          id: uid,
          email: user.email || '',
          free_access_start_at: trialStartedAt,
          trial_popup_shown: true,
        };

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(upsertPayload, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertError) {
          console.error('[useStartTrial] Profile upsert failed, trying update:', upsertError);
          await supabase
            .from('profiles')
            .update({
              free_access_start_at: trialStartedAt,
              trial_popup_shown: true,
            })
            .eq('id', uid);
        }

        // ─── Legacy push-reminder schedule (only when Edge Function didn't run) ─
        if (schedulePushes) {
          try {
            const now = new Date();
            for (const msg of LEGACY_PUSH_REMINDERS) {
              const sendAt = new Date(now.getTime() + msg.delayHours * 60 * 60 * 1000);
              supabase.functions
                .invoke('schedule-reminder-push', {
                  body: {
                    user_id: uid,
                    reminder_text: language === 'ar' ? msg.ar : msg.en,
                    scheduled_for: sendAt.toISOString(),
                  },
                })
                .catch(() => {
                  // Intentionally silent — push scheduling is best-effort.
                });
            }
          } catch {
            // Outer try/catch around scheduling loop — we never block trial start on push errors.
          }
        }

        broadcastTrialStarted();
        return { ok: true, source: 'legacy' };
      } catch (err) {
        console.error('[useStartTrial] Unexpected failure:', err);
        return { ok: false, error: err };
      }
    },
    [user?.id, user?.email, applyFreshProfile],
  );

  return { startTrial };
}
