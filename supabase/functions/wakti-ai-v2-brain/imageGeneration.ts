
import { callDeepSeekAPI, detectLanguageFromText } from './utils.ts';

/**
 * ENHANCED: Image generation with Arabic translation support
 */

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
  
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

  try {
    let finalPrompt = prompt;
    let translationUsed = false;
    
    // Check if prompt is in Arabic and needs translation
    const detectedLanguage = detectLanguageFromText(prompt);
    const isArabicPrompt = language === 'ar' || detectedLanguage === 'ar';
    
    if (isArabicPrompt) {
      console.log('🌍 ARABIC PROMPT DETECTED: Translating to English for Runware');
      
      try {
        const translationResponse = await translateImagePrompt(prompt);
        if (translationResponse.success && translationResponse.translatedPrompt) {
          finalPrompt = translationResponse.translatedPrompt;
          translationUsed = true;
          console.log('✅ TRANSLATION SUCCESS:', {
            original: prompt.substring(0, 30) + '...',
            translated: finalPrompt.substring(0, 30) + '...'
          });
        } else {
          console.warn('⚠️ TRANSLATION FAILED: Using original prompt');
          // Continue with original Arabic prompt (Runware might handle some Arabic)
        }
      } catch (translationError) {
        console.error('❌ TRANSLATION ERROR:', translationError);
        // Continue with original prompt if translation fails
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

    // Safe JSON parsing with validation
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from image generation service');
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      console.error('❌ Raw response:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from image generation service');
    }

    // Process the response safely
    if (responseData && responseData.data && Array.isArray(responseData.data)) {
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      
      if (imageResult && imageResult.imageURL) {
        console.log('✅ IMAGE GEN: Successfully generated image', {
          translationUsed,
          originalLanguage: isArabicPrompt ? 'ar' : 'en'
        });
        return {
          success: true,
          error: null,
          imageUrl: imageResult.imageURL,
          translationUsed,
          originalPrompt: translationUsed ? prompt : undefined,
          finalPrompt: translationUsed ? finalPrompt : undefined
        };
      }
    }

    console.warn('⚠️ IMAGE GEN: No valid image URL in response');
    return {
      success: false,
      error: language === 'ar' 
        ? 'لم يتم إنشاء الصورة بنجاح' 
        : 'Image generation failed - no image URL returned',
      imageUrl: null
    };

  } catch (error) {
    console.error('❌ IMAGE GEN: Critical error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      imageUrl: null,
      details: error.message
    };
  }
}

/**
 * Translate Arabic image prompt to English using DeepSeek
 */
async function translateImagePrompt(arabicPrompt: string): Promise<{
  success: boolean;
  translatedPrompt?: string;
  error?: string;
}> {
  try {
    console.log('🔄 TRANSLATING IMAGE PROMPT:', arabicPrompt.substring(0, 50));
    
    const messages = [
      {
        role: 'system',
        content: `You are a professional translator specializing in image generation prompts. 
Translate the Arabic image description to English while preserving all visual details, artistic styles, and technical specifications.
Keep the translation accurate and suitable for AI image generation.
Only return the English translation, nothing else.`
      },
      {
        role: 'user',
        content: arabicPrompt
      }
    ];

    const response = await callDeepSeekAPI(messages, 150);
    
    if (response?.choices?.[0]?.message?.content) {
      const translatedPrompt = response.choices[0].message.content.trim();
      
      console.log('✅ PROMPT TRANSLATION SUCCESS:', {
        original: arabicPrompt.substring(0, 30) + '...',
        translated: translatedPrompt.substring(0, 30) + '...'
      });
      
      return {
        success: true,
        translatedPrompt
      };
    } else {
      throw new Error('Invalid translation response from DeepSeek');
    }
  } catch (error) {
    console.error('❌ PROMPT TRANSLATION ERROR:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
