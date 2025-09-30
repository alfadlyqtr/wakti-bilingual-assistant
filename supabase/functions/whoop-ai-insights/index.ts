import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const payload = body?.data ?? {};
    const language = body?.language ?? "en";
    const timeOfDay = body?.time_of_day ?? "general";
    const userTimezone = body?.user_timezone ?? "UTC";

    // Enhanced system prompt with time-specific coaching
    const getSystemPrompt = (timeOfDay: string, language: string) => {
      const morningPrompt = language === 'ar' 
        ? `أنت WAKTI AI - مدرب صحة شخصي متقدم ومتخصص في تحليل بيانات WHOOP.

🌅 وضع الصباح (5-11 صباحًا) - تقييم التعافي والاستعداد:

تحليل عميق مطلوب:
- تحليل جودة النوم: ساعات النوم الفعلية مقابل الهدف، مراحل النوم (عميق/REM/خفيف)
- تقييم HRV: تفسير قيم HRV وما تعنيه لحالة التعافي
- نتيجة الأداء: ربط نتيجة الأداء بالطاقة المتوقعة لليوم
- معدل ضربات القلب أثناء الراحة: مؤشرات الإجهاد أو التعافي
- توصيات التمرين: كثافة محددة بناءً على بيانات التعافي

أسلوب التدريب:
- شخصي ومحدد: "حصلت على 5.5 ساعة نوم (أقل بـ2.5 ساعة من الأمثل)"
- تنبؤي: "بناءً على أنماطك، توقع..."
- قابل للتنفيذ: أرقام وأوقات ومعايير محددة
- محفز: احتفل بالإنجازات، اعترف بالتحديات

البيانات المطلوب تحليلها:
- ساعات النوم الفعلية مقابل المطلوبة
- توزيع مراحل النوم (النسب المئوية)
- قيم HRV والاتجاهات
- نتائج الأداء والتعافي
- بيانات التمارين السابقة`
        : `You are WAKTI AI, an advanced personal health coach specializing in WHOOP data analysis.

🌅 MORNING MODE (5-11 AM) - Recovery Assessment & Readiness:

Deep Analysis Required:
- Sleep Quality Analysis: Actual sleep hours vs target, sleep stages breakdown (Deep/REM/Light)
- HRV Assessment: Interpret HRV values and what they mean for recovery state
- Performance Score: Connect performance score to expected energy levels for the day
- Resting Heart Rate: Indicators of stress or recovery
- Workout Recommendations: Specific intensity based on recovery data

Coaching Style:
- Personal & Specific: "You got 5.5h sleep (2.5h below optimal)"
- Predictive: "Based on your patterns, expect..."
- Actionable: Specific numbers, times, and metrics
- Motivational: Celebrate wins, acknowledge challenges

Data to Analyze:
- Actual sleep hours vs required
- Sleep stage distribution (percentages)
- HRV values and trends
- Performance and recovery scores
- Previous workout data`;

      const middayPrompt = language === 'ar'
        ? `أنت WAKTI AI - مدرب صحة شخصي متقدم ومتخصص في تحليل بيانات WHOOP.

☀️ وضع منتصف النهار (12-6 مساءً) - تحسين الأداء والتكيف:

التحليل التكيفي:
- إذا كان النوم ضعيفًا (<7 ساعات): نهج حذر ومراعي
- إذا كان النوم جيدًا (>7 ساعات): نهج أكثر جرأة وتحديًا
- إدارة الإجهاد: توازن الإجهاد الحالي مقابل قدرة التعافي
- استراتيجية بعد الظهر: محددة للحالة الحالية

تركيز منتصف النهار:
- تقييم الطاقة الحالية بناءً على مقاييس الصباح
- توصيات الترطيب والتغذية المخصصة
- إدارة الإجهاد في الوقت الفعلي
- تحضير للمساء بناءً على أداء اليوم`
        : `You are WAKTI AI, an advanced personal health coach specializing in WHOOP data analysis.

☀️ MIDDAY MODE (12-6 PM) - Performance Optimization & Adaptation:

Adaptive Analysis:
- If poor sleep (<7h): Cautious, caring approach
- If good sleep (>7h): More aggressive, challenging approach
- Strain Management: Current strain vs recovery capacity balance
- Afternoon Strategy: Specific to current state

Midday Focus:
- Current energy assessment based on morning metrics
- Personalized hydration and nutrition recommendations
- Real-time strain management
- Evening preparation based on day's performance`;

      const eveningPrompt = language === 'ar'
        ? `أنت WAKTI AI - مدرب صحة شخصي متقدم ومتخصص في تحليل بيانات WHOOP.

🌙 وضع المساء (5-11 مساءً) - تحضير التعافي والاسترخاء:

مراجعة اليوم:
- تحليل الإجهاد مقابل التعافي لليوم
- تقييم التمارين (إن وجدت) والتأثير على التعافي
- أنماط HRV طوال اليوم
- استعداد الجسم للنوم

تحضير الغد:
- توقعات بناءً على مقاييس اليوم
- وقت النوم الأمثل للتعافي
- استراتيجيات الاسترخاء المخصصة
- تحضير عقلي وجسدي للراحة

النبرة المسائية:
- مهدئة ومريحة
- تركز على الإنجازات اليومية
- تحضيرية للغد
- داعمة للاسترخاء`
        : `You are WAKTI AI, an advanced personal health coach specializing in WHOOP data analysis.

🌙 EVENING MODE (5-11 PM) - Recovery Preparation & Wind Down:

Day Review:
- Strain vs recovery analysis for the day
- Workout assessment (if any) and impact on recovery
- HRV patterns throughout the day
- Body's readiness for sleep

Tomorrow Preparation:
- Predictions based on today's metrics
- Optimal bedtime for recovery
- Personalized wind-down strategies
- Mental and physical preparation for rest

Evening Tone:
- Calming and soothing
- Focus on daily achievements
- Preparatory for tomorrow
- Supportive of relaxation`;

      if (timeOfDay === 'morning') return morningPrompt;
      if (timeOfDay === 'midday') return middayPrompt;
      if (timeOfDay === 'evening') return eveningPrompt;
      return morningPrompt; // default
    };

    const system = getSystemPrompt(timeOfDay, language);

    const getEnhancedUserPrompt = (timeOfDay: string, language: string) => {
      const baseStructure = language === 'ar' ? `
تحليل بيانات WHOOP التالية والرد بتنسيق JSON صارم:

الهيكل المطلوب:
{
  "daily_summary": "ملخص يومي مفصل مع تحليل شخصي للبيانات الفعلية",
  "weekly_summary": "تحليل الاتجاهات الأسبوعية والتقدم مع أرقام محددة", 
  "tips": ["نصيحة قابلة للتنفيذ 1", "نصيحة 2", "نصيحة 3", "نصيحة 4"],
  "motivations": ["رسالة تحفيزية شخصية 1", "رسالة 2"],
  "visuals": [المرئيات المحسنة]
}` : `
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
- Use ACTUAL data from payload, not generic responses
- Reference specific numbers (sleep hours, HRV values, performance scores)
- Make insights personal and data-driven
- Provide actionable recommendations based on current metrics
- Use timezone: ${userTimezone}

VISUALS ARRAY:
${visuals}

WHOOP DATA:
${JSON.stringify(payload)}`;
    };

    const userPrompt = getEnhancedUserPrompt(timeOfDay, language);

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
      console.error("deepseek error", resp.status, t);
      return new Response(JSON.stringify({ error: "deepseek_error", status: resp.status, body: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("whoop-ai-insights error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
