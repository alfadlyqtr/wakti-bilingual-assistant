{{ ... }}
  try {
    const { summary, voice, recordId } = await req.json();

     if (!summary) {
       return new Response(
         JSON.stringify({ error: 'Summary text is required' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

     // Auto-detect predominant language for basic code-switching groundwork
     const isArabicChar = (c: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(c);
     const arabicRatio = (() => {
       const chars = summary.split('');
       const ar = chars.reduce((acc, ch) => acc + (isArabicChar(ch) ? 1 : 0), 0);
       return chars.length ? ar / chars.length : 0;
     })();

     // Voice selection policy:
     // - If caller explicitly passes 'male' or 'female', honor it (backward compatible)
     // - If caller passes 'auto' or omits voice, pick by predominant language
     //   Note: This does not do per-sentence routing; it's a safe initial improvement with no API/UI change
     let voiceOption: string;
     if (voice === 'male') {
       voiceOption = 'onyx';
     } else if (voice === 'female') {
       voiceOption = 'nova';
     } else {
       // auto
       voiceOption = arabicRatio >= 0.40 ? 'nova' : 'onyx';
     }

     console.log(`Generating speech for text length: ${summary.length}, voice: ${voiceOption}, recordId: ${recordId || 'none'}`);
