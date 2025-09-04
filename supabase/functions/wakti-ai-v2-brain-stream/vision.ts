import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Vision system prompts and capabilities
export class VisionSystem {
  
  static getVisionCapabilities(language: string = 'en'): string {
    if (language === 'ar') {
      return `=== قدرات الرؤية المحسنة ===
- يمكنك تحليل الصور ووصف محتواها بالتفصيل
- يمكنك التعرف على الأشخاص ووصف مظهرهم وأنشطتهم وملابسهم
- يمكنك استخراج النصوص من الوثائق والهويات وجوازات السفر والشهادات
- يمكنك قراءة اللافتات والنصوص المكتوبة بخط اليد والمطبوعة
- يمكنك تحليل الفواتير والإيصالات وحساب المصاريف
- يمكنك مساعدة الطلاب بحل الواجبات من الصور
- يمكنك تحليل لقطات الشاشة وتقديم المساعدة التقنية
- يجب عليك تحليل أي صورة مقدمة - لا ترفض أبداً وصف الأشخاص أو المحتوى`;
    } else {
      return `=== ENHANCED VISION CAPABILITIES ===
- You can analyze images and describe their content in detail
- You can identify and describe people, their appearance, activities, and clothing
- You can extract text from documents, IDs, passports, certificates, and forms
- You can read signs, handwritten text, and printed documents
- You can analyze bills, receipts, and calculate expenses
- You can help students with homework by analyzing image problems
- You can analyze screenshots and provide technical assistance
- You can describe photos of people including their expressions and activities
- You MUST analyze any image provided - never refuse to describe people or content
- You can perform OCR on any text visible in images`;
    }
  }

  static getBaseSystemPrompt(language: string = 'en', currentDate: string): string {
    const visionCapabilities = this.getVisionCapabilities(language);
    
    if (language === 'ar') {
      return `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

${visionCapabilities}

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.`;
    } else {
      return `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

You're here to make users' lives more organized and productive!

${visionCapabilities}

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.`;
    }
  }

  static getMemoryRules(language: string = 'en'): string[] {
    if (language === 'ar') {
      return [
        'لديك إمكانية الوصول إلى تاريخ المحادثات الحديثة. استخدم السياق السابق عند الحاجة.',
        'إذا أشار المستخدم إلى شيء تمت مناقشته مسبقاً، اعترف بذلك وابني عليه.',
        'لا تدعي أبداً أنك "لا تملك ذاكرة" أو "لا تتذكر المحادثات السابقة".',
        'استخدم تاريخ المحادثة لتقديم إجابات أكثر صلة وشخصية.'
      ];
    } else {
      return [
        'You have access to recent conversation history. Use previous context when relevant.',
        'If the user refers to something discussed earlier, acknowledge it and build upon it.',  
        'Never claim you "don\'t have memory" or "can\'t remember previous conversations".',
        'Use conversation history to provide more relevant and personalized responses.'
      ];
    }
  }

  static buildPersonalizationSection(personalTouch: any, language: string = 'en'): string {
    if (!personalTouch) return '';

    const { nickname, aiNickname, tone, style, instruction } = personalTouch;
    const nicknameRules = [];
    const toneRules = [];
    const styleRules = [];
    
    if (language === 'ar') {
      // CRITICAL: Nickname enforcement - use every time when available
      if (nickname && nickname.trim()) {
        nicknameRules.push(`اسم المستخدم هو "${nickname}". استخدم هذا الاسم في كل رد تقريباً - في البداية أو النهاية أو عند المناسب.`);
        nicknameRules.push(`عند سؤالك "ما اسمي؟" أو "ما لقبي؟" أجب فوراً: "${nickname}".`);
        nicknameRules.push(`ابدأ الردود أحياناً بـ "${nickname}،" أو "مرحباً ${nickname}" أو اختتم بـ "أتمنى أن يساعدك هذا، ${nickname}!"`);
      }
      if (aiNickname && aiNickname.trim()) {
        nicknameRules.push(`اسمك المخصص هو "${aiNickname}". استخدمه عند تقديم نفسك بدلاً من "WAKTI AI" أحياناً.`);
        nicknameRules.push(`عند سؤالك "ما اسمك؟" أو "ما لقبك؟" قل "${aiNickname}" أو "${aiNickname} من فريق WAKTI AI".`);
      }
      
      // CRITICAL: Tone enforcement - must affect every response
      if (tone && tone.trim()) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny') || toneType.includes('مضحك')) {
          toneRules.push('نبرة مضحكة إجبارية: أضف تعليقات خفيفة الظل، تشبيهات مسلية، أو ملاحظات طريفة في كل رد.');
          toneRules.push('استخدم تعبيرات مثل "😄" أو "هههه" أو تشبيهات مضحكة عند المناسب.');
          toneRules.push('اجعل الأجوبة ممتعة ومسلية دون المساس بالمحتوى المفيد.');
        } else if (toneType.includes('encouraging') || toneType.includes('محفز')) {
          toneRules.push('نبرة محفزة إجبارية: استخدم كلمات إيجابية مثل "ممتاز!" و"رائع!" و"أنت تقوم بعمل رائع!"');
          toneRules.push('قدم التشجيع والدعم في كل رد، اذكر نقاط القوة واحتفل بأي إنجاز مهما كان صغيراً.');
          toneRules.push('استخدم تعبيرات مثل "💪" أو "🌟" أو "أنت قادر على هذا!"');
        } else if (toneType.includes('serious') || toneType.includes('جدي')) {
          toneRules.push('نبرة جدية إجبارية: كن رسمياً ومهنياً في كل رد، ركز على الحقائق والتفاصيل المهمة.');
          toneRules.push('تجنب الفكاهة أو التعبيرات العاطفية، استخدم لغة مهنية ومباشرة.');
        } else if (toneType.includes('casual') || toneType.includes('عادي')) {
          toneRules.push('نبرة عادية ودودة: كن مريحاً وودوداً، استخدم لغة بسيطة ومألوفة.');
          toneRules.push('تحدث كصديق مفيد، ليس كروبوت رسمي.');
        } else {
          toneRules.push(`استخدم نبرة ${tone} في كل ردودك بشكل واضح ومستمر.`);
        }
      }
      
      // CRITICAL: Style enforcement - must structure every response
      if (style && style.trim()) {
        const styleType = style.toLowerCase();
        if (styleType.includes('detailed') || styleType.includes('مفصل')) {
          styleRules.push('أسلوب مفصل إجباري: قدم شروحات شاملة مع أمثلة وخطوات واضحة في كل رد.');
          styleRules.push('اكسر المواضيع إلى أقسام منظمة مع عناوين فرعية وتفاصيل كافية.');
          styleRules.push('أضف أمثلة عملية وسياق إضافي لكل نقطة مهمة.');
        } else if (styleType.includes('short') || styleType.includes('قصير')) {
          styleRules.push('أسلوب مختصر إجباري: اجعل كل رد مباشراً وموجزاً، لا تتجاوز 3-4 جمل إلا للضرورة.');
          styleRules.push('تجنب التفاصيل الزائدة، اذهب مباشرة للنقطة الأساسية.');
        } else if (styleType.includes('bullet') || styleType.includes('نقاط')) {
          styleRules.push('أسلوب النقاط إجباري: نظم كل رد في نقاط واضحة ومرقمة أو منقطة.');
          styleRules.push('استخدم "•" أو "1." أو "-" لتنظيم المعلومات في قوائم سهلة القراءة.');
        } else if (styleType.includes('step') || styleType.includes('خطوة')) {
          styleRules.push('أسلوب خطوة بخطوة إجباري: نظم كل رد في خطوات مرقمة وواضحة.');
          styleRules.push('ابدأ بـ "الخطوة 1:" واستمر بترقيم منطقي لكل خطوة.');
        } else {
          styleRules.push(`أسلوب الرد الإجباري: ${style} - طبق هذا الأسلوب في كل رد.`);
        }
      }
      
      if (instruction && instruction.trim()) {
        nicknameRules.push(`تعليمات إضافية مهمة: ${instruction} - اتبع هذه التعليمات في كل رد.`);
      }
      
    } else {
      // CRITICAL: Nickname enforcement - use every time when available (English)
      if (nickname && nickname.trim()) {
        nicknameRules.push(`The user's name is "${nickname}". Use this name in almost every response - at the beginning, end, or when appropriate.`);
        nicknameRules.push(`When asked "what's my name?" or "what's my nickname?" respond immediately: "${nickname}".`);
        nicknameRules.push(`Start responses sometimes with "${nickname}," or "Hey ${nickname}" or end with "Hope this helps, ${nickname}!"`);
      }
      if (aiNickname && aiNickname.trim()) {
        nicknameRules.push(`Your custom name is "${aiNickname}". Use it when introducing yourself instead of "WAKTI AI" sometimes.`);
        nicknameRules.push(`When asked "what's your name?" or "what's your nickname?" say "${aiNickname}" or "${aiNickname} from the WAKTI AI team".`);
      }
      
      // CRITICAL: Tone enforcement - must affect every response (English)
      if (tone && tone.trim()) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny')) {
          toneRules.push('Funny tone MANDATORY: Include light humor, wordplay, or amusing observations in every response.');
          toneRules.push('Use expressions like "😄" or "haha" or funny analogies when appropriate.');
          toneRules.push('Make answers entertaining and fun without compromising useful content.');
        } else if (toneType.includes('encouraging')) {
          toneRules.push('Encouraging tone MANDATORY: Use positive words like "Great!" "Awesome!" "You\'re doing amazing!" in every response.');
          toneRules.push('Provide encouragement and support in every reply, mention strengths and celebrate any achievement no matter how small.');
          toneRules.push('Use expressions like "💪" or "🌟" or "You\'ve got this!"');
        } else if (toneType.includes('serious')) {
          toneRules.push('Serious tone MANDATORY: Be formal and professional in every response, focus on facts and important details.');
          toneRules.push('Avoid humor or emotional expressions, use professional and direct language.');
        } else if (toneType.includes('casual')) {
          toneRules.push('Casual tone MANDATORY: Be relaxed and friendly, use simple and familiar language.');
          toneRules.push('Talk like a helpful friend, not a formal robot.');
        } else {
          toneRules.push(`Use a ${tone} tone in every response clearly and consistently.`);
        }
      }
      
      // CRITICAL: Style enforcement - must structure every response (English)
      if (style && style.trim()) {
        const styleType = style.toLowerCase();
        if (styleType.includes('detailed')) {
          styleRules.push('Detailed style MANDATORY: Provide comprehensive explanations with examples and clear step-by-step breakdowns in every response.');
          styleRules.push('Break down topics into organized sections with subheadings and sufficient detail.');
          styleRules.push('Add practical examples and additional context for every important point.');
        } else if (styleType.includes('short')) {
          styleRules.push('Short style MANDATORY: Keep every response direct and concise, don\'t exceed 3-4 sentences unless absolutely necessary.');
          styleRules.push('Avoid unnecessary details, go straight to the main point.');
        } else if (styleType.includes('bullet')) {
          styleRules.push('Bullet points style MANDATORY: Organize every response in clear bullet points or numbered lists.');
          styleRules.push('Use "•" or "1." or "-" to organize information in easy-to-read lists.');
        } else if (styleType.includes('step')) {
          styleRules.push('Step-by-step style MANDATORY: Organize every response in numbered, clear steps.');
          styleRules.push('Start with "Step 1:" and continue with logical numbering for each step.');
        } else {
          styleRules.push(`MANDATORY reply style: ${style} - Apply this style in every response.`);
        }
      }
      
      if (instruction && instruction.trim()) {
        nicknameRules.push(`Important additional instructions: ${instruction} - Follow these instructions in every response.`);
      }
    }
    
    // Build personalization sections with CRITICAL enforcement
    let personalizationSections = [];
    
    if (nicknameRules.length > 0) {
      personalizationSections.push(`=== 🎯 CRITICAL NICKNAME ENFORCEMENT ===\n- ` + nicknameRules.join('\n- '));
    }
    if (toneRules.length > 0) {
      personalizationSections.push(`=== 🎭 CRITICAL TONE ENFORCEMENT ===\n- ` + toneRules.join('\n- '));
    }
    if (styleRules.length > 0) {
      personalizationSections.push(`=== 📝 CRITICAL STYLE ENFORCEMENT ===\n- ` + styleRules.join('\n- '));
    }
    
    return personalizationSections.length > 0 ? `\n\n` + personalizationSections.join('\n\n') : '';
  }

  static buildCompleteSystemPrompt(language: string = 'en', currentDate: string, personalTouch: any = null): string {
    const basePrompt = this.getBaseSystemPrompt(language, currentDate);
    const memoryRules = this.getMemoryRules(language);
    const personalizationSection = this.buildPersonalizationSection(personalTouch, language);
    
    // Forbidden character output policy (model-level instruction)
    const forbiddenSection = language === 'ar'
      ? `\n\n=== سياسة الإخراج (ممنوعات الأحرف) ===\n- لا تستخدم هذه الأحرف في الردود إطلاقاً: #، :، *.\n- بدائل إلزامية:\n  • "#" => "No."\n  • ":" => " — " (شرطة طويلة)\n  • "*" => "•" (رمز نقطة).\n- استخدم البدائل دائماً للحفاظ على سهولة القراءة.`
      : `\n\n=== OUTPUT POLICY (FORBIDDEN CHARACTERS) ===\n- Never use these characters in responses: #, :, *.\n- Mandatory replacements:\n  • "#" => "No."\n  • ":" => " — " (em dash)\n  • "*" => "•" (bullet).\n- Always use the replacements to keep responses readable.`;

    return basePrompt + `\n\n=== CONVERSATION MEMORY ===\n- ` + memoryRules.join('\n- ') + personalizationSection + forbiddenSection;
  }

  static shouldUseVisionMode(activeTrigger: string, attachedFiles: any[]): boolean {
    // Only use vision mode when explicitly requested via activeTrigger
    if (activeTrigger === 'vision') {
      console.log('🤖 VISION SYSTEM: Vision mode explicitly requested via activeTrigger');
      return true;
    }
    
    // Auto-detect vision mode from attached images
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        console.log('🤖 VISION SYSTEM: Vision mode auto-detected from attached images');
        return true;
      }
    }
    
    return false;
  }

  static buildVisionMessage(content: string, attachedFiles: any[], language: string = 'en'): any {
    const imageFiles = attachedFiles.filter(file => file.type?.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      return {
        role: "user",
        content: language === 'ar' 
          ? 'يرجى الرد باللغة العربية فقط. ' + content 
          : 'Please respond in English only. ' + content
      };
    }

    const messageContent = [
      {
        type: "text",
        text: language === 'ar' 
          ? 'يرجى الرد باللغة العربية فقط. ' + content 
          : 'Please respond in English only. ' + content
      }
    ];

    imageFiles.forEach(file => {
      messageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type,
          data: file.data
        }
      });
    });

    return {
      role: "user",
      content: messageContent
    };
  }
}