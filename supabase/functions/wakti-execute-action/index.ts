import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const RUNWARE_API_KEY = "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, language } = await req.json();
    
    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: "Action and userId are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("Executing action:", action);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result = { success: false, message: '' };

    switch (action.type) {
      case 'create_task':
        result = await createTask(supabase, action.data, userId, language);
        break;
        
      case 'create_event':
        result = await createEvent(supabase, action.data, userId, language);
        break;
        
      case 'create_reminder':
        result = await createReminder(supabase, action.data, userId, language);
        break;
        
      case 'add_contact':
        result = await addContact(supabase, action.data, userId, language);
        break;
        
      case 'generate_image':
        result = await generateImage(action.prompt || action.data?.prompt, userId, language);
        break;
        
      case 'generate_photomaker':
        result = await generatePhotoMaker(action.prompt || action.data?.prompt, action.images || action.data?.images, userId, language);
        break;
        
      case 'upscale_image':
        result = await upscaleImage(action.imageUrl || action.data?.imageUrl, userId, language);
        break;
        
      case 'remove_background':
        result = await removeBackground(action.imageUrl || action.data?.imageUrl, userId, language);
        break;
        
      default:
        result = {
          success: false,
          message: language === 'ar' ? 'إجراء غير مدعوم' : 'Unsupported action'
        };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error executing action:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Create task
async function createTask(supabase: any, data: any, userId: string, language: string) {
  try {
    const { error } = await supabase
      .from('tasks')
      .insert({
        title: data.title || 'New Task',
        description: data.description || '',
        priority: data.priority || 'medium',
        due_date: data.dueDate || null,
        created_by: userId,
        status: 'pending'
      });

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' ? `تم إنشاء المهمة: ${data.title}` : `Task created: ${data.title}`
    };
  } catch (error) {
    console.error('Error creating task:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task'
    };
  }
}

// Create event
async function createEvent(supabase: any, data: any, userId: string, language: string) {
  try {
    const { error } = await supabase
      .from('maw3d_events')
      .insert({
        title: data.title || 'New Event',
        description: data.description || '',
        event_date: data.startTime ? new Date(data.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: data.startTime ? new Date(data.startTime).toTimeString().split(' ')[0] : null,
        end_time: data.endTime ? new Date(data.endTime).toTimeString().split(' ')[0] : null,
        location: data.location || '',
        created_by: userId,
        is_public: false
      });

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' ? `تم إنشاء الحدث: ${data.title}` : `Event created: ${data.title}`
    };
  } catch (error) {
    console.error('Error creating event:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الحدث' : 'Failed to create event'
    };
  }
}

// Create reminder
async function createReminder(supabase: any, data: any, userId: string, language: string) {
  try {
    const { error } = await supabase
      .from('reminders')
      .insert({
        title: data.title || 'New Reminder',
        due_date: data.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: userId,
        is_recurring: false
      });

    if (error) throw error;

    return {
      success: true,
      message: language === 'ar' ? `تم إنشاء التذكير: ${data.title}` : `Reminder created: ${data.title}`
    };
  } catch (error) {
    console.error('Error creating reminder:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder'
    };
  }
}

// Add contact
async function addContact(supabase: any, data: any, userId: string, language: string) {
  try {
    // This is a simplified version - in reality you'd handle contact invitations
    console.log('Contact addition requested:', data);
    
    return {
      success: true,
      message: language === 'ar' ? `تم طلب إضافة جهة الاتصال: ${data.name}` : `Contact addition requested: ${data.name}`
    };
  } catch (error) {
    console.error('Error adding contact:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إضافة جهة الاتصال' : 'Failed to add contact'
    };
  }
}

// Generate image with Runware using Juggernaut XL model
async function generateImage(prompt: string, userId: string, language: string) {
  try {
    console.log("Generating image with Runware for prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "civitai:133005@471120",
          width: 1024,
          height: 1024,
          numberResults: 1,
          outputFormat: "JPG",
          CFGScale: 7,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          steps: 25,
        },
      ]),
    });

    console.log("Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("Runware response data:", result);
      
      // Find the image inference result
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        // Create Supabase client to save image
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Save image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: prompt,
              image_url: imageResult.imageURL,
              metadata: { provider: 'runware', imageUUID: imageResult.imageUUID }
            });
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
          // Continue anyway, the image was generated successfully
        }

        return {
          success: true,
          message: language === 'ar' ? 'تم إنشاء الصورة بنجاح' : 'Image generated successfully',
          imageUrl: imageResult.imageURL
        };
      } else {
        throw new Error('No image URL in response');
      }
    } else {
      const errorText = await response.text();
      console.error("Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error generating image with Runware:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الصورة' : 'Failed to generate image',
      error: error.message
    };
  }
}

// Generate PhotoMaker personalized image with Runware
async function generatePhotoMaker(prompt: string, images: string[], userId: string, language: string) {
  try {
    console.log("Generating PhotoMaker image with Runware for prompt:", prompt);
    console.log("Number of face images:", images?.length || 0);

    // Auto-prepend 'rwre' if not already in prompt
    let enhancedPrompt = prompt;
    if (!prompt.toLowerCase().includes('rwre')) {
      enhancedPrompt = `rwre ${prompt}`;
    }

    // Validate images
    if (!images || images.length === 0) {
      throw new Error('At least 1 face image is required for PhotoMaker');
    }
    if (images.length > 4) {
      throw new Error('Maximum 4 images allowed for PhotoMaker');
    }

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "photoMaker",
          taskUUID: crypto.randomUUID(),
          positivePrompt: enhancedPrompt,
          model: "civitai:133005@471120", // Juggernaut XL
          width: 1024,
          height: 1024,
          strength: 15,
          style: "No style",
          outputFormat: "JPG",
          outputType: "URL",
          steps: 25,
          CFGScale: 7,
          inputImages: images, // Array of base64 or URL images
        },
      ]),
    });

    console.log("Runware PhotoMaker response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("Runware PhotoMaker response data:", result);
      
      // Find the photoMaker result
      const photoMakerResult = result.data?.find((item: any) => item.taskType === "photoMaker");
      
      if (photoMakerResult && photoMakerResult.imageURL) {
        // Create Supabase client to save image
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Save PhotoMaker image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: enhancedPrompt,
              image_url: photoMakerResult.imageURL,
              metadata: { 
                provider: 'runware', 
                imageUUID: photoMakerResult.imageUUID,
                type: 'photomaker',
                originalPrompt: prompt,
                imagesCount: images.length
              }
            });
        } catch (dbError) {
          console.log("Could not save PhotoMaker image to database:", dbError);
          // Continue anyway, the image was generated successfully
        }

        return {
          success: true,
          message: language === 'ar' ? 'تم إنشاء الصورة الشخصية بنجاح' : 'Personalized image generated successfully',
          imageUrl: photoMakerResult.imageURL
        };
      } else {
        throw new Error('No image URL in PhotoMaker response');
      }
    } else {
      const errorText = await response.text();
      console.error("Runware PhotoMaker API error:", response.status, errorText);
      throw new Error(`Runware PhotoMaker API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error generating PhotoMaker image with Runware:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الصورة الشخصية' : 'Failed to generate personalized image',
      error: error.message
    };
  }
}

// Upscale image with Runware
async function upscaleImage(imageUrl: string, userId: string, language: string) {
  try {
    console.log("Upscaling image with Runware for image:", imageUrl);

    // Validate input image
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Valid image URL is required for upscaling');
    }

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageUpscale",
          taskUUID: crypto.randomUUID(),
          inputImage: imageUrl,
          outputFormat: "JPG",
          outputType: "URL",
          upscaleFactor: 2,
          outputQuality: 95,
        },
      ]),
    });

    console.log("Runware upscale response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("Runware upscale response data:", result);
      
      // Find the image upscale result
      const upscaleResult = result.data?.find((item: any) => item.taskType === "imageUpscale");
      
      if (upscaleResult && upscaleResult.imageURL) {
        // Create Supabase client to save image
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Save upscaled image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: 'Image upscaling 2x',
              image_url: upscaleResult.imageURL,
              metadata: { 
                provider: 'runware', 
                imageUUID: upscaleResult.imageUUID,
                type: 'upscaling',
                originalImageUrl: imageUrl,
                upscaleFactor: 2,
                outputQuality: 95
              }
            });
        } catch (dbError) {
          console.log("Could not save upscaled image to database:", dbError);
          // Continue anyway, the image was upscaled successfully
        }

        return {
          success: true,
          message: language === 'ar' ? 'تم تحسين الصورة بنجاح (2x)' : 'Image upscaled successfully (2x)',
          imageUrl: upscaleResult.imageURL
        };
      } else {
        throw new Error('No image URL in upscale response');
      }
    } else {
      const errorText = await response.text();
      console.error("Runware upscale API error:", response.status, errorText);
      throw new Error(`Runware upscale API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error upscaling image with Runware:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في تحسين الصورة' : 'Failed to upscale image',
      error: error.message
    };
  }
}

// New function: Remove background with Runware
async function removeBackground(imageUrl: string, userId: string, language: string) {
  try {
    console.log("Removing background with Runware for image:", imageUrl);

    // Validate input image
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Valid image URL is required for background removal');
    }

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageBackgroundRemoval",
          taskUUID: crypto.randomUUID(),
          inputImage: imageUrl,
          outputFormat: "PNG",
          outputType: "URL",
          model: "runware:109@1",
          settings: {
            rgba: [255, 255, 255, 0],
            postProcessMask: true,
            returnOnlyMask: false,
            alphaMatting: true,
            alphaMattingForegroundThreshold: 240,
            alphaMattingBackgroundThreshold: 10,
            alphaMattingErodeSize: 10
          }
        },
      ]),
    });

    console.log("Runware background removal response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("Runware background removal response data:", result);
      
      // Find the background removal result
      const backgroundRemovalResult = result.data?.find((item: any) => item.taskType === "imageBackgroundRemoval");
      
      if (backgroundRemovalResult && backgroundRemovalResult.imageURL) {
        // Create Supabase client to save image
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Save background removed image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: 'Background removal',
              image_url: backgroundRemovalResult.imageURL,
              metadata: { 
                provider: 'runware', 
                imageUUID: backgroundRemovalResult.imageUUID,
                type: 'background_removal',
                originalImageUrl: imageUrl,
                model: "runware:109@1",
                outputFormat: "PNG"
              }
            });
        } catch (dbError) {
          console.log("Could not save background-removed image to database:", dbError);
          // Continue anyway, the image was processed successfully
        }

        return {
          success: true,
          message: language === 'ar' ? 'تم إزالة الخلفية بنجاح' : 'Background removed successfully',
          imageUrl: backgroundRemovalResult.imageURL
        };
      } else {
        throw new Error('No image URL in background removal response');
      }
    } else {
      const errorText = await response.text();
      console.error("Runware background removal API error:", response.status, errorText);
      throw new Error(`Runware background removal API failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error removing background with Runware:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إزالة الخلفية' : 'Failed to remove background',
      error: error.message
    };
  }
}
