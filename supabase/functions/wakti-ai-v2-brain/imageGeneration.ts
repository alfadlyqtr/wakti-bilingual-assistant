
// FIXED: Image Generation with proper JSON parsing
import { RUNWARE_API_KEY, DEEPSEEK_API_KEY } from './utils.ts';

export async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log('🎨 IMAGE GEN: Starting generation for:', prompt);
    
    if (!RUNWARE_API_KEY) {
      return {
        success: false,
        error: language === 'ar' 
          ? 'خدمة إنشاء الصور غير متاحة' 
          : 'Image generation service not configured',
        imageUrl: null
      };
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
        positivePrompt: prompt,
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

    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(imageGenPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: language === 'ar' 
          ? `خطأ في إنشاء الصورة: ${response.status}` 
          : `Image generation error: ${response.status}`,
        imageUrl: null
      };
    }

    // Safe JSON parsing
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      return {
        success: false,
        error: language === 'ar' 
          ? 'استجابة فارغة من خدمة إنشاء الصور' 
          : 'Empty response from image generation service',
        imageUrl: null
      };
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE GEN JSON parsing error:', jsonError);
      return {
        success: false,
        error: language === 'ar' 
          ? 'خطأ في معالجة استجابة الخدمة' 
          : 'Error processing service response',
        imageUrl: null
      };
    }

    // Process the response
    if (responseData.data && responseData.data.length > 0) {
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      
      if (imageResult && imageResult.imageURL) {
        return {
          success: true,
          error: null,
          imageUrl: imageResult.imageURL,
          seed: imageResult.seed,
          cost: imageResult.cost
        };
      }
    }

    return {
      success: false,
      error: language === 'ar' 
        ? 'لم يتم إنشاء الصورة بنجاح' 
        : 'Image generation failed',
      imageUrl: null
    };

  } catch (error) {
    console.error('❌ IMAGE GEN: Critical error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      imageUrl: null
    };
  }
}
