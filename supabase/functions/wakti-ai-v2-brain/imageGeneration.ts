
/**
 * SIMPLIFIED: Image generation with robust error handling
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
        console.log('✅ IMAGE GEN: Successfully generated image');
        return {
          success: true,
          error: null,
          imageUrl: imageResult.imageURL
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
