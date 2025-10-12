import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, language, recordId, model } = await req.json();
    console.log('Request payload:', { 
      hasTranscript: !!transcript, 
      language, 
      transcriptLength: transcript?.length,
      hasRecordId: !!recordId,
      model
    });

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the language for the prompt
    const isArabic = language === 'ar';
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
      ? `أنت مُلخّص محترف للاجتماعات/المحاضرات/جلسات العصف الذهني. حدّد نوع الجلسة (اجتماع، محاضرة، عصف ذهني) وقدّم ملخصاً واضحاً ومنظماً ومختصراً. استخرج دائماً وقدّم:
- نوع الجلسة
- العنوان
- النقاط الرئيسية (قائمة نقطية)
- القرارات (قائمة نقطية)
- عناصر العمل (قائمة نقطية: المسؤول، المهمة، تاريخ الاستحقاق إن ورد صراحة؛ لا تختلق تواريخ)
- الأسماء المذكورة (أشخاص ومنظمات)
- المواقع والأماكن المذكورة
- التواريخ والأوقات المذكورة
- الأسئلة المفتوحة / المواضيع المؤجلة (قائمة نقطية)

احفظ اللغة الأصلية للأسماء والمصطلحات المنقولة. إذا اختلط العربي بالإنجليزي، حافظ على وضوح اللغتين (لا تُترجم الأسماء). كن موجزاً وتجنب التكرار.`
      : `You are a professional summarizer for meetings, lectures, and brainstorms. Detect the session type (meeting, lecture, brainstorm) and produce a clear, concise, well-structured summary. Always extract and present:
- Session Type
- Title
- Main Points (bulleted)
- Decisions (bulleted)
- Action Items (bulleted: owner, task, due date if explicitly stated; do NOT invent dates)
- Names mentioned (people and organizations)
- Locations mentioned
- Dates and times mentioned
- Open Questions / Parking Lot (bulleted)

Preserve original languages for proper names and quoted terms. If content mixes Arabic and English, keep both readable (do not translate names). Be succinct and avoid repetition.`;

    const userPrompt = `${transcript}`;

    console.log('Calling OpenAI Chat Completions with model:', chosenModel);

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

    return new Response(
      JSON.stringify({ summary, recordId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in summarize-text function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
