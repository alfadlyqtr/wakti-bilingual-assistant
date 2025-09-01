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
    
    // Build STRICT personalization enforcement
    let strictRules = [];
    
    if (language === 'ar') {
      strictRules.push('=== إنفاذ الشخصية الصارم ===');
      strictRules.push('يجب عليك اتباع هذه القواعد بدقة في كل رد:');
      
      // STRICT nickname enforcement
      if (nickname?.trim()) {
        strictRules.push(`• اسم المستخدم: "${nickname}" - استخدم هذا الاسم في بداية ردك عندما يكون مناسباً`);
        strictRules.push(`• عند سؤالك "ما اسمي؟" أجب فوراً: "${nickname}"`);
      }
      
      if (aiNickname?.trim()) {
        strictRules.push(`• اسمك المخصص: "${aiNickname}" - استخدمه أحياناً مع "WAKTI AI"`);
        strictRules.push(`• عند سؤالك "ما اسمك؟" اذكر "${aiNickname}" مع "WAKTI AI"`);
      }
      
      // STRICT tone enforcement
      if (tone) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny') || toneType.includes('مضحك')) {
          strictRules.push('• النبرة: مرحة ومضحكة - أضف لمسات من الفكاهة الخفيفة والتعليقات المسلية');
        } else if (toneType.includes('encouraging') || toneType.includes('محفز')) {
          strictRules.push('• النبرة: محفزة ومشجعة - قدم الدعم الإيجابي والتحفيز');
        } else if (toneType.includes('serious') || toneType.includes('جدي')) {
          strictRules.push('• النبرة: جدية ومهنية - كن رسمياً وركز على الحقائق');
        } else if (toneType.includes('casual') || toneType.includes('عادي')) {
          strictRules.push('• النبرة: عادية ومريحة - كن ودوداً وغير رسمي');
        } else {
          strictRules.push(`• النبرة: ${tone} - طبق هذه النبرة في جميع ردودك`);
        }
      }
      
      // STRICT style enforcement  
      if (style) {
        const styleType = style.toLowerCase();
        if (styleType.includes('short') || styleType.includes('مختصر')) {
          strictRules.push('• أسلوب الرد: مختصر وموجز - اجعل الردود قصيرة ومباشرة');
        } else if (styleType.includes('detailed') || styleType.includes('مفصل')) {
          strictRules.push('• أسلوب الرد: مفصل وشامل - قدم شروحات مفصلة مع أمثلة');
        } else if (styleType.includes('step') || styleType.includes('خطوة')) {
          strictRules.push('• أسلوب الرد: خطوة بخطوة - اكسر المعلومات إلى خطوات واضحة');
        } else if (styleType.includes('bullet') || styleType.includes('نقاط')) {
          strictRules.push('• أسلوب الرد: نقاط - استخدم القوائم والنقاط لتنظيم المعلومات');
        } else {
          strictRules.push(`• أسلوب الرد: ${style} - طبق هذا الأسلوب في ردودك`);
        }
      }
      
      if (instruction?.trim()) {
        strictRules.push(`• تعليمات إضافية: ${instruction}`);
      }
      
    } else {
      strictRules.push('=== STRICT PERSONALIZATION ENFORCEMENT ===');
      strictRules.push('You MUST follow these rules precisely in every response:');
      
      // STRICT nickname enforcement
      if (nickname?.trim()) {
        strictRules.push(`• User's name: "${nickname}" - Use this name at the start of your response when appropriate`);
        strictRules.push(`• When asked "what's my name?" respond immediately: "${nickname}"`);
      }
      
      if (aiNickname?.trim()) {
        strictRules.push(`• Your custom name: "${aiNickname}" - Use it occasionally with "WAKTI AI"`);
        strictRules.push(`• When asked "what's your name?" mention "${aiNickname}" along with "WAKTI AI"`);
      }
      
      // STRICT tone enforcement
      if (tone) {
        const toneType = tone.toLowerCase();
        if (toneType.includes('funny')) {
          strictRules.push('• Tone: Funny and humorous - Add light humor, wordplay, and amusing observations');
        } else if (toneType.includes('encouraging')) {
          strictRules.push('• Tone: Encouraging and supportive - Provide positive motivation and celebrate achievements');
        } else if (toneType.includes('serious')) {
          strictRules.push('• Tone: Serious and professional - Be formal and focus on facts and important details');  
        } else if (toneType.includes('casual')) {
          strictRules.push('• Tone: Casual and relaxed - Be friendly and informal in your communication');
        } else {
          strictRules.push(`• Tone: ${tone} - Apply this tone consistently in all responses`);
        }
      }
      
      // STRICT style enforcement
      if (style) {
        const styleType = style.toLowerCase();
        if (styleType.includes('short')) {
          strictRules.push('• Reply style: Short and concise - Keep responses brief and to the point');
        } else if (styleType.includes('detailed')) {
          strictRules.push('• Reply style: Detailed and comprehensive - Provide thorough explanations with examples');
        } else if (styleType.includes('step')) {
          strictRules.push('• Reply style: Step-by-step - Break information into clear sequential steps');
        } else if (styleType.includes('bullet')) {
          strictRules.push('• Reply style: Bullet points - Use lists and bullet points to organize information');
        } else {
          strictRules.push(`• Reply style: ${style} - Apply this style consistently in your responses`);
        }
      }
      
      if (instruction?.trim()) {
        strictRules.push(`• Additional instructions: ${instruction}`);
      }
    }
    
    // Add enforcement reminder
    if (language === 'ar') {
      strictRules.push('');
      strictRules.push('تذكير مهم: يجب تطبيق هذه القواعد من أول كلمة في ردك حتى آخر كلمة.');
    } else {
      strictRules.push('');
      strictRules.push('CRITICAL REMINDER: Apply these rules from the very first word of your response to the last.');
    }
    
    return '\n\n' + strictRules.join('\n');
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
