
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const RW_PREFERRED_MODEL = Deno.env.get('RUNWARE_PREFERRED_MODEL') || 'runware:97@2';
const RW_FALLBACK_MODEL = Deno.env.get('RUNWARE_FALLBACK_MODEL') || 'runware:100@1';
const RW_STEPS = (() => {
  const v = parseInt(Deno.env.get('RUNWARE_STEPS') ?? '28', 10);
  if (Number.isNaN(v)) return 28;
  return Math.min(60, Math.max(4, v));
})();
const RW_CFG = (() => {
  const v = parseFloat(Deno.env.get('RUNWARE_CFG') ?? '5.5');
  if (Number.isNaN(v)) return 5.5;
  return Math.min(20, Math.max(1, v));
})();

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

// Generate image with Runware
async function generateImage(prompt: string, userId: string, language: string) {
  try {
    console.log("Generating image with Runware for prompt:", prompt);
    if (!RUNWARE_API_KEY) {
      throw new Error('RUNWARE_API_KEY not configured');
    }

    const taskUUID = crypto.randomUUID();
    const buildPayload = (model: string) => ([
      { taskType: 'authentication', apiKey: RUNWARE_API_KEY },
      {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: prompt,
        model,
        width: 512,
        height: 512,
        numberResults: 1,
        outputFormat: 'WEBP',
        includeCost: true,
        CFGScale: RW_CFG,
        scheduler: 'FlowMatchEulerDiscreteScheduler',
        steps: RW_STEPS,
      },
    ]);

    let modelUsed = RW_PREFERRED_MODEL;
    let response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(RW_PREFERRED_MODEL)),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('Preferred model failed:', response.status, errText);
      modelUsed = RW_FALLBACK_MODEL;
      response = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(RW_FALLBACK_MODEL)),
      });
    }

    console.log('Runware response status:', response.status, 'modelUsed:', modelUsed);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Runware API error:', response.status, errorText);
      throw new Error(`Runware API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Runware response data:', result);
    const imageResult = result.data?.find((item: any) => item.taskType === 'imageInference');
    if (!imageResult || !imageResult.imageURL) {
      throw new Error('No image URL in response');
    }

    // Create Supabase client to save image
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
      await supabase
        .from('images')
        .insert({
          user_id: userId,
          prompt,
          image_url: imageResult.imageURL,
          metadata: { provider: 'runware', imageUUID: imageResult.imageUUID, modelUsed }
        });
    } catch (dbError) {
      console.log('Could not save image to database:', dbError);
    }

    return {
      success: true,
      message: language === 'ar' ? 'تم إنشاء الصورة بنجاح' : 'Image generated successfully',
      imageUrl: imageResult.imageURL,
      modelUsed,
    };
  } catch (error) {
    console.error('Error generating image with Runware:', error);
    return {
      success: false,
      message: language === 'ar' ? 'فشل في إنشاء الصورة' : 'Failed to generate image',
      error: error.message
    };
  }
}
