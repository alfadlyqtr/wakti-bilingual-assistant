import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_openai_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.ping) {
      return new Response(JSON.stringify({ ok: true, service: "whoop-ai-insights" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    // CRITICAL DEBUG: Log EVERYTHING received
    console.log('========================================');
    console.log('EDGE FUNCTION RECEIVED BODY');
    console.log('========================================');
    console.log('body keys:', Object.keys(body));
    console.log('body.data type:', typeof body?.data);
    console.log('body.data:', JSON.stringify(body?.data));
    console.log('========================================');
    
    const payload = body?.data ?? {};
    const language = body?.language ?? "en";
    const timeOfDay = body?.time_of_day ?? "general";
    const userTimezone = body?.user_timezone ?? "UTC";
    const userEmail = body?.user_email ?? null;

    // Extract real WHOOP metrics from the comprehensive data for prompt injection
    const sleepData = payload?.details?.sleep || payload?.raw?.sleep_full;
    const recoveryData = payload?.details?.recovery || payload?.raw?.recovery_full;
    const cycleData = payload?.details?.cycle || payload?.raw?.cycle_full;

    let sleepHours: number | string = 0;
    if (sleepData?.start && sleepData?.end) {
      const startTime = new Date(sleepData.start).getTime();
      const endTime = new Date(sleepData.end).getTime();
      sleepHours = ((endTime - startTime) / (1000 * 60 * 60)).toFixed(1);
    } else if (sleepData?.duration_sec) {
      sleepHours = (sleepData.duration_sec / 3600).toFixed(1);
    } else {
      sleepHours = payload?.today?.sleepHours || 0;
    }
    const recoveryScore = recoveryData?.data?.score?.recovery_score || payload?.today?.recoveryPct || payload?.today?.recoveryScore || 0;
    const hrvMs = recoveryData?.data?.score?.hrv_rmssd_milli || payload?.today?.hrvMs || 0;
    const strainScore = cycleData?.data?.score?.strain || payload?.today?.dayStrain || payload?.today?.strainScore || 0;
    const restingHR = recoveryData?.data?.score?.resting_heart_rate || payload?.today?.rhrBpm || payload?.today?.restingHR || 0;

    // Enhanced system prompt with time-specific coaching and DATA INJECTION
    const getSystemPrompt = (timeOfDay: string, language: string) => {
      const now = new Date();
      const localTime = now.toLocaleTimeString('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: true });
      const localDate = now.toLocaleDateString('en-US', { timeZone: userTimezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const morningPrompt = language === 'ar' 
        ? `أنت طبيب متميز ومدرب أداء بشري متقدم يهتم بـ {USER_NAME}.

الوقت الحالي: ${localTime}
التاريخ: ${localDate}

🌅 الصباح (5:00 صباحًا - 11:00 صباحًا) - التركيز: النوم + التعافي + هندسة اليوم:

يجب عليك أن تكون ذكيًا جدًا:
- حلل النوم بعمق: قارن وقت النوم الفعلي بالمثالي.
- اذكر الأرقام الحقيقية فوراً كدليل: (HRV: ${hrvMs}ms، RHR: ${restingHR}bpm، النوم: ${sleepHours}h).
- اربط التعافي باليوم: إذا كان التعافي منخفضًا، كن "واقيًا". إذا كان عاليًا، ادفعهم للأداء العالي.
- توقع متى سيشعرون بـ "خمول منتصف النهار" بناءً على جودة نومهم.
- أقصى 25 سطرًا.

النبرة: حازمة، خبيرة، وملهمة.`
        : `You are an elite Doctor and Human Performance Coach speaking directly to {USER_NAME}.

CURRENT LOCAL CONTEXT:
- Local Time: ${localTime}
- Local Date: ${localDate}

🌅 MORNING (5:00 AM - 11:00 AM) - Focus: Sleep Architecture + Recovery + Day Engineering:

You MUST be exceptionally smart:
- ALWAYS START by mentioning the current time: "It's ${localTime} on ${localDate}."
- Deep Sleep Analysis: Compare bedtime/wake time. If they woke up too early, explain the hit to their REM or Deep sleep stages.
- DATA OBSESSED: Use metrics as proof: (HRV: ${hrvMs}ms, RHR: ${restingHR}bpm, Sleep: ${sleepHours}h).
- Recovery Integration: If Recovery is low (<50% at ${recoveryScore}%), be "Protective". If high (>80%), give "The Green Light".
- Be Predictive: Predict their energy dip based on today's sleep efficiency.
- Maximum 25 lines.

Tone: Expert, authoritative, and highly motivating.`;

      const middayPrompt = language === 'ar'
        ? `أنت مدرب أداء بشري (Human Performance Coach) يتحقق من {USER_NAME} في ذروة اليوم.

الوقت الحالي: ${localTime}
التاريخ: ${localDate}

☀️ منتصف النهار (12:00 ظهرًا - 5:00 مساءً) - التركيز: إدارة الإجهاد (Strain) + تحسين الأداء:

يجب عليك أن تكون تكتيكيًا جدًا ومباشرًا:
- تحليل الإجهاد: قيم الإجهاد الحالي (Strain: ${strainScore}) مقابل التعافي (Recovery: ${recoveryScore}%). هل هم في المنطقة المثالية؟
- نصيحة فورية: إذا كان الإجهاد منخفضًا والتعافي عاليًا، اطلب منهم رفع الكثافة الآن. إذا كان العكس، اطلب الهدوء.
- إدارة الطاقة: اذكر نوم الفجر (${sleepHours}h) كسبب لمستوى طاقة الظهر الحالي.
- أقصى 20 سطرًا.

النبرة: حازمة، عملية، تركز على "ماذا نفعل الآن".`
        : `You are an elite Human Performance Coach checking in on {USER_NAME} at the peak of their day.

CURRENT LOCAL CONTEXT:
- Local Time: ${localTime}
- Local Date: ${localDate}

☀️ MIDDAY (12:00 PM - 5:00 PM) - Focus: Real-time Strain Management + Afternoon Execution:

You MUST be tactical and blunt:
- ALWAYS START by mentioning the current time: "It's ${localTime} — let's check your status."
- Strain vs. Target: Evaluate current Strain (${strainScore}) against today's Recovery (${recoveryScore}%). Tell them exactly if they are "under-training" or "over-reaching" RIGHT NOW.
- Immediate Action: Give a specific instruction for the next 4 hours. No generic advice.
- Energy Source: Connect their current focus level back to that ${sleepHours}h sleep from last night.
- DATA ONLY: Use (Strain: ${strainScore}, Recovery: ${recoveryScore}%, HRV: ${hrvMs}ms).
- Maximum 20 lines.

Tone: Action-oriented, energetic, and focused on "Winning the Afternoon".`;

      const eveningPrompt = language === 'ar'
        ? `أنت طبيب ومدرب أداء بشري يهيئ {USER_NAME} لليوم التالي.

الوقت الحالي: ${localTime}
التاريخ: ${localDate}

🌙 المساء (5:00 مساءً - 11:00 مساءً) - التركيز: التهدئة + مراجعة الإنجاز + هندسة النوم:

يجب عليك أن تكون ذكيًا جدًا:
- مراجعة اليوم: لخص كيف أثر إجهاد اليوم (Strain: ${strainScore}) على حالتهم.
- التنبؤ بالتعافي: توقع درجة تعافي الغد. "إذا نمت الآن، نتوقع +80% بناءً على HRV: ${hrvMs}ms".
- بروتوكول التهدئة: اذكر وقتًا محددًا للنوم. اطلب إطفاء الشاشات فورًا.
- أقصى 25 سطرًا.

النبرة: هادئة، رصينة، استباقية، ومهتمة بجودة الغد.`
        : `You are an elite Doctor and Performance Coach preparing {USER_NAME} for tomorrow's victory.

CURRENT LOCAL CONTEXT:
- Local Time: ${localTime}
- Local Date: ${localDate}

🌙 EVENING (5:00 PM - 11:00 PM) - Focus: Wind-Down + Day Review + Sleep Engineering:

You MUST be exceptionally smart:
- ALWAYS START by mentioning the current time: "It's ${localTime} — time to wind down."
- Full Day Post-Mortem: Summarize how today's Strain (${strainScore}) impacted their current state.
- Recovery Prediction: Predict tomorrow's Recovery. "If you hit the pillow by 10 PM, we're looking at a 85% Recovery based on your current ${hrvMs}ms HRV."
- Bedtime Protocol: Give a specific bedtime. Demand a "screens off" policy now.
- Maximum 25 lines.

Tone: Calm, deliberate, predictive, and obsessed with tomorrow's quality.`;

      if (timeOfDay === 'morning') return morningPrompt;
      if (timeOfDay === 'midday') return middayPrompt;
      if (timeOfDay === 'evening') return eveningPrompt;
      return morningPrompt;
    };

    // Get user name and replace {USER_NAME} placeholder in system prompt
    const userName = payload?.user?.first_name || 
                    payload?.user?.profile?.first_name ||
                    payload?.details?.profile?.first_name ||
                    payload?.raw?.profile?.first_name ||
                    (userEmail ? userEmail.split('@')[0].split('.')[0] : null) ||
                    'friend';
    
    console.log('Selected timeOfDay:', timeOfDay, 'language:', language);
    const systemPrompt = getSystemPrompt(timeOfDay, language);
    const system = systemPrompt.replace(/{USER_NAME}/g, userName);

    const getEnhancedUserPrompt = (timeOfDay: string, language: string): string => {
      // Get real user name from WHOOP profile data or user email
      const userName = payload?.user?.first_name || 
                      payload?.user?.profile?.first_name ||
                      payload?.details?.profile?.first_name ||
                      payload?.raw?.profile?.first_name ||
                      // Extract first name from email (alfadlyqatar@gmail.com -> alfadly)
                      (userEmail ? userEmail.split('@')[0].split('.')[0] : null) ||
                      "Abdullah";
      
      // Get user body measurements
      const heightMeter = payload?.user?.height_meter || payload?.user?.body?.height_meter || null;
      const weightKg = payload?.user?.weight_kilogram || payload?.user?.body?.weight_kilogram || null;
      const maxHR = payload?.user?.max_heart_rate || payload?.user?.body?.max_heart_rate || null;
      
      // Extract real WHOOP metrics from the comprehensive data
      const sleepData = payload?.details?.sleep || payload?.raw?.sleep_full;
      const recoveryData = payload?.details?.recovery || payload?.raw?.recovery_full;
      const cycleData = payload?.details?.cycle || payload?.raw?.cycle_full;
      
      // Calculate sleep hours EXACTLY like WhoopDetails.tsx does
      let sleepHours: number | string = 0;
      if (sleepData?.start && sleepData?.end) {
        const startTime = new Date(sleepData.start).getTime();
        const endTime = new Date(sleepData.end).getTime();
        sleepHours = ((endTime - startTime) / (1000 * 60 * 60)).toFixed(1); // Convert to hours
      } else if (sleepData?.duration_sec) {
        sleepHours = (sleepData.duration_sec / 3600).toFixed(1);
      } else {
        sleepHours = payload?.today?.sleepHours || 0;
      }
      const recoveryScore = recoveryData?.data?.score?.recovery_score || 
                           payload?.today?.recoveryPct || 
                           payload?.today?.recoveryScore || 0;
      const hrvMs = recoveryData?.data?.score?.hrv_rmssd_milli || 
                   payload?.today?.hrvMs || 0;
      const strainScore = cycleData?.data?.score?.strain || 
                         payload?.today?.dayStrain ||
                         payload?.today?.strainScore || 0;
      const sleepPerf = sleepData?.data?.score?.sleep_performance_percentage || 
                       payload?.today?.sleepPerformancePct ||
                       payload?.today?.sleepPerformance || 0;
      const restingHR = recoveryData?.data?.score?.resting_heart_rate || 
                       payload?.today?.rhrBpm ||
                       payload?.today?.restingHR || 0;
      
      // DEBUG: Log what we're actually extracting
      console.log('=== AI DATA EXTRACTION DEBUG ===');
      console.log('User Name:', userName);
      console.log('User Email:', userEmail);
      console.log('Height (m):', heightMeter);
      console.log('Weight (kg):', weightKg);
      console.log('Max HR:', maxHR);
      console.log('Sleep Hours:', sleepHours);
      console.log('Recovery Score:', recoveryScore);
      console.log('HRV:', hrvMs);
      console.log('Strain:', strainScore);
      console.log('Sleep Performance:', sleepPerf);
      console.log('Resting HR:', restingHR);
      console.log('Has sleepData:', !!sleepData);
      console.log('Has recoveryData:', !!recoveryData);
      console.log('Has cycleData:', !!cycleData);
      console.log('payload.user:', payload?.user);
      console.log('payload.today:', payload?.today);
      
      // Tone packs + light variability (daily, deterministic per user + day)
      const seedStr = `${userEmail || userName}-${timeOfDay}-${new Date().toDateString()}`;
      const hash = (s: string) => {
        let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
        return Math.abs(h);
      };
      const pick = <T,>(arr: T[]): T => arr[hash(seedStr) % arr.length];

      const tonePacksEn = [
        { name: 'Coach', style: 'warm, energetic, encouraging', opening: [
            'Quick huddle — here’s the game plan for today.',
            'You’ve got a solid base today — let’s play this smart.',
            'Coach check-in: a steady tempo will win the day.'
          ], closing: [
            'Small wins stack — I’m with you till lights out.',
            'Lock in the routine tonight, wake up greener tomorrow.',
            'Finish strong and sleep on purpose — I’ll see you in the AM.'
          ] },
        { name: 'Scientist', style: 'precise, calm, data-forward', opening: [
            'Here’s what your signals are saying right now.',
            'Let’s translate the numbers into decisions.',
            'Signal scan complete — here’s the summary.'
          ], closing: [
            'We’ll re-test tomorrow — today’s inputs set the outcome.',
            'Maintain variables, reduce noise, and protect sleep.',
            'Consistent inputs tonight will move HRV in the right direction.'
          ] },
        { name: 'Buddy', style: 'friendly, casual, motivating', opening: [
            'Alright, here’s the vibe for today.',
            'Quick pulse check — you’re in a good spot.',
            'Nothing crazy today — steady and smooth.'
          ], closing: [
            'Let’s bank a calm evening and wake up sharp.',
            'We keep it simple tonight — your morning self will thank you.',
            'Easy rhythm, early lights — greener bars tomorrow.'
          ] },
      ];

      const tonePacksAr = [
        { name: 'Coach', style: 'دافئ ومشجع', opening: [
            'اجتماع سريع — هذه خطة اليوم.',
            'أرقامك جيدة — نلعبها بذكاء اليوم.',
            'تشيك المدرب: إيقاع ثابت يفوز باليوم.'
          ], closing: [
            'الانتصارات الصغيرة تتراكم — أنا معك حتى إطفاء الأنوار.',
            'ثبّت الروتين الليلة وتصحى أقوى بكرة.',
            'اختم اليوم بهدوء ونوم مقصود — أشوفك الصبح بلون أخضر.'
          ] },
        { name: 'Scientist', style: 'هادئ ودقيق', opening: [
            'هذه قراءة الإشارات الحالية.',
            'خلّينا نترجم الأرقام إلى قرارات.',
            'فحص الإشارات اكتمل — هذا الملخص.'
          ], closing: [
            'نعيد القياس غدًا — إدخالات اليوم تحدد النتيجة.',
            'ثبّت العوامل وقلل الضجيج وادعم النوم.',
            'ثبات عادات الليلة يرفع HRV بالاتجاه الصحيح.'
          ] },
        { name: 'Buddy', style: 'ودود وبسيط', opening: [
            'خلّينا نشوف اليوم ماشي كيف.',
            'نبضة سريعة — وضعك ممتاز.',
            'ما في ضغط اليوم — نمشيها بهدوء.'
          ], closing: [
            'نقفل اليوم بهدوء ونصحى أنشط.',
            'بساطة وروتين — بكرة راح تشكر نفسك.',
            'إيقاع سهل وإضاءة منخفضة — أرقام أفضل بانتظارك.'
          ] },
      ];

      const packs = language === 'ar' ? tonePacksAr : tonePacksEn;
      const chosen = packs[hash(seedStr + '-pack') % packs.length];
      const openingLine = pick(chosen.opening);
      const closingLine = pick(chosen.closing);

      const baseStructure = language === 'ar' ? `
⚠️ CRITICAL: You MUST respond in Arabic language ONLY. All text must be in Arabic script.

تحليل بيانات WHOOP التالية والرد بتنسيق JSON صارم باللغة العربية فقط:

الهيكل المطلوب (جميع النصوص يجب أن تكون بالعربية):
{
  "daily_summary": "ملخص يومي مفصل مع تحليل شخصي للبيانات الفعلية - باللغة العربية",
  "weekly_summary": "تحليل الاتجاهات الأسبوعية والتقدم مع أرقام محددة - باللغة العربية", 
  "tips": ["نصيحة قابلة للتنفيذ 1", "نصيحة 2", "نصيحة 3", "نصيحة 4"],
  "motivations": ["رسالة تحفيزية شخصية 1", "رسالة 2"],
  "visuals": []
}

⚠️ IMPORTANT: All content in daily_summary, weekly_summary, tips, and motivations MUST be in Arabic script. No English allowed.

قواعد تفسير الدرجات (مهم جدًا — لهجة داعمة):
- 0–49%: مستوى منخفض اليوم — نصيحة لطيفة لحماية الطاقة.
- 50–69%: متوسط/مقبول — نُبقي الإيقاع مستقرًا.
- 70–84%: جيد/متماسك — لغة داعمة (تجنب: "فقط 77%", "منخفض").
- 85–100%: ممتاز/جاهز — إيجابي مع خيارات مدروسة.
- تجنّب كلمات تقلّل من الأرقام الجيدة (مثل: "فقط", "مجرد") مع القيم ≥ 70%.
- دائمًا اربط كل رقم بخطوة عملية بنبرة مشجعة.` : `
Analyze the following WHOOP data and respond with strict JSON format:

REQUIRED STRUCTURE:
{
  "daily_summary": "Detailed daily overview with personal analysis of actual data",
  "weekly_summary": "Weekly trends and progress analysis with specific numbers", 
  "tips": ["actionable tip 1", "tip 2", "tip 3", "tip 4"],
  "motivations": ["personal motivational message 1", "message 2"],
  "visuals": [enhanced visuals array]
}`;

      const morningVisuals = `[
    {
      "title": "Sleep Architecture",
      "type": "stacked_bar",
      "data_keys": ["deep_sleep_hours", "rem_sleep_hours", "light_sleep_hours", "awake_hours"],
      "colors": ["#1E40AF", "#7C3AED", "#059669", "#DC2626"],
      "labels": ["Deep", "REM", "Light", "Awake"]
    },
    {
      "title": "HRV Recovery Status",
      "type": "gauge",
      "data_keys": ["current_hrv", "baseline_hrv"],
      "zones": [{"min": 0, "max": 30, "color": "#DC2626"}, {"min": 30, "max": 60, "color": "#F59E0B"}, {"min": 60, "max": 100, "color": "#059669"}],
      "center_text": "HRV Status"
    },
    {
      "title": "Performance Readiness",
      "type": "donut",
      "data_keys": ["performance_score"],
      "colors": ["#10B981", "#EF4444"],
      "center_text": "Ready"
    },
    {
      "title": "Sleep vs Target",
      "type": "comparison_bar",
      "data_keys": ["actual_sleep", "target_sleep"],
      "colors": ["#3B82F6", "#E5E7EB"],
      "labels": ["Actual", "Target"]
    }
  ]`;

      const middayVisuals = `[
    {
      "title": "Current Strain Load",
      "type": "gauge",
      "data_keys": ["current_strain", "optimal_strain"],
      "zones": [{"min": 0, "max": 8, "color": "#10B981"}, {"min": 8, "max": 15, "color": "#F59E0B"}, {"min": 15, "max": 21, "color": "#EF4444"}],
      "center_text": "Strain"
    },
    {
      "title": "Energy vs Recovery",
      "type": "scatter",
      "data_keys": ["energy_level", "recovery_score"],
      "colors": ["#8B5CF6"],
      "zones": [{"label": "Optimal Zone", "color": "#10B981"}]
    },
    {
      "title": "Hydration Status",
      "type": "progress",
      "data_keys": ["hydration_level"],
      "color": "#06B6D4",
      "target": 100
    },
    {
      "title": "Afternoon Readiness",
      "type": "donut",
      "data_keys": ["afternoon_readiness"],
      "colors": ["#F59E0B", "#E5E7EB"],
      "center_text": "Ready"
    }
  ]`;

      const eveningVisuals = `[
    {
      "title": "Daily Strain Summary",
      "type": "line",
      "data_keys": ["hourly_strain"],
      "gradient": true,
      "color": "#EF4444"
    },
    {
      "title": "Recovery Preparation",
      "type": "radar",
      "data_keys": ["sleep_readiness", "stress_level", "recovery_score"],
      "colors": ["#10B981", "#F59E0B", "#8B5CF6"],
      "labels": ["Sleep Ready", "Stress", "Recovery"]
    },
    {
      "title": "Tomorrow's Prediction",
      "type": "gauge",
      "data_keys": ["predicted_readiness"],
      "zones": [{"min": 0, "max": 33, "color": "#DC2626"}, {"min": 33, "max": 66, "color": "#F59E0B"}, {"min": 66, "max": 100, "color": "#059669"}],
      "center_text": "Tomorrow"
    },
    {
      "title": "Sleep Debt",
      "type": "comparison_bar",
      "data_keys": ["sleep_debt", "optimal_sleep"],
      "colors": ["#DC2626", "#10B981"],
      "labels": ["Debt", "Optimal"]
    }
  ]`;

      let visuals = morningVisuals;
      if (timeOfDay === 'midday') visuals = middayVisuals;
      if (timeOfDay === 'evening') visuals = eveningVisuals;

      return `${baseStructure}

CRITICAL REQUIREMENTS:
- Address the user by first name: ${userName}. Never use generic words like "Champion".
- Use ACTUAL data from payload, not generic responses
- Reference specific numbers (sleep hours, HRV values, performance scores, body measurements if present)
- Make insights personal and data-driven
- Provide actionable recommendations based on current metrics
- Use timezone: ${userTimezone}
- Voice Pack: ${chosen.name} (${chosen.style}). Start with: "${openingLine}". End with: "${closingLine}".
- Style: conversational, varied sentence lengths, avoid repetitive phrasing. 0–2 tasteful emojis allowed if it improves clarity.
- daily_summary MUST START with the opening line above and MUST END with the closing line above.
- Prepend daily_summary with a WINDOW TAG exactly as one of: "MORNING — ", "MIDDAY — ", or "EVENING — " matching time_of_day.
- daily_summary MUST embed at least 3 numeric facts inline (e.g., 61% recovery, 50 ms HRV, 7.6h sleep, 6.4 strain, 1418 cal, 30 min).
- Include exactly 3 MICRO-ACTIONS for today with specific time or quantity (e.g., "15-min easy walk after dinner", "lights down 11:30 PM", "300–400 ml water 60 min before bed").
- weekly_summary MUST have: (1) one trend sentence with 1–2 numbers; (2) one focus sentence for the next 24–72 hours. No generic copy.
- tips MUST NOT duplicate the micro-actions in daily_summary; keep them distinct and implementable.
- BANNED PHRASES: "Tonight is your chance to reset", "Focus on improving X", "Be predictive". Use natural alternatives.
- INTERPRETATION RULES ENFORCEMENT: For metrics in 70–84% range, frame as "good" or "solid"; avoid negative framing like "only 77%". For ≥85% use clearly positive tone; for 50–69% neutral/stable; for 0–49% gentle and protective. When referencing numbers, use phrases like "a solid 77%" or "a good 82%" to reinforce the supportive tone.

CURRENT REAL METRICS TO USE:
- Sleep Hours: ${sleepHours}h
- Recovery Score: ${recoveryScore}%
- HRV: ${hrvMs}ms
- Strain Score: ${strainScore}
- Sleep Performance: ${sleepPerf}%
- Resting HR: ${restingHR} bpm
${heightMeter ? `- Height: ${heightMeter}m (${(heightMeter * 100).toFixed(0)}cm)` : ''}
${weightKg ? `- Weight: ${weightKg}kg` : ''}
${maxHR ? `- Max Heart Rate: ${maxHR} bpm` : ''}

VISUALS ARRAY:
${visuals}

ACTUAL METRICS (use these exact numbers):
User Name: ${userName}
Sleep Hours: ${sleepHours}
Recovery Score: ${recoveryScore}
HRV: ${hrvMs} ms
Strain: ${strainScore}
Sleep Performance: ${sleepPerf}%
Resting HR: ${restingHR} bpm
${heightMeter ? `Height: ${heightMeter}m` : ''}
${weightKg ? `Weight: ${weightKg}kg` : ''}
${maxHR ? `Max HR: ${maxHR} bpm` : ''}`;

    };

    const userPrompt: string = getEnhancedUserPrompt(timeOfDay, language);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("openai error", resp.status, t);
      return new Response(JSON.stringify({ error: "openai_error", status: resp.status, body: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    
    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "whoop-ai-insights",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: userPrompt,
      outputText: content,
      status: "success"
    });

    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("whoop-ai-insights error", e);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "whoop-ai-insights",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: (e as Error).message
    });

    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
