import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialTokenOnce, checkTrialAccess } from "../_shared/trial-tracker.ts";

const getRecordingTypeGuide = (recordingType: string | undefined, isArabic: boolean): string => {
  switch (recordingType) {
    case 'meeting':
      return isArabic
        ? 'نوع التسجيل المحدد هو: اجتماع. ركّز على جدول الأعمال، القرارات، المتابعات، والمسؤوليات.'
        : 'The selected recording type is: meeting. Focus on agenda, decisions, follow-ups, and responsibilities.';
    case 'business_meeting':
      return isArabic
        ? 'نوع التسجيل المحدد هو: اجتماع عمل. ركّز على الأهداف التجارية، القرارات، عناصر العمل، المالكين، والمواعيد النهائية المذكورة صراحة.'
        : 'The selected recording type is: business meeting. Focus on business goals, decisions, action items, owners, and explicitly stated deadlines.';
    case 'lecture':
      return isArabic
        ? 'نوع التسجيل المحدد هو: محاضرة. ركّز على المفاهيم الرئيسية، الشرح، الأمثلة، والأسئلة أو الواجبات إن وُجدت.'
        : 'The selected recording type is: lecture. Focus on key concepts, explanations, examples, and any questions or assignments if present.';
    case 'islamic_lecture':
      return isArabic
        ? 'نوع التسجيل المحدد هو: محاضرة إسلامية. ركّز على الموضوعات الشرعية، الآيات أو الأحاديث المذكورة، الفوائد، والدروس العملية. لا تختلق مراجع غير مذكورة.'
        : 'The selected recording type is: Islamic lecture. Focus on Islamic topics, any verses or hadith explicitly mentioned, lessons, and practical takeaways. Do not invent references.';
    case 'study_session':
      return isArabic
        ? 'نوع التسجيل المحدد هو: جلسة دراسة. ركّز على الموضوعات التي تمت مراجعتها، النقاط الصعبة، ما يحتاج متابعة، والخطوات التالية للمذاكرة.'
        : 'The selected recording type is: study session. Focus on topics reviewed, difficult points, follow-up items, and next study steps.';
    case 'classroom':
      return isArabic
        ? 'نوع التسجيل المحدد هو: حصة دراسية. ركّز على الدرس، شرح المعلم، الأسئلة، الواجب، وأي تعليمات صفية واضحة.'
        : 'The selected recording type is: classroom session. Focus on the lesson, teacher explanations, questions, homework, and clear classroom instructions.';
    case 'brainstorming':
      return isArabic
        ? 'نوع التسجيل المحدد هو: عصف ذهني. ركّز على الأفكار المطروحة، الاتجاهات المحتملة، الأنماط المتكررة، والأسئلة أو الفرص المفتوحة، من دون تحويل الجلسة إلى محضر اجتماع رسمي.'
        : 'The selected recording type is: brainstorming. Focus on ideas generated, possible directions, recurring themes, and open questions or opportunities, without turning the session into formal meeting minutes.';
    default:
      return isArabic
        ? 'إذا لم يُحدَّد النوع بدقة، استنتج نوع الجلسة من النص ثم نظّم الملخص وفقاً لذلك.'
        : 'If the type is not explicitly provided, infer the session type from the transcript and structure the summary accordingly.';
  }
};

const getRecordingTypeOutputRules = (recordingType: string | undefined, isArabic: boolean): string => {
  switch (recordingType) {
    case 'meeting':
      return isArabic
        ? `اتبع قالب اجتماع عام. اجعل الأقسام الأساسية:
- نوع الجلسة
- عنوان واضح
- الهدف من الاجتماع
- النقاط الرئيسية
- القرارات المتخذة
- المتابعات / الخطوات التالية
- المسؤوليات إن وُجدت
- مواعيد أو تواريخ ذُكرت

إذا لم توجد قرارات أو مسؤوليات أو مواعيد، اكتب "غير مذكور". لا تحوّل الاجتماع إلى تقرير تجاري تنفيذي إلا إذا كان النص نفسه يشير لذلك.`
        : `Use a general meeting format. Make the core sections:
- Session Type
- Clear Title
- Meeting Purpose
- Main Discussion Points
- Decisions Made
- Follow-ups / Next Steps
- Owners if present
- Dates or deadlines mentioned

If decisions, owners, or deadlines are missing, write "Not mentioned". Do not turn it into an executive business report unless the transcript itself supports that.`;
    case 'business_meeting':
      return isArabic
        ? `اتبع قالب اجتماع عمل تنفيذي. اجعل الأقسام الأساسية:
- نوع الجلسة
- عنوان تجاري واضح
- الهدف التجاري / سياق الاجتماع
- القرارات التجارية
- عناصر العمل (المهمة، المالك، الموعد إن ذُكر صراحة)
- المخاطر أو العوائق
- الفرص أو الأولويات
- الخطوات التنفيذية التالية

ركّز على النتيجة والمسؤولية والتنفيذ. إذا لم توجد بنود تجارية واضحة، اذكر ذلك صراحة ولا تملأها بتخمينات.`
        : `Use an executive business meeting format. Make the core sections:
- Session Type
- Clear Business Title
- Business Goal / Context
- Business Decisions
- Action Items (task, owner, due date only if explicitly stated)
- Risks or blockers
- Opportunities or priorities
- Next execution steps

Focus on outcome, ownership, and execution. If business-specific items are not clearly present, say so explicitly and do not invent them.`;
    case 'lecture':
      return isArabic
        ? `اتبع قالب محاضرة تعليمية. اجعل الأقسام الأساسية:
- نوع الجلسة
- عنوان المحاضرة أو موضوعها
- الفكرة العامة
- المفاهيم الأساسية
- الشروحات أو الأمثلة المهمة
- المصطلحات أو التعريفات المذكورة
- أسئلة أو نقاط تحتاج مراجعة
- الخلاصة التعليمية

لا تركّز على القرارات أو عناصر العمل إلا إذا وردت فعلاً.`
        : `Use an educational lecture format. Make the core sections:
- Session Type
- Lecture Title or Topic
- Big Idea
- Core Concepts
- Key Explanations or Examples
- Terms or Definitions Mentioned
- Questions or points to review
- Learning Takeaway

Do not focus on decisions or action items unless they are actually present.`;
    case 'islamic_lecture':
      return isArabic
        ? `اتبع قالب محاضرة إسلامية. اجعل الأقسام الأساسية:
- نوع الجلسة
- عنوان الموضوع الشرعي
- الموضوعات الشرعية الرئيسية
- الآيات المذكورة صراحة
- الأحاديث المذكورة صراحة
- الفوائد الإيمانية والتربوية
- التوجيهات أو الدروس العملية
- أسئلة أو مسائل مفتوحة

لا تذكر آية أو حديث أو حكم شرعي لم يرد بوضوح في النص. وإذا لم تُذكر مراجع صريحة، اكتب "غير مذكور".`
        : `Use an Islamic lecture format. Make the core sections:
- Session Type
- Islamic Topic Title
- Main Islamic Themes
- Verses explicitly mentioned
- Hadith explicitly mentioned
- Faith and character lessons
- Practical guidance or reminders
- Open questions or unresolved matters

Do not cite verses, hadith, or rulings unless they are clearly present in the transcript. If explicit references are missing, write "Not mentioned".`;
    case 'study_session':
      return isArabic
        ? `اتبع قالب جلسة مذاكرة. اجعل الأقسام الأساسية:
- نوع الجلسة
- موضوع المذاكرة
- ما تمت مراجعته
- النقاط الصعبة أو غير الواضحة
- ما يحتاج متابعة أو حل
- أسئلة للمراجعة
- خطة المذاكرة التالية

التركيز هنا على الفهم والمراجعة، وليس على القرارات الرسمية.`
        : `Use a study session format. Make the core sections:
- Session Type
- Study Topic
- What was reviewed
- Difficult or unclear points
- What needs follow-up
- Review questions
- Next study plan

The focus here is understanding and review, not formal decisions.`;
    case 'classroom':
      return isArabic
        ? `اتبع قالب حصة دراسية. اجعل الأقسام الأساسية:
- نوع الجلسة
- عنوان الدرس
- ما شرحه المعلم
- الأنشطة أو الأمثلة الصفية
- الأسئلة والمناقشات
- الواجب أو التعليمات الصفية
- ما يجب على الطالب تذكره

لا تتعامل مع الحصة كأنها اجتماع إلا إذا كان النص فعلاً كذلك.`
        : `Use a classroom session format. Make the core sections:
- Session Type
- Lesson Title
- What the teacher explained
- Activities or classroom examples
- Questions and discussion
- Homework or class instructions
- What the student should remember

Do not treat the class like a meeting unless the transcript genuinely reads that way.`;
    case 'brainstorming':
      return isArabic
        ? `اتبع قالب عصف ذهني. اجعل الأقسام الأساسية:
- نوع الجلسة
- الموضوع أو التحدي الرئيسي
- الأفكار المطروحة
- الأفكار الواعدة أو الأكثر تكراراً
- الأنماط أو الاتجاهات المشتركة
- الأسئلة المفتوحة أو ما يحتاج استكشافاً
- الخطوات أو التجارب التالية المقترحة

التركيز هنا على توليد الأفكار والاتجاهات، وليس على محاضر الاجتماعات أو القرارات الرسمية إلا إذا ذُكرت صراحة.`
        : `Use a brainstorming format. Make the core sections:
- Session Type
- Main Topic or Challenge
- Ideas Generated
- Most Promising or Repeated Ideas
- Shared Patterns or Themes
- Open Questions or Areas to Explore
- Suggested Next Experiments or Directions

The focus here is idea generation and exploration, not formal meeting minutes or decisions unless they are explicitly stated.`;
    default:
      return isArabic
        ? `حدّد نوع الجلسة من النص أولاً، ثم اختر هيكل الملخص المناسب. إذا ظهر أنها محاضرة أو درس أو جلسة دراسة، لا تستخدم قالب اجتماعات. وإذا ظهر أنها اجتماع عمل، ركّز على القرارات والتنفيذ.`
        : `First infer the session type from the transcript, then choose the matching summary structure. If it reads like a lecture, class, or study session, do not use a meeting template. If it reads like a business meeting, focus on decisions and execution.`;
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');
    const supabaseAdmin = authHeader && supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const authToken = authHeader?.replace('Bearer ', '') ?? '';
    const { data: authData } = supabaseAdmin && authToken
      ? await supabaseAdmin.auth.getUser(authToken)
      : { data: { user: null } };
    const user = authData?.user ?? null;

    if (user && supabaseAdmin) {
      const trial = await checkTrialAccess(supabaseAdmin, user.id, 'tasjeel', 1);
      if (!trial.allowed) {
        return new Response(
          JSON.stringify(buildTrialErrorPayload('tasjeel', trial)),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { transcript, language, recordId, model, recordingType } = await req.json();
    console.log('Request payload:', { 
      hasTranscript: !!transcript, 
      language, 
      transcriptLength: transcript?.length,
      hasRecordId: !!recordId,
      model,
      recordingType
    });

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the language for the prompt
    const isArabic = language === 'ar';
    const recordingTypeGuide = getRecordingTypeGuide(recordingType, isArabic);
    const recordingTypeOutputRules = getRecordingTypeOutputRules(recordingType, isArabic);
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('Error: OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default to gpt-4o-mini for faster/cheaper summarization; allow optional override via payload
    const chosenModel = typeof model === 'string' && model.trim() ? model : 'gpt-4o-mini';

    const systemPrompt = isArabic
      ? `أنت مُلخّص محترف لأنواع متعددة من التسجيلات الصوتية. ${recordingTypeGuide}

${recordingTypeOutputRules}

اكتب ملخصاً واضحاً ومنظماً ومختصراً اعتماداً على النوع المحدد أو النوع المستنتج من النص. لا تستخدم نفس القالب لكل التسجيلات. غيّر شكل الملخص بحسب طبيعة الجلسة.

إذا كان القسم غير مناسب لنوع التسجيل أو لا توجد له معلومات واضحة، اكتب "غير مذكور" بدلاً من التخمين.
احفظ اللغة الأصلية للأسماء والمصطلحات المنقولة. إذا اختلط العربي بالإنجليزي، حافظ على وضوح اللغتين ولا تترجم الأسماء.
لا تختلق قرارات أو عناصر عمل أو مراجع شرعية أو واجبات أو مواعيد غير موجودة في النص.
كن موجزاً، واضحاً، ومختلفاً في البنية حسب نوع التسجيل.`
      : `You are a professional summarizer for multiple kinds of audio sessions. ${recordingTypeGuide}

${recordingTypeOutputRules}

Write a clear, concise, well-structured summary based on the selected type or the type inferred from the transcript. Do not use the same template for every recording. Adapt the summary shape to the nature of the session.

If a section does not fit the recording type or the information is not clearly present, write "Not mentioned" instead of guessing.
Preserve original languages for proper names and quoted terms. If content mixes Arabic and English, keep both readable and do not translate names.
Do not invent decisions, action items, religious references, homework, or deadlines that are not actually present in the transcript.
Be concise, clear, and structurally different based on the recording type.`;

    const userPrompt = `${transcript}`;

    console.log('Calling OpenAI Chat Completions with model:', chosenModel);
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ error: errorData.error?.message || 'Failed to generate summary' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || '';

    console.log('Summary generated successfully, length:', summary.length);

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "summarize-text",
      provider: "openai",
      model: chosenModel,
      inputText: transcript,
      outputText: summary,
      durationMs: Date.now() - startTime,
      status: "success"
    });

    let trialPayload = null;
    if (user && supabaseAdmin) {
      const consumeTrial = await checkAndConsumeTrialTokenOnce(supabaseAdmin, user.id, 'tasjeel', 1, recordId || summary);
      if (consumeTrial.allowed) {
        trialPayload = buildTrialSuccessPayload('tasjeel', consumeTrial);
      } else {
        console.warn('[summarize-text] Trial consume skipped after success:', consumeTrial.reason);
      }
    }

    return new Response(
      JSON.stringify({ summary, recordId, trial: trialPayload }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in summarize-text function:', error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "summarize-text",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
