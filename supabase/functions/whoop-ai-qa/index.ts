import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
function normalizeContext(data: any) {
  try {
    const today = data?.today || {};
    const details = data?.details || {};
    const workout = data?.workouts?.[data?.workouts?.length - 1] || data?.details?.workout || null;
    const sleep = details?.sleep || data?.raw?.sleep_full || data?.today?.sleep || null;
    const recovery = details?.recovery || data?.raw?.recovery_full || data?.today?.recovery || null;
    const cycle = details?.cycle || data?.raw?.cycle_full || data?.today?.cycle || null;

    // Compute duration hours from start/end if not given
    const sleepDuration = (() => {
      const durSec = (today?.sleepHours ? Math.round(Number(today.sleepHours) * 3600) : undefined) ?? sleep?.duration_sec;
      if (typeof durSec === 'number') return Math.round(durSec / 360) / 10; // one decimal hours
      const st = sleep?.start, en = sleep?.end;
      if (st && en) {
        const mins = Math.round((new Date(en).getTime() - new Date(st).getTime()) / 60000);
        return Math.round(mins / 6) / 10; // one decimal
      }
      const stage = sleep?.data?.score?.stage_summary || {};
      const totalMilli = (stage.deep_sleep_milli ?? stage.deep_milli ?? 0) + (stage.rem_sleep_milli ?? stage.rem_milli ?? 0) + (stage.light_sleep_milli ?? stage.light_milli ?? 0);
      return totalMilli ? Math.round(totalMilli / 360000) / 10 : null;
    })();

    // Small helpers for rounded display values
    // deno-lint-ignore no-explicit-any
    const r1 = (n: any) => (typeof n === 'number' && isFinite(n)) ? Math.round(n * 10) / 10 : (n != null ? Math.round(Number(n) * 10) / 10 : null);
    // deno-lint-ignore no-explicit-any
    const r0 = (n: any) => (typeof n === 'number' && isFinite(n)) ? Math.round(n) : (n != null ? Math.round(Number(n)) : null);

    const norm = {
      sleep: {
        duration_hours: sleepDuration ?? null,
        performance_pct: today?.sleepPerformancePct ?? sleep?.performance_pct ?? sleep?.data?.score?.sleep_performance_percentage ?? null,
        efficiency_pct: today?.sleepEfficiencyPct ?? sleep?.data?.score?.sleep_efficiency_percentage ?? null,
        respiratory_rate: today?.respiratoryRate ?? sleep?.data?.score?.respiratory_rate ?? null,
        consistency_pct: today?.sleepConsistencyPct ?? sleep?.data?.score?.sleep_consistency_percentage ?? null,
        cycles: today?.sleepCycleCount ?? sleep?.data?.score?.stage_summary?.sleep_cycle_count ?? null,
        disturbances: today?.disturbanceCount ?? sleep?.data?.score?.stage_summary?.disturbance_count ?? null,
        bedtime: fmtTime(sleep?.start ?? null),
        waketime: fmtTime(sleep?.end ?? null),
        display: {
          duration_h: r1(sleepDuration),
          efficiency_pct: r0(today?.sleepEfficiencyPct ?? sleep?.data?.score?.sleep_efficiency_percentage),
          consistency_pct: r0(today?.sleepConsistencyPct ?? sleep?.data?.score?.sleep_consistency_percentage),
          disturbances: r0(today?.disturbanceCount ?? sleep?.data?.score?.stage_summary?.disturbance_count),
          bedtime: fmtTime(sleep?.start ?? null),
          waketime: fmtTime(sleep?.end ?? null)
        }
      },
      recovery: {
        score_pct: today?.recoveryPct ?? recovery?.score ?? recovery?.data?.score?.recovery_score ?? null,
        hrv_ms: today?.hrvMs ?? recovery?.hrv_ms ?? recovery?.data?.score?.hrv_rmssd_milli ?? null,
        rhr_bpm: today?.rhrBpm ?? recovery?.rhr_bpm ?? recovery?.data?.score?.resting_heart_rate ?? null,
        spo2_pct: recovery?.data?.score?.spo2_percentage ?? null,
        skin_temp_c: recovery?.data?.score?.skin_temp_celsius ?? null,
        display: {
          score_pct: r0(today?.recoveryPct ?? recovery?.score ?? recovery?.data?.score?.recovery_score),
          hrv_ms: r0(today?.hrvMs ?? recovery?.hrv_ms ?? recovery?.data?.score?.hrv_rmssd_milli),
          rhr_bpm: r0(today?.rhrBpm ?? recovery?.rhr_bpm ?? recovery?.data?.score?.resting_heart_rate),
          spo2_pct: r0(recovery?.data?.score?.spo2_percentage),
          skin_temp_c: r1(recovery?.data?.score?.skin_temp_celsius)
        }
      },
      strain: {
        day_strain: today?.dayStrain ?? cycle?.day_strain ?? cycle?.data?.score?.strain ?? null,
        avg_hr_bpm: cycle?.avg_hr_bpm ?? cycle?.data?.score?.average_heart_rate ?? null,
        energy_burned_cal: today?.kilojoule ? Math.round((today.kilojoule || 0) / 4.184) : cycle?.data?.score?.kilojoule ? Math.round((cycle.data.score.kilojoule || 0) / 4.184) : null,
        display: {
          day_strain: r1(today?.dayStrain ?? cycle?.day_strain ?? cycle?.data?.score?.strain),
          avg_hr_bpm: r0(cycle?.avg_hr_bpm ?? cycle?.data?.score?.average_heart_rate)
        }
      },
      workout: workout ? {
        sport: workout?.sport || workout?.sport_name || null,
        start: fmtTime(workout?.start ?? null),
        end: fmtTime(workout?.end ?? null),
        duration_min: workout?.start && workout?.end ? Math.round((new Date(workout.end).getTime() - new Date(workout.start).getTime()) / 60000) : null,
        strain: workout?.strain ?? workout?.data?.score?.strain ?? null,
        avg_hr_bpm: workout?.avg_hr_bpm ?? workout?.data?.score?.average_heart_rate ?? null,
        max_hr_bpm: workout?.max_hr_bpm ?? workout?.data?.score?.max_heart_rate ?? null,
        calories: workout?.kcal ?? (workout?.data?.score?.kilojoule ? Math.round(workout.data.score.kilojoule / 4.184) : null),
        distance_km: workout?.data?.score?.distance_meter ? +(workout.data.score.distance_meter / 1000).toFixed(2) : null
      } : null,
      user: {
        first_name: data?.user?.first_name || data?.user?.profile?.first_name || null,
        height_meter: data?.user?.height_meter || data?.user?.body?.height_meter || null,
        weight_kilogram: data?.user?.weight_kilogram || data?.user?.body?.weight_kilogram || null,
        max_heart_rate: data?.user?.max_heart_rate || data?.user?.body?.max_heart_rate || null
      }
    };
    return norm;
  } catch (_e) {
    return {};
  }
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_openai_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const language = body?.language === 'ar' ? 'ar' : 'en';
    const question = (body?.question || "").toString();
    const userTimezone = body?.user_timezone || 'UTC';
    const data = body?.data || {};
    const providedContext = body?.context || null;
    const ctx = providedContext || normalizeContext(data);

    if (!question || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "missing_question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const buildSystem = (lang: string) => {
      const now = new Date();
      const localTime = now.toLocaleTimeString('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: true });
      const localDate = now.toLocaleDateString('en-US', { timeZone: userTimezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const en = `You are the ELITE WAKTI PERFORMANCE COACH. You are obsessed with human optimization and using WHOOP data to dominate the day. You are NOT a generic assistant; you are an aggressive, predictive, and authoritative strategist.

Your goal: Use the user's REAL data to give them a tactical edge.

CURRENT LOCAL CONTEXT:
- Local Time: ${localTime}
- Local Date: ${localDate}
- User Timezone: ${userTimezone}

COACHING RULES:
1. NO HEDGING: Never say "maybe," "likely," or "it seems." Be decisive.
2. NO LABELS: Do not use headers like "Answer:" or "Why:". Just speak.
3. DATA OBSESSED: If they ask about recovery, cite their HRV (${ctx?.recovery?.display?.hrv_ms}ms) and RHR (${ctx?.recovery?.display?.rhr_bpm}bpm) as proof of your advice.
4. PREDICTIVE: Don't just answer the past. Tell them how this affects their NEXT 12 hours.
5. NO FLUFF: Keep it under 4 sentences. Brutally efficient.

RESPONSE STRUCTURE (Strict JSON):
{"answer": "Your elite coaching response", "clarifying_question": "A tactical follow-up to sharpen the plan"}

CURRENT USER STATE:
- Recovery: ${ctx?.recovery?.display?.score_pct}%
- HRV: ${ctx?.recovery?.display?.hrv_ms}ms
- Strain: ${ctx?.strain?.display?.day_strain}
- Sleep: ${ctx?.sleep?.display?.duration_h}h (${ctx?.sleep?.performance_pct}% perf)
- Activity: ${ctx?.workout?.sport ? `Last workout was ${ctx?.workout?.sport} at ${ctx?.workout?.strain} strain` : 'No recent workout'}`;

      const ar = `أنت مدرب الأداء البشري النخبة في WAKTI. أنت مهووس بتحسين الأداء واستخدام بيانات WHOOP للسيطرة على اليوم. أنت لست مساعداً عادياً؛ أنت استراتيجي حازم، استباقي، وموثوق.

الوقت والتاريخ الحالي (بتوقيت المستخدم):
- الوقت المحلي: ${localTime}
- التاريخ المحلي: ${localDate}

قواعد التدريب:
1. لا تردد: لا تقل "ربما" أو "يبدو". كن حاسماً.
2. لا تسميات: لا تستخدم رؤوس أقلام مثل "الإجابة:". تحدث مباشرة.
3. مهووس بالبيانات: استشهد دائماً بالأرقام الحقيقية (HRV: ${ctx?.recovery?.display?.hrv_ms}ms، RHR: ${ctx?.recovery?.display?.rhr_bpm}bpm).
4. استباقي: توقع تأثير هذه البيانات على الـ 12 ساعة القادمة.
5. لا حشو: اجعل الإجابة أقل من 4 جمل. كفاءة وحزم.

صيغة الإخراج (JSON صارم):
{"answer": "إجابة المدرب النخبة", "clarifying_question": "سؤال تكتيكي لتعزيز الخطة"}

حالة المستخدم الحالية:
- التعافي: ${ctx?.recovery?.display?.score_pct}%
- HRV: ${ctx?.recovery?.display?.hrv_ms}ms
- الإجهاد: ${ctx?.strain?.display?.day_strain}
- النوم: ${ctx?.sleep?.display?.duration_h}h`;

      return lang === 'ar' ? ar : en;
    };

    const system = buildSystem(language);

    const userMsg = `QUESTION: ${question}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[whoop-ai-qa] openai_error', resp.status, errText);
      return new Response(JSON.stringify({ error: "openai_failed", status: resp.status }), { status: 500, headers: corsHeaders });
    }

    const json = await resp.json();
    const finalOut = JSON.parse(json?.choices?.[0]?.message?.content || "{}");

    // Log success
    await logAIFromRequest(req, {
      functionName: "whoop-ai-qa",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: question,
      outputText: finalOut.answer,
      status: "success"
    });

    return new Response(JSON.stringify(finalOut), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error('[whoop-ai-qa] error', e);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "whoop-ai-qa",
      provider: "deepseek",
      model: "deepseek-chat",
      status: "error",
      errorMessage: (e as Error).message
    });

    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
