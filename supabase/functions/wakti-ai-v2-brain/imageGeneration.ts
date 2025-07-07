
// WAKTI AI Image Generation with Runware API - Fixed with proper timeouts
import { RUNWARE_API_KEY, DEEPSEEK_API_KEY } from './utils.ts';

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log('🎨 IMAGE GEN: Starting Runware image generation for:', prompt);
    
    if (!RUNWARE_API_KEY) {
      console.error('❌ IMAGE GEN: Runware API key not configured');
      return {
        success: false,
        error: language === 'ar' 
          ? 'خدمة إنشاء الصور غير متاحة' 
          : 'Image generation service not configured',
        imageUrl: null
      };
    }

    // Translate prompt if needed (Arabic to English for better generation)
    let translatedPrompt = prompt;
    let translation_status = 'not_needed';
    
    if (language === 'ar' && DEEPSEEK_API_KEY) {
      try {
        console.log('🌐 TRANSLATE: Translating Arabic prompt to English');
        
        // Enhanced timeout handling for translation - 10 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const translateResponse = await fetch('https://api.deepseek.com/chat/completions', {
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
                content: 'Translate the following Arabic text to English for image generation. Return only the translation, no additional text.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.3
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          translatedPrompt = translateData.choices[0].message.content.trim();
          translation_status = 'success';
          console.log('✅ TRANSLATE: Successfully translated prompt:', translatedPrompt);
        } else {
          console.warn('⚠️ TRANSLATE: Translation failed, using original prompt');
          translation_status = 'failed';
        }
      } catch (translateError) {
        console.warn('⚠️ TRANSLATE: Translation error:', translateError);
        translation_status = 'failed';
      }
    }

    // Generate unique task UUID
    const taskUUID = crypto.randomUUID();
    
    const imageGenPayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: translatedPrompt,
        width: 1024,
        height: 1024,
        model: "runware:100@1",
        numberResults: 1,
        outputFormat: "WEBP",
        CFGScale: 1,
        scheduler: "FlowMatchEulerDiscreteScheduler",
        strength: 0.8
      }
    ];

    console.log('🎨 IMAGE GEN: Calling Runware API with enhanced timeout handling');

    // Enhanced timeout handling - 60 seconds for image generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(imageGenPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('🎨 IMAGE GEN: Runware response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ IMAGE GEN: Runware API error:', response.status, errorText);
      return {
        success: false,
        error: language === 'ar' 
          ? `خطأ في إنشاء الصورة: ${response.status}` 
          : `Image generation error: ${response.status}`,
        imageUrl: null,
        translation_status
      };
    }

    const responseData = await response.json();
    console.log('🎨 IMAGE GEN: Runware response received successfully');

    // Process the response
    if (responseData.data && responseData.data.length > 0) {
      // Find the image result
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      
      if (imageResult && imageResult.imageURL) {
        console.log('✅ IMAGE GEN: Successfully generated image:', imageResult.imageURL);
        
        return {
          success: true,
          error: null,
          imageUrl: imageResult.imageURL,
          translation_status,
          translatedPrompt: translation_status === 'success' ? translatedPrompt : null,
          seed: imageResult.seed,
          cost: imageResult.cost
        };
      } else {
        console.error('❌ IMAGE GEN: No image URL in response');
        return {
          success: false,
          error: language === 'ar' 
            ? 'لم يتم إنشاء الصورة بنجاح' 
            : 'Image generation failed - no image URL returned',
          imageUrl: null,
          translation_status
        };
      }
    } else {
      console.error('❌ IMAGE GEN: Invalid response structure');
      return {
        success: false,
        error: language === 'ar' 
          ? 'استجابة غير صالحة من خدمة إنشاء الصور' 
          : 'Invalid response from image generation service',
        imageUrl: null,
        translation_status
      };
    }

  } catch (error) {
    console.error('❌ IMAGE GEN: Critical error in generateImageWithRunware:', error);
    
    // Handle different error types
    let errorMessage = language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed';
    if (error.name === 'AbortError') {
      errorMessage = language === 'ar' ? 'انتهت مهلة إنشاء الصورة' : 'Image generation timed out';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
      imageUrl: null,
      translation_status: 'failed'
    };
  }
}
