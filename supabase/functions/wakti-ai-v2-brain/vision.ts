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
      // Enhanced nickname handling with explicit recognition
      if (nickname) {
        nicknameRules.push(`اسم المستخدم هو "${nickname}". نادِ المستخدم بهذا الاسم عند المناسب.`);
        nicknameRules.push(`عند سؤالك "ما اسمي؟" أو "ما لقبي؟" أجب فوراً: "${nickname}".`);
      }
      if (aiNickname) {
        nicknameRules.push(`اسمك المخصص هو "${aiNickname}". استخدمه أحياناً عند تقديم نفسك.`);
        nicknameRules.push(`عند سؤالك "ما اسمك؟" أو "ما لقبك؟" اذكر "${aiNickname}" مع "WAKTI AI".`);
      }
      
      // Enhanced tone enforcement with specific behaviors
      if (tone) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny') || toneType.includes('مضحك')) {
          toneRules.push('استخدم نبرة مضحكة: أضف تعليقات خفيفة الظل، تشبيهات مسلية، أو ملاحظات طريفة عند المناسب.');
          toneRules.push('لا تبالغ في الفكاهة - فقط لمسات خفيفة لتجعل المحادثة أكثر متعة.');
        } else if (toneType.includes('encouraging') || toneType.includes('محفز')) {
          toneRules.push('استخدم نبرة محفزة: قدم التشجيع والدعم الإيجابي، اذكر نقاط القوة واحتفل بالإنجازات.');
        } else if (toneType.includes('serious') || toneType.includes('جدي')) {
          toneRules.push('استخدم نبرة جدية: كن رسمياً ومهنياً، ركز على الحقائق والتفاصيل المهمة.');
        } else {
          toneRules.push(`استخدم نبرة ${tone} في ردودك.`);
        }
      }
      
      // Enhanced style enforcement with structural requirements  
      if (style) {
        const styleType = style.toLowerCase();
        if (styleType.includes('detailed') || styleType.includes('مفصل')) {
          styleRules.push('أسلوب مفصل: قدم شروحات شاملة مع أمثلة وخطوات واضحة.');
          styleRules.push('اكسر المواضيع المعقدة إلى أقسام منظمة مع تفاصيل كافية لكل قسم.');
        } else if (styleType.includes('short') || styleType.includes('مختصر')) {
          styleRules.push('أسلوب مختصر: اجعل الردود مباشرة وموجزة، دون تفاصيل زائدة.');
        } else {
          styleRules.push(`أسلوب الرد: ${style}.`);
        }
      }
      
      if (instruction) nicknameRules.push(`تعليمات إضافية: ${instruction}`);
      
    } else {
      // Enhanced nickname handling with explicit recognition (English)
      if (nickname) {
        nicknameRules.push(`The user's name is "${nickname}". Address the user by this name when appropriate.`);
        nicknameRules.push(`When asked "what's my name?" or "what's my nickname?" respond immediately: "${nickname}".`);
      }
      if (aiNickname) {
        nicknameRules.push(`Your custom name is "${aiNickname}". Use it occasionally when introducing yourself.`);
        nicknameRules.push(`When asked "what's your name?" or "what's your nickname?" mention "${aiNickname}" along with "WAKTI AI".`);
      }
      
      // Enhanced tone enforcement with specific behaviors (English)
      if (tone) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny')) {
          toneRules.push('Use a funny tone: Include light humor, wordplay, or amusing observations when appropriate.');
          toneRules.push('Don\'t overdo the humor - just light touches to make the conversation more enjoyable.');
        } else if (toneType.includes('encouraging')) {
          toneRules.push('Use an encouraging tone: Provide positive support and motivation, highlight strengths and celebrate achievements.');
        } else if (toneType.includes('serious')) {
          toneRules.push('Use a serious tone: Be formal and professional, focus on facts and important details.');  
        } else {
          toneRules.push(`Use a ${tone} tone in your responses.`);
        }
      }
      
      // Enhanced style enforcement with structural requirements (English)
      if (style) {
        const styleType = style.toLowerCase();
        if (styleType.includes('detailed')) {
          styleRules.push('Detailed style: Provide comprehensive explanations with examples and clear step-by-step breakdowns.');
          styleRules.push('Break down complex topics into organized sections with sufficient detail for each part.');
        } else if (styleType.includes('short')) {
          styleRules.push('Short style: Keep responses direct and concise, without unnecessary details.');
        } else {
          styleRules.push(`Reply style: ${style}.`);
        }
      }
      
      if (instruction) nicknameRules.push(`Additional instructions: ${instruction}`);
    }
    
    // Build personalization sections
    let personalizationSections = [];
    
    if (nicknameRules.length > 0) {
      personalizationSections.push(`=== NICKNAME RECOGNITION ===\n- ` + nicknameRules.join('\n- '));
    }
    if (toneRules.length > 0) {
      personalizationSections.push(`=== TONE ENFORCEMENT ===\n- ` + toneRules.join('\n- '));
    }
    if (styleRules.length > 0) {
      personalizationSections.push(`=== STYLE ENFORCEMENT ===\n- ` + styleRules.join('\n- '));
    }
    
    return personalizationSections.length > 0 ? `\n\n` + personalizationSections.join('\n\n') : '';
  }

  static buildCompleteSystemPrompt(language: string = 'en', currentDate: string, personalTouch: any = null): string {
    const basePrompt = this.getBaseSystemPrompt(language, currentDate);
    const memoryRules = this.getMemoryRules(language);
    const personalizationSection = this.buildPersonalizationSection(personalTouch, language);
    
    return basePrompt + `\n\n=== CONVERSATION MEMORY ===\n- ` + memoryRules.join('\n- ') + personalizationSection;
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
