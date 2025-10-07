import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!DEEPSEEK_API_KEY && !OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_llm_keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));

    // Debug logs to verify payload
    try {
      console.log('[whoop-ai-qa] body.keys:', Object.keys(body || {}));
      console.log('[whoop-ai-qa] has.data:', !!body?.data, 'has.context:', !!body?.context);
      if (body?.data?.today) console.log('[whoop-ai-qa] today.keys:', Object.keys(body.data.today));
    } catch { /* noop debug */ }

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

    // Topic routing based on the question
    const detectTopic = (q: string): 'sleep' | 'recovery' | 'strain' | 'spo2' | 'skin_temp' | 'nutrition' | 'timing' | 'general' => {
      const t = q.toLowerCase();
      if (/(sleep|tired|fatigue|insomnia|nap|wake|bedtime|اضطراب|نوم|تعب)/i.test(t)) return 'sleep';
      if (/(recovery|hrv|rhr|تعاف|راحة)/i.test(t)) return 'recovery';
      if (/(strain|workout|training|load|جهد|تمرين|رياضة)/i.test(t)) return 'strain';
      if (/(spo2|oxygen|blood oxygen|تشبع|اوكسجين)/i.test(t)) return 'spo2';
      if (/(skin temp|temperature|fever|حرارة|جلد)/i.test(t)) return 'skin_temp';
      if (/(eat|food|diet|nutrition|fuel|carb|protein|hydration|electrolyte|sodium|ملح|سوائل|تغذية|كربوهيدرات|بروتين)/i.test(t)) return 'nutrition';
      if (/(best\s*time|what\s*time|when\s*(should|to)\s*(work\s*out|workout|train|exercise)|أفضل\s*وقت|متى\s*(أتمرن|أتدرب))/i.test(t)) return 'timing';
      return 'general';
    };

    // Detect explain intent when user asks to describe/explain/why/meaning
    const detectIntent = (q: string): 'explain' | 'qa' => {
      const t = q.toLowerCase();
      if (/(describe|explain|why|meaning|break\s*down|interpret|فسر|اشرح|لماذا)/i.test(t)) return 'explain';
      return 'qa';
    };

    const topic = detectTopic(question);
    const intent = detectIntent(question);

    const buildSystem = (lang: string, topic: string, intent: 'explain' | 'qa') => {
      const en = {
        base: `You are a fitness assistant. Always use CONTEXT first; only consult RAW if something is missing.\nCurrent intent: ${intent}.\n\nOutput contract:\n- Return strict JSON: {"answer": string, "clarifying_question"?: string}.\n- If intent=explain: answer as 3–5 short bullet points, each on a new line starting with '- '. Keep it decisive and specific with 2–3 key metrics.\n- If intent=qa: answer first in 1–3 natural sentences. Be decisive. No labels. Cite up to 2–3 key metrics with units (h, %, bpm, ms).\n- Optional follow-up only if it would change the plan (e.g., Timing → ask preferred modality run/ride/gym; Skin temp → ask if fever/ill; Sleep → offer wind-down checklist). Otherwise omit it.\n- Use sensible defaults from today when history is missing; do not defer with "need baseline".\n- Avoid hedging words like "maybe/likely" unless safety requires.\n- No medical claims; keep guidance practical.`,
        sleep: `\n\nTopic: SLEEP\n- When relevant, briefly explain the driver (duration, disturbances, bedtime/waketime) but do not write labels.\n- Keep it conversational and specific to the question (e.g., fatigue vs. timing vs. naps).`,
        recovery: `\n\nTopic: RECOVERY\n- Emphasize recovery score, HRV (ms), RHR (bpm), and optionally skin temp/SpO2 if relevant.\n- Mention sleep only when it's clearly driving recovery.\n- Provide 1–2 precise actions when appropriate (e.g., Zone 1–2 20–30m, hydration + electrolytes, 10m breathwork).`,
        strain: `\n\nTopic: STRAIN\n- Focus on day_strain, avg_hr_bpm, and current recovery.\n- Set a target strain range based on recovery: ≤55% → aim 3–5; 56–74% → aim 5–7; ≥75% → aim 7–9, with a compact example session.\n- Do not mention sleep unless it's clearly causal.`,
        spo2: `\n\nTopic: SPO2\n- Focus on spo2_pct and respiratory_rate; reference recovery if relevant.\n- Keep the answer to two natural sentences max.`,
        skin: `\n\nTopic: SKIN TEMPERATURE\n- Focus on skin_temp_c (trend if implied) and recovery context if relevant.\n- Avoid unrelated sleep advice.`,
        timing: `\n\nTopic: WORKOUT TIMING\n- Recommend the best window today based on recovery, sleep timing (bed/wake), and current strain.\n- Prefer CONTEXT.timing.primary_window when present; optionally mention CONTEXT.timing.alt_window as backup.\n- Write as a single, natural sentence with a concrete local time range and a short session suggestion.`,
        nutrition: `\n\nTopic: NUTRITION\n- Tie fueling to today's goal given recovery/strain.\n- Use grams/ml and timing in 1–2 sentences (e.g., Pre 30–60g carbs + 300–500 ml water + pinch salt; During >45m: 20–30g carbs/30m; Post 20–30g protein + carbs within 60m).`
      };
      const ar = {
        base: `أنت مساعد لياقة. استخدم CONTEXT أولاً ثم RAW عند الحاجة.\n\nصيغة الإخراج:\n- JSON صارم: {"answer": string, "clarifying_question"?: string}.\n- إذا كانت النية=شرح: أجب بـ 3–5 نقاط قصيرة كل سطر يبدأ بـ '- ' مع 2–3 قيَم أساسية.\n- إذا كانت النية=سؤال: أجب أولاً بجمل 1–3 طبيعية وبحسم، دون تسميات، واذكر 2–3 قيماً أساسية مع الوحدات.\n- سؤال متابعة اختياري فقط إذا سيغيّر الخطة (التوقيت: تفضيل الجري/الدراجة/الجيم؛ حرارة الجلد: هل شعرت بحمى/مرض؛ النوم: عرض قائمة استرخاء). غير ذلك لا ترسله.\n- استخدم قيم اليوم كافتراضات معقولة؛ لا تقل "أحتاج خط أساس".\n- تجنب ألفاظ التردد مثل "قد/ربما" إلا لسلامة المستخدم.\n- بدون ادعاءات طبية؛ اجعل الإرشاد عمليًا.`,
        sleep: `\n\nالموضوع: النوم\n- اشرح السبب باختصار (المدة، الاضطرابات، وقت النوم/الاستيقاظ) إن كان ذا صلة، دون كتابة تسميات.`,
        recovery: `\n\nالموضوع: التعافي\n- ركّز على درجة التعافي وHRV وRHR، وأضف حرارة الجلد/SpO2 عند الحاجة. أعطِ إجراءين عمليين عند اللزوم دون تسميات.`,
        strain: `\n\nالموضوع: الإجهاد\n- اربط الهدف بمستوى التعافي: ≤55% → 3–5، 56–74% → 5–7، ≥75% → 7–9 مع مثال جلسة مختصر، دون ذكر تسميات.`,
        spo2: `\n\nالموضوع: تشبع الأكسجين\n- ركّز على SpO2 والوتيرة التنفسية بجملتين كحد أقصى.`,
        skin: `\n\nالموضوع: حرارة الجلد\n- ركّز على حرارة الجلد والسياق المناسب دون إقحام غير ذي صلة.`,
        timing: `\n\nالموضوع: توقيت التمرين\n- اقترح نافذة واضحة بالتوقيت المحلي بناءً على التعافي ووقت الاستيقاظ/النوم وإجهاد اليوم. استخدم CONTEXT.timing.primary_window عند توفره، واذكر بديل CONTEXT.timing.alt_window عند الحاجة. اكتب جملة واحدة واضحة مع وصف جلسة مختصر.`,
        nutrition: `\n\nالموضوع: التغذية\n- اربط الوقود بالهدف اليومي مع كميات ووحدات مختصرة في جملة أو جملتين.`
      };

      if (lang === 'ar') {
        const base = ar.base;
        if (topic === 'sleep') return base + ar.sleep;
        if (topic === 'recovery') return base + ar.recovery;
        if (topic === 'strain') return base + ar.strain;
        if (topic === 'spo2') return base + ar.spo2;
        if (topic === 'skin_temp') return base + ar.skin;
        return base + ar.recovery; // default to recovery-style if general
      } else {
        const base = en.base;
        if (topic === 'sleep') return base + en.sleep;
        if (topic === 'recovery') return base + en.recovery;
        if (topic === 'strain') return base + en.strain;
        if (topic === 'spo2') return base + en.spo2;
        if (topic === 'skin_temp') return base + en.skin;
        if (topic === 'timing') return base + en.timing;
        if (topic === 'nutrition') return base + en.nutrition;
        return base + en.recovery; // default to recovery-style if general
      }
    };

    // Deterministic timing windows (waketime+2–4h, fallback 5–7 PM local)
    const toLocalHM = (d: Date, tz: string) => {
      try {
        return d.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
      } catch {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    };
    const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600000);
    // If we have waketime ISO, compute morning window; always include a fallback evening window.
    try {
      const wakeIso = ctx?.sleep?.raw_waketime_iso as string | null;
      const recPct = ctx?.recovery?.display?.score_pct || ctx?.recovery?.score_pct || null;
      const morningWindow = wakeIso ? `${toLocalHM(addHours(new Date(wakeIso), 2), userTimezone)}–${toLocalHM(addHours(new Date(wakeIso), 4), userTimezone)}` : null;
      const today = new Date();
      const eveStart = new Date(today); eveStart.setHours(17, 0, 0, 0);
      const eveEnd = new Date(today); eveEnd.setHours(19, 0, 0, 0);
      const eveningWindow = `${toLocalHM(eveStart, userTimezone)}–${toLocalHM(eveEnd, userTimezone)}`;
      const primary = morningWindow ? morningWindow : eveningWindow;
      ctx.timing = {
        primary_window: primary,
        alt_window: morningWindow ? eveningWindow : null,
        basis: { recovery_pct: recPct }
      };
    } catch {}

    const system = buildSystem(language, topic, intent);

    const userMsg = [
      language === 'ar'
        ? `\nالمنطقة الزمنية: ${userTimezone}\n\nالسؤال:\n${question}\n\nCONTEXT JSON (مهيكل لمطابقة البطاقات):\n`
        : `\nTime zone: ${userTimezone}\n\nQUESTION:\n${question}\n\nCONTEXT JSON (normalized to match the cards):\n`,
      JSON.stringify(ctx),
      '\n\nRAW JSON (full aggregate):\n',
      JSON.stringify(data)
    ].join('');

    // Helper to parse JSON content safely
    // deno-lint-ignore no-explicit-any
    const parseJsonContent = (content: string | null | undefined) => {
      // deno-lint-ignore no-explicit-any
      if (!content) return { answer: '' } as any;
      try { return JSON.parse(content); } catch { return { answer: content } as any; }
    };

    // Try DeepSeek first
    // deno-lint-ignore no-explicit-any
    let finalOut: any | null = null;
    // deno-lint-ignore no-explicit-any
    let primaryError: any | null = null;

    if (DEEPSEEK_API_KEY) {
      try {
        const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.5,
            top_p: 0.9,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userMsg }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (resp.ok) {
          const json = await resp.json();
          const content = json?.choices?.[0]?.message?.content || "{}";
          finalOut = parseJsonContent(content);
        } else {
          primaryError = await resp.text();
          console.error('[whoop-ai-qa] deepseek_error', resp.status, primaryError);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        primaryError = msg;
        console.error('[whoop-ai-qa] deepseek_exception', msg);
      }
    }

    // Fallback to OpenAI GPT-4o-mini if needed
    if (!finalOut && OPENAI_API_KEY) {
      try {
        const resp2 = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.5,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userMsg }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (resp2.ok) {
          const json2 = await resp2.json();
          const content2 = json2?.choices?.[0]?.message?.content || "{}";
          finalOut = parseJsonContent(content2);
          console.log('whoop-ai-qa: OpenAI fallback successful');
        } else {
          const errText = await resp2.text();
          console.error('[whoop-ai-qa] openai_error', resp2.status, errText);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[whoop-ai-qa] openai_exception', msg);
      }
    }

    // Post-process: coerce to natural label-less answer
    // deno-lint-ignore no-explicit-any
    const coerceAnswer = (val: any): string => {
      try {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
          // deno-lint-ignore no-explicit-any
          const obj = val as Record<string, any>;
          const parts: string[] = [];
          if (obj.WHY) parts.push(String(obj.WHY));
          if (obj.Today) parts.push(String(obj.Today));
          if (obj.Tonight) parts.push(String(obj.Tonight));
          if (parts.length) return parts.join(' ');
          if (obj.answer) return coerceAnswer(obj.answer);
          return '';
        }
        return String(val);
      } catch { return ''; }
    };
    const stripLabels = (s: string) => {
      return s
        .replace(/\bWHY\s*:\s*/gi, '')
        .replace(/\bToday\s*:\s*/gi, '')
        .replace(/\bTonight\s*:\s*/gi, '')
        // preserve newlines for bullets; collapse excessive spaces only
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    };

    if (finalOut && typeof finalOut === 'object') {
      const coerced = coerceAnswer(finalOut.answer);
      finalOut.answer = stripLabels(coerced);
      // Enrich/sanitize follow-up: only keep targeted follow-ups; synthesize if helpful
      const topicFollowUps = {
        en: {
          timing: 'Do you want this tailored for a run, ride, or gym?',
          skin_temp: 'Have you felt feverish or ill today?',
          sleep: 'Want a quick wind-down checklist for tonight?'
        },
        ar: {
          timing: 'هل تفضّل أن أخصصها للجري أم الدراجة أم الجيم؟',
          skin_temp: 'هل شعرت بحمى أو مرض اليوم؟',
          sleep: 'هل تريد قائمة استرخاء سريعة لليلة؟'
        }
      } as const;
      const langKey = language === 'ar' ? 'ar' : 'en';
      const allowed = topic === 'timing' || topic === 'skin_temp' || topic === 'sleep';
      const genericish = (q: unknown) => typeof q === 'string' && /(baseline|typical|history|usual)/i.test(q);
      if (allowed) {
        if (!finalOut.clarifying_question || genericish(finalOut.clarifying_question)) {
          // deno-lint-ignore no-explicit-any
          (finalOut as any).clarifying_question = topicFollowUps[langKey][topic as 'timing'|'skin_temp'|'sleep'];
        }
      } else {
        // remove low-value generic follow-ups
        if (genericish(finalOut.clarifying_question)) {
          // deno-lint-ignore no-explicit-any
          delete (finalOut as any).clarifying_question;
        }
      }
    }

    if (!finalOut) {
      return new Response(JSON.stringify({ error: 'llm_failed', primaryError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!finalOut.answer) finalOut.answer = '';

    return new Response(JSON.stringify(finalOut), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error('[whoop-ai-qa] error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
