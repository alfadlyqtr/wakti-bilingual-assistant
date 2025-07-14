

import { callDeepSeekAPI, detectLanguageFromText } from './utils.ts';

/**
 * ENHANCED: Image generation with Arabic translation support
 */

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
  
  console.log('🎨 IMAGE GEN: Starting generation for:', prompt.substring(0, 50));
  
  if (!RUNWARE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' 
        ? 'خدمة إنشاء الصور غير متاحة' 
        : 'Image generation service not configured',
      imageUrl: null
    };
  }

  // ARABIC TRANSLATION LOGIC - SIMPLE 4 STEPS
  let finalPrompt = prompt;
  let originalPrompt = prompt;

  try {
    // STEP 1: Detect if prompt is in Arabic
    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(prompt);
    
    // STEP 2: If Arabic detected, translate to English using DeepSeek
    if (isArabic) {
      console.log('🌐 ARABIC DETECTED: Translating to English for Runware');
      
      if (!DEEPSEEK_API_KEY) {
        throw new Error('Translation service not available');
      }

      const translationResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'Translate Arabic image prompts to English for AI image generation. Return ONLY the English translation.'
            },
            {
              role: 'user',
              content: `Translate this Arabic image prompt to English: ${prompt}`
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        }),
      });

      if (translationResponse.ok) {
        const result = await translationResponse.json();
        const translatedText = result.choices?.[0]?.message?.content?.trim();
        if (translatedText) {
          finalPrompt = translatedText;
          console.log('✅ TRANSLATION SUCCESS:', translatedText.substring(0, 50));
        }
      }
    }

    // STEP 3: Send English prompt to Runware
    const taskUUID = crypto.randomUUID();
    
    const imageGenPayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: finalPrompt, // THIS IS THE ENGLISH PROMPT
        width: 1024,
        height: 1024,
        model: "runware:100@1",
        numberResults: 1,
        outputFormat: "WEBP"
      }
    ];

    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageGenPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Runware API error: ${response.status}`);
    }

    const responseData = await response.json();

    if (responseData?.data) {
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      
      if (imageResult?.imageURL) {
        // STEP 4: Return with generated image
        console.log('✅ IMAGE GENERATED SUCCESSFULLY');
        
        const responseMessage = language === 'ar' 
          ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageResult.imageURL})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
          : `🎨 Image generated successfully!\n\n![Generated Image](${imageResult.imageURL})\n\n**Prompt:** ${finalPrompt}`;
        
        return {
          success: true,
          error: null,
          imageUrl: imageResult.imageURL,
          response: responseMessage
        };
      }
    }

    throw new Error('No image URL in response');

  } catch (error) {
    console.error('❌ IMAGE GEN ERROR:', error);
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      imageUrl: null
    };
  }
}

