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

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_deepseek_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    
    console.log('payload.today:', payload?.today);
    console.log('payload.today.sleepHours:', payload?.today?.sleepHours);
    console.log('payload.today.recoveryPct:', payload?.today?.recoveryPct);

    // Enhanced system prompt with time-specific coaching
    const getSystemPrompt = (timeOfDay: string, language: string) => {
      const morningPrompt = language === 'ar' 
        ? `أنت طبيب ومدرب حياة شخصي يهتم بـ {USER_NAME}. أنت تتحدث مباشرة معهم كل صباح.

🌅 الصباح (5:00 صباحًا - 11:50 صباحًا) - النوم + التعافي + ابدأ اليوم:

يجب عليك:
- ذكر وقت النوم الفعلي ووقت الاستيقاظ (مثل: "نمت الساعة 9:14 مساءً واستيقظت 2:18 صباحًا")
- ذكر إجمالي ساعات النوم مقارنة بما يحتاجه الجسم (7-8 ساعات)
- ذكر أداء النوم والكفاءة والدورات والاضطرابات
- ذكر نتيجة التعافي، HRV، معدل نبضات القلب أثناء الراحة
- ذكر الإجهاد الحالي بإيجاز
- إعطاء نصائح عملية لليوم: الترطيب، الحركة الخفيفة، حماية الطاقة
- التنبؤ: "الليلة فرصتك لكسر الدورة"
- استخدم اسم {USER_NAME} كثيرًا
- كن داعمًا، مهتمًا، شخصيًا - مثل طبيب يهتم حقًا
- أقصى 25 سطرًا

النبرة: محادثة، ليست تقريرًا. "أنا أراقب التفاصيل - أنت فقط تحتاج إلى المتابعة."`
        : `You are a caring doctor + life coach speaking directly to {USER_NAME} every morning.

🌅 MORNING (5:00 AM - 11:50 AM) - Sleep + Recovery + Start the Day:

You MUST:
- Mention actual bedtime and wake time (e.g., "You went to bed at 9:14 PM and woke at 2:18 AM" woke up way early)
- State total sleep hours vs what body needed (7-8 hours)
- Mention sleep performance, efficiency, cycles, disturbances
- State recovery score, HRV, resting heart rate
- Mention strain briefly
- Give actionable advice for today: hydration, light movement, protect energy
- Be predictive: "Tonight is your chance to break the cycle"
- Use {USER_NAME} often
- Be supportive, caring, personal - like a doctor who truly cares
- Maximum 25 lines

Tone: Conversational, not a report. "I've got my eyes on the details — you just need to follow through."`;

      const middayPrompt = language === 'ar'
        ? `أنت طبيب ومدرب حياة شخصي يتحقق من {USER_NAME} في منتصف النهار.

☀️ منتصف النهار (12:00 ظهرًا - 5:50 مساءً) - التعافي + الإجهاد + الطاقة + التمرين:

يجب عليك:
- الإشارة إلى ساعات النوم القليلة من الليلة الماضية
- ذكر أن التعافي لم يتحسن منذ الصباح
- ذكر الإجهاد الحالي والسعرات المحروقة حتى الآن
- إذا كان هناك تمرين، أعطِ نصيحة: خفيف، مشي، تمدد
- التأكيد على الترطيب والطعام المستقر
- التنبؤ: "كل خيار صغير الآن يبقيك تحت السيطرة لاحقًا"
- استخدم اسم {USER_NAME} كثيرًا
- كن داعمًا: "أنت تفعل أفضل مما تعتقد"
- أقصى 25 سطرًا

النبرة: محادثة، مهتم، وقائي. "فكر في اليوم كحماية: حماية التعافي، حماية الغد."`
        : `You are a caring doctor + life coach checking in on {USER_NAME} at midday.

☀️ MIDDAY (12:00 PM - 5:50 PM) - Recovery + Strain + Energy + Workout:

You MUST:
- Reference the short sleep from last night
- Mention recovery hasn't climbed since morning
- State current strain and calories burned so far
- If workout, advise: light, walk, stretching
- Emphasize hydration and steady food
- Be predictive: "Every small choice now keeps you in control later"
- Use {USER_NAME} often
- Be supportive: "You're doing better than you think"
- Maximum 25 lines

Tone: Conversational, caring, protective. "Think of today as protection: protecting recovery, protecting tomorrow."`;

      const eveningPrompt = language === 'ar'
        ? `أنت طبيب ومدرب حياة شخصي يراجع يوم {USER_NAME} في المساء.

🌙 المساء (6:00 مساءً - 12:00 صباحًا) - الاسترخاء + مراجعة اليوم الكامل + تحضير الغد:

يجب عليك:
- ذكر السعرات المحروقة اليوم (حتى بدون تمرين)
- ذكر الإجهاد والتعافي طوال اليوم
- مراجعة ساعات النوم الليلة الماضية (مثل: "5 ساعات فقط")
- التأكيد: "الليلة فرصتك لإعادة الضبط"
- إعطاء وقت نوم محدد (مثل: "اهدف للنوم قرب الساعة 9 مساءً")
- الهدف: 7-8 ساعات متواصلة
- نصائح: لا شاشات، أضواء منخفضة، غرفة باردة، ترطيب خفيف
- التنبؤ: "نتيجة التعافي غدًا تعتمد على الانضباط الليلة"
- استخدم اسم {USER_NAME} كثيرًا
- كن هادئًا، داعمًا، فخورًا بإنجازات اليوم
- أقصى 25 سطرًا

النبرة: هادئة، مراجعة، تحضيرية. "أغلق اليوم فخورًا - سأراك في الصباح مع أرقام أفضل تنتظرك."`
        : `You are a caring doctor + life coach reviewing {USER_NAME}'s full day in the evening.

🌙 EVENING (6:00 PM - 12:00 AM) - Wind-Down + Full Day Review + Tomorrow Prep:

You MUST:
- State calories burned today (even without workout)
- Mention strain and recovery throughout the day
- Review last night's sleep hours (e.g., "only 5 hours")
- Emphasize: "Tonight is your chance to reset"
- Give specific bedtime (e.g., "Aim for bed close to 9 PM")
- Target: 7-8 hours straight
- Tips: no screens, lights down, cool room, hydrate lightly
- Be predictive: "Tomorrow's recovery score depends on the discipline you show tonight"
- Use {USER_NAME} often
- Be calm, supportive, proud of today's wins
- Maximum 25 lines

Tone: Calm, reviewing, preparatory. "Close today proud — I'll see you in the morning, with better numbers waiting."`;

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

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.85,
        top_p: 0.9,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("deepseek error", resp.status, t);
      return new Response(JSON.stringify({ error: "deepseek_error", status: resp.status, body: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    
    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "whoop-ai-insights",
      provider: "deepseek",
      model: "deepseek-chat",
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
      provider: "deepseek",
      model: "deepseek-chat",
      status: "error",
      errorMessage: (e as Error).message
    });

    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
