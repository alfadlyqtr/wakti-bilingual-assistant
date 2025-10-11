    const { transcript, language, recordId, model } = await req.json();
    console.log('Request payload:', { 
      hasTranscript: !!transcript, 
      language, 
      transcriptLength: transcript?.length,
      hasRecordId: !!recordId,
      model
    });
{{ ... }}
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
{{ ... }}
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    );
