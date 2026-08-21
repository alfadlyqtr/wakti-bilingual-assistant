/**
 * Monthly quota for credit-spending music extras (posters, MP4 renders, voice clones).
 * Mirrors the generation-quota pattern: checked BEFORE calling the provider,
 * logged the moment the provider accepts the job.
 */

// deno-lint-ignore no-explicit-any
type SupabaseService = any;

export const MUSIC_EXTRA_LIMITS: Record<string, number> = {
  poster: 10, // lyric-video posters per month
  mp4: 10,    // track-to-video renders per month
  voice: 3,   // custom singing-voice clones per month
};

export interface ExtraQuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkMusicExtraQuota(
  supabaseService: SupabaseService,
  userId: string,
  feature: keyof typeof MUSIC_EXTRA_LIMITS,
): Promise<ExtraQuotaStatus> {
  const limit = MUSIC_EXTRA_LIMITS[feature] ?? 10;
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabaseService
      .from("user_music_extra_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", monthStart.toISOString());
    if (error) {
      console.error(`[music-extra-quota] check failed for ${feature} (fail-open):`, error.message);
      return { allowed: true, used: 0, limit };
    }
    const used = count ?? 0;
    return { allowed: used < limit, used, limit };
  } catch (err) {
    console.error(`[music-extra-quota] exception for ${feature} (fail-open):`, (err as Error).message);
    return { allowed: true, used: 0, limit };
  }
}

export async function logMusicExtra(
  supabaseService: SupabaseService,
  userId: string,
  feature: keyof typeof MUSIC_EXTRA_LIMITS,
  refId?: string | null,
): Promise<void> {
  try {
    const { error } = await supabaseService
      .from("user_music_extra_log")
      .insert({ user_id: userId, feature, ref_id: refId ?? null });
    if (error) console.error(`[music-extra-quota] log failed for ${feature}:`, error.message);
  } catch (err) {
    console.error(`[music-extra-quota] log exception for ${feature}:`, (err as Error).message);
  }
}

const FEATURE_LABELS: Record<string, string> = {
  poster: "music posters",
  mp4: "video renders",
  voice: "custom voices",
};

export function extraLimitResponse(
  feature: keyof typeof MUSIC_EXTRA_LIMITS,
  used: number,
  limit: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: `Monthly limit reached: ${used} of ${limit} ${FEATURE_LABELS[feature] ?? feature} this month`,
      code: "EXTRA_LIMIT_REACHED",
      feature,
      used,
      limit,
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
