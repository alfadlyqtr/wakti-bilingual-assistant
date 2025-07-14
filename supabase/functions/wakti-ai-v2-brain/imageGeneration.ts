


import { callDeepSeekAPI, detectLanguageFromText } from './utils.ts';

/**
 * ENHANCED: Image generation with Arabic translation support
 */

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  console.log('🎨 IMAGE GEN: Starting generation for:', prompt.substring(0, 50));
  
  if (!RUNWARE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة إنشاء الصور غير متاحة' : 'Image generation service not configured',
      response: language === 'ar' ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.' : 'I apologize, image generation service is not available at the moment.'
    };
  }

  let finalPrompt = prompt;
  let originalPrompt = prompt;

  try {
    const isArabic = language === 'ar' || /[\u0600-\u06FF]/.test(prompt);
    
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
            { role: 'system', content: 'Translate Arabic image prompts to English. Return ONLY the English translation.' },
            { role: 'user', content: `Translate this to English: ${prompt}` }
          ],
          max_tokens: 300,
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

    const taskUUID = crypto.randomUUID();
    const imageGenPayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: finalPrompt,
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
      console.error('❌ IMAGE API ERROR:', response.status, errorText);
      throw new Error(`Image generation API error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from image generation service');
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from image generation service');
    }

    if (responseData && responseData.data && Array.isArray(responseData.data)) {
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      if (imageResult && imageResult.imageURL) {
        console.log('✅ IMAGE GEN: Successfully generated image');
        
        const responseMessage = language === 'ar' 
          ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageResult.imageURL})\n\n**الوصف الأصلي:** ${originalPrompt}\n**الوصف المترجم:** ${finalPrompt}`
          : `🎨 Image generated successfully!\n\n![Generated Image](${imageResult.imageURL})\n\n**Prompt:** ${finalPrompt}`;
        
        return {
          success: true,
          error: null,
          response: responseMessage,
          imageUrl: imageResult.imageURL
        };
      }
    }

    console.warn('⚠️ IMAGE GEN: No valid image URL in response');
    return {
      success: false,
      error: language === 'ar' ? 'لم يتم إنشاء الصورة بنجاح' : 'Image generation failed',
      response: language === 'ar' ? 'أعتذر، لم أتمكن من إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'I apologize, I could not generate the image. Please try again.'
    };
  } catch (error) {
    console.error('❌ IMAGE GEN: Critical error:', error);
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      response: language === 'ar' ? 'أعتذر، حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى.' : 'I apologize, there was an error generating the image. Please try again.'
    };
  }
}


