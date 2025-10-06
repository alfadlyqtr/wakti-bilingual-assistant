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
    const r1 = (n: any) => (typeof n === 'number' && isFinite(n)) ? Math.round(n * 10) / 10 : (n != null ? Math.round(Number(n) * 10) / 10 : null);
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
    } catch {}

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

    const topic = detectTopic(question);

    const buildSystem = (lang: string, topic: string) => {
      const en = {
        base: `You are a fitness assistant. Always use the CONTEXT JSON first; only consult RAW JSON if a value is missing.\n\nGeneral rules:\n- Do not invent facts.\n- Round numbers: hours to 1 decimal, percentages to whole numbers, heart/HRV to integers; always include units (h, %, bpm, ms).\n- Ask at most one short clarifying question if a key value is missing.\n- No medical claims; provide practical, general guidance.\n- The 'Today' (and 'Tonight' if present) lines must be action recommendations, not restatements of metrics.`,
        sleep: `\n\nTopic: SLEEP\n- WHY must include: sleep duration_hours, disturbances, and bedtime/waketime when present.\n- If efficiency is high but duration is short, state that short sleep can still cause fatigue.\n- Format inside 'answer' (three lines in order):\n  WHY: ...\n  Today: ...\n  Tonight: ...`,
        recovery: `\n\nTopic: RECOVERY\n- Focus WHY on: recovery score, HRV (ms), RHR (bpm), skin_temp_c, spo2_pct.\n- Mention sleep only if short duration/disturbances clearly drive recovery.\n- Format inside 'answer' (three lines in order):\n  WHY: ...\n  Today: (give 1–2 concrete actions such as Zone 1–2 20–30m, hydration + electrolytes, 10m breathwork)\n  Tonight: (give a specific lights-out window using available bedtime/waketime)`,
        strain: `\n\nTopic: STRAIN\n- Focus WHY on: day_strain, avg_hr_bpm, and current recovery (score/HRV/RHR).\n- Do NOT mention sleep unless clearly causal to today’s strain.\n- When proposing actions, set a target strain range based on recovery score: ≤55% → aim 3–5; 56–74% → aim 5–7; ≥75% → aim 7–9, with an example session (e.g., 20–30m easy walk + mobility; 30–45m Zone 2; or 30–45m tempo/intervals).\n- Format inside 'answer' (two lines in order):\n  WHY: ...\n  Today: ...`,
        spo2: `\n\nTopic: SPO2\n- Focus WHY on: spo2_pct and respiratory_rate; reference recovery if relevant.\n- Do NOT default to sleep unless clearly causal.\n- Format inside 'answer' (two lines in order):\n  WHY: ...\n  Today: ...`,
        skin: `\n\nTopic: SKIN TEMPERATURE\n- Focus WHY on: skin_temp_c (trend if implied), recovery context if relevant.\n- Avoid sleep unless clearly causal.\n- Format inside 'answer' (two lines in order):\n  WHY: ...\n  Today: ...`,
        timing: `\n\nTopic: WORKOUT TIMING\n- Recommend the best training window today using: recovery score, sleep consistency (bedtime/waketime), and current day_strain.\n- Guidance: if recovery is low/moderate, prefer late morning or early evening in Zone 1–2; if high, morning or early evening is fine. Avoid intense sessions late at night (e.g., within 3 hours of bedtime).\n- If waketime is available, suggest a morning window ~2–4 hours after waketime; otherwise propose an early evening window (e.g., 5–7 PM local).\n- Format inside 'answer' (two lines in order):\n  WHY: ...\n  Today: Best window today is [HH:MM–HH:MM local] + brief session suggestion (Zone and duration).`,
        nutrition: `\n\nTopic: NUTRITION\n- Focus WHY on how fueling can support the current goal given recovery/strain.\n- Keep it concise and practical; use grams and ml with units.\n- Format inside 'answer' (two lines in order):\n  WHY: ...\n  Today: include 2–3 items like: Pre: 30–60g carbs + 300–500ml water with a pinch of salt; During (>45m): 20–30g carbs per 30m; Post: 20–30g protein + carbs within 60m; Evening: avoid heavy meals <2h before bed.`
      };
      const ar = {
        base: `أنت مساعد لياقة يستخدم أولاً CONTEXT JSON. لا تخمن. قرّب الأرقام (ساعات 1 عشرية، نسب دون فواصل، HR/HRV أعداد صحيحة مع وحدات). سؤال إيضاحي واحد كحد أقصى. لا ادعاءات طبية، قدّم إرشادات عملية.\n- أسطر Today/Tonight يجب أن تكون إجراءات عملية وليست إعادة ذكر للأرقام.`,
        sleep: `\n\nالموضوع: النوم\n- يجب أن تتضمن جملة السبب: مدة النوم، عدد الاضطرابات، وموعد النوم/الاستيقاظ إن وُجد.\n- إذا كانت الكفاءة مرتفعة والمدة قصيرة فاذكر أن قِصر النوم قد يسبب التعب.\n- صيغة 'answer' (3 أسطر بالترتيب):\n  WHY: ...\n  Today: ...\n  Tonight: ...`,
        recovery: `\n\nالموضوع: التعافي\n- ركّز السبب على: درجة التعافي، HRV، RHR، حرارة الجلد، SpO2.\n- اذكر النوم فقط إذا كان سببًا واضحًا.\n- صيغة 'answer' (3 أسطر):\n  WHY: ...\n  Today: (إجراءان مثل: مشي خفيف/زون 1–2 20–30 دقيقة، سوائل مع أملاح، 10 دقائق تنفس)\n  Tonight: (نافذة نوم مقترحة بناءً على وقت النوم/الاستيقاظ)`,
        strain: `\n\nالموضوع: الإجهاد\n- ركّز السبب على: إجهاد اليوم، متوسط HR، وحالة التعافي.\n- لا تذكر النوم إلا إذا كان سببًا واضحًا.\n- عند اقتراح الهدف، حدّد مدى الإجهاد حسب التعافي: ≤55% → 3–5، 56–74% → 5–7، ≥75% → 7–9 مع مثال جلسة (مشي خفيف + مرونة، أو زون 2، أو فترات).\n- صيغة 'answer' (سطران):\n  WHY: ...\n  Today: ...`,
        spo2: `\n\nالموضوع: تشبع الأكسجين\n- ركّز السبب على: SpO2 والوتيرة التنفسية؛ أضف التعافي إذا لزم.\n- لا تربط بالنوم إلا إذا كان سببًا واضحًا.\n- صيغة 'answer' (سطران):\n  WHY: ...\n  Today: ...`,
        skin: `\n\نالموضوع: حرارة الجلد\n- ركّز السبب على: حرارة الجلد وسياق التعافي إن لزم.\n- تجنب ذكر النوم ما لم يكن سببًا واضحًا.\n- صيغة 'answer' (سطران):\n  WHY: ...\n  Today: ...`,
        timing: `\n\nالموضوع: توقيت التمرين\n- اقترح أفضل نافذة تدريب اليوم باستخدام: التعافي، انتظام النوم (وقت النوم/الاستيقاظ)، وإجهاد اليوم الحالي.\n- إرشاد: إذا كان التعافي منخفض/متوسط فالأفضل صباح متأخر أو مساء مبكر (زون 1–2). إذا كان مرتفعًا فالصباح أو المساء مناسب. تجنب الشدة العالية متأخرًا ليلًا (ضمن 3 ساعات من النوم).\n- إن توفر وقت الاستيقاظ فاقترح نافذة صباحية بعده بـ 2–4 ساعات؛ وإلا نافذة مسائية مبكرة (مثل 5–7 م).\n- صيغة 'answer' (سطران):\n  WHY: ...\n  Today: أفضل نافذة اليوم [HH:MM–HH:MM] بالتوقيت المحلي + اقتراح جلسة مختصر (الزون والمدة).`,
        nutrition: `\n\nالموضوع: التغذية\n- اربط السبب بالهدف الحالي حسب التعافي/الإجهاد.\n- اجعل الإرشاد عمليًا مختصرًا مع وحدات (غرام/مل).\n- صيغة 'answer' (سطران):\n  WHY: ...\n  Today: 2–3 عناصر مثل: قبل التمرين 30–60غ كربوهيدرات + 300–500مل ماء مع رشة ملح؛ أثناء (>45 دقيقة) 20–30غ كربوهيدرات كل 30 دقيقة؛ بعده 20–30غ بروتين + كربوهيدرات خلال 60 دقيقة؛ مساءً تجنب وجبة ثقيلة قبل النوم بساعتين.`
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

    const system = buildSystem(language, topic);

    const userMsg = [
      language === 'ar'
        ? `\nالمنطقة الزمنية: ${userTimezone}\n\nالسؤال:\n${question}\n\nCONTEXT JSON (مهيكل لمطابقة البطاقات):\n`
        : `\nTime zone: ${userTimezone}\n\nQUESTION:\n${question}\n\nCONTEXT JSON (normalized to match the cards):\n`,
      JSON.stringify(ctx),
      '\n\nRAW JSON (full aggregate):\n',
      JSON.stringify(data)
    ].join('');

    // Helper to parse JSON content safely
    const parseJsonContent = (content: string | null | undefined) => {
      if (!content) return { answer: '' } as any;
      try { return JSON.parse(content); } catch { return { answer: content } as any; }
    };

    // Try DeepSeek first
    let finalOut: any | null = null;
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
        primaryError = e?.message || String(e);
        console.error('[whoop-ai-qa] deepseek_exception', primaryError);
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
        console.error('[whoop-ai-qa] openai_exception', e?.message || String(e));
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
