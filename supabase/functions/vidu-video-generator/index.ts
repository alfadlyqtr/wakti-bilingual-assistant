
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const VIDU_API_KEY = Deno.env.get('VIDU_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Complete template configuration function
function getViduTemplateConfig(template: string, images: string[]) {
  const configs: Record<string, any> = {
    // CUSTOM MODE
    'image2video': {
      model: 'vidu2.0',
      images: images,
      prompt: 'Generate creative video animation',
      duration: 4,
      resolution: '720p',
      movement_amplitude: 'auto'
    },

    // FUN & INTERACTIVE CATEGORY
    'make_face': {
      template: 'make_face',
      images: images,
      prompt: 'The camera remains stationary. The subject stands still with hands on hips, head slightly tilted to the left, and a smiling expression. Then, the subject begins walking forward—directly toward the camera. Upon reaching the front of the lens, they simultaneously strike a playful pose and expression: mouth wide open, tongue sticking out, and eyes rolled upward.',
      seed: Math.floor(Math.random() * 1000000)
    },
    
    'blow_kiss': {
      template: 'blow_kiss',
      images: images,
      prompt: 'The subject gently leans forward, blows a kiss toward the camera from just below the lips using the right hand, then naturally waves at the camera. Afterward, she unfolds a sweet and warm smile.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'hair_swap': {
      template: 'hair_swap',
      images: images,
      prompt: 'The character transforms their hairstyle and color smoothly.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'flying': {
      template: 'flying',
      images: images,
      prompt: 'The character begins flying forward like a superhero through the air.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'nap_me': {
      template: 'nap_me',
      images: images,
      prompt: 'The character lies down and covers themselves with a blanket for sleep.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'pilot': {
      template: 'pilot',
      images: images,
      prompt: 'The character appears in an airplane cockpit as a pilot.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'interaction': {
      template: 'interaction',
      images: images,
      prompt: 'The two people in the picture face the camera, each extending a hand and making a heart shape in front of their chest.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'hugging_pro': {
      template: 'hugging_pro',
      images: images,
      prompt: 'The two subjects in the scene turn towards each other and begin to hug.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'carry_me': {
      template: 'carry_me',
      images: images,
      prompt: 'One person in the scene begins to carry another on their back.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'emotionlab': {
      template: 'emotionlab',
      images: images,
      prompt: 'The character transitions from neutral to smiling expression.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'wild_laugh': {
      template: 'emotionlab',
      images: images,
      prompt: 'The character breaks into wild laughter.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'surprised': {
      template: 'emotionlab',
      images: images,
      prompt: 'The character shows surprise expression.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'send_roses': {
      template: 'interaction',
      images: images,
      prompt: 'The person picks up roses and presents them to another person.',
      seed: Math.floor(Math.random() * 1000000)
    },

    // TRANSFORM & STYLE CATEGORY
    'cartoon_doll': {
      template: 'cartoon_doll',
      images: images,
      prompt: 'The character in the picture jumped, turning into a smooth doll version of themselves.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'style_me': {
      template: 'style_me',
      images: images,
      prompt: 'The character puts on a crisp suit and walks gracefully toward the camera.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'toy_me': {
      template: 'toy_me',
      images: images,
      prompt: 'The subject slowly turns around and transforms into a figurine on a base.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'muscling': {
      template: 'muscling',
      images: images,
      prompt: 'A man takes off his shirt, revealing his muscular chest.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'muscling_360p': {
      template: 'muscling_360p',
      images: images,
      prompt: 'Lower resolution muscle reveal animation.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'fairy_me': {
      template: 'fairy_me',
      images: images,
      prompt: 'The character transforms into a magical fairy with wings.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'yayoi_kusama_style': {
      template: 'yayoi_kusama_style',
      images: images,
      seed: Math.floor(Math.random() * 1000000)
      // NO PROMPT FIELD - this template doesn't need one!
    },

    'irasutoya': {
      template: 'irasutoya',
      images: images,
      prompt: 'Style transformation into Japanese illustration style.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'american_comic': {
      template: 'american_comic',
      images: images,
      prompt: 'Style transformation into Rick and Morty animation style.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'simpsons_comic': {
      template: 'simpsons_comic',
      images: images,
      prompt: 'Style transformation into Simpsons cartoon style.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'child_memory': {
      template: 'child_memory',
      images: images,
      prompt: 'A child version appears and embraces the subject.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'outfit_show': {
      template: 'outfit_show',
      images: images,
      prompt: 'The model turns 180 degrees to showcase clothing details.',
      bgm: true, // CRITICAL - BGM must be enabled for this template
      seed: Math.floor(Math.random() * 1000000)
    },

    'spin360': {
      template: 'spin360',
      images: images,
      prompt: 'The subject rotates 360 degrees to show all angles.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'live_memory': {
      template: 'live_memory',
      images: images,
      prompt: 'Subtle movements like blinking and breathing.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'sakura_season': {
      template: 'sakura_season',
      images: images,
      prompt: 'Cherry blossom petals fall while subject looks up smiling.',
      seed: Math.floor(Math.random() * 1000000)
    },

    // CAMERA & MOTION CATEGORY
    'zoom_in_fast': {
      template: 'zoom_in_fast',
      images: images,
      prompt: 'Camera steadily zooms in isolating details of the subject.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'zoom_out_image': {
      template: 'zoom_out_image',
      images: images,
      prompt: 'Camera pulls back revealing the surrounding environment.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'zoom_out_startend': {
      template: 'zoom_out_startend',
      images: images,
      prompt: 'Transition from close-up to wide shot between two images.',
      seed: Math.floor(Math.random() * 1000000)
    },

    'walk_forward': {
      template: 'walk_forward',
      images: images,
      prompt: 'Character walks forward toward camera naturally.',
      seed: Math.floor(Math.random() * 1000000)
    }
  };

  return configs[template];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { template, images, prompt, mode, user_id } = await req.json();
    
    console.log('🎬 VIDEO GEN: Starting', { 
      template, 
      mode, 
      imageCount: images?.length, 
      user_id,
      imageType: typeof images?.[0],
      imagesPreview: images?.slice(0, 2).map((img: string) => img.substring(0, 50) + '...')
    });
    
    if (!VIDU_API_KEY) {
      throw new Error('VIDU_API_KEY not configured');
    }

    if (!user_id) {
      throw new Error('user_id is required');
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error('At least one image URL is required');
    }

    // Validate that images are URLs, not base64
    const invalidImages = images.filter((img: string) => {
      return typeof img !== 'string' || (!img.startsWith('http') && !img.startsWith('https'));
    });

    if (invalidImages.length > 0) {
      console.error('❌ INVALID IMAGES:', invalidImages);
      throw new Error('All images must be valid URLs');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get template-specific configuration
    const templateConfig = getViduTemplateConfig(template, images);
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`);
    }

    // Choose Vidu API endpoint based on template type
    const isCustom = template === 'image2video';
    const apiUrl = isCustom 
      ? 'https://api.vidu.com/ent/v2/img2video'
      : 'https://api.vidu.com/ent/v2/template2video';
    
    // Add callback URL to ALL templates - CRITICAL REQUIREMENT
    const requestBody = {
      ...templateConfig,
      callback_url: 'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/vidu-callback-receiver'
    };
    
    console.log('🎬 CALLING VIDU API:', apiUrl);
    console.log('🎬 REQUEST BODY:', JSON.stringify(requestBody, null, 2));
    
    // Call Vidu API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${VIDU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ VIDU ERROR:', response.status, errorText);
      throw new Error(`Vidu API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ VIDU SUCCESS:', result.task_id);
    
    // FIXED: Store in database with EXPLICIT column names and proper array handling
    const { error: dbError } = await supabase
      .from('video_generation_tasks')
      .insert({
        task_id: result.task_id,
        user_id: user_id,
        template: template,
        mode: isCustom ? 'image2video' : 'template2video',
        prompt: templateConfig.prompt || 'No prompt specified',
        status: result.state || 'processing',
        images: images, // This should now be an array of URLs
        seed: templateConfig.seed || Math.floor(Math.random() * 1000000),
        duration: templateConfig.duration || 4,
        resolution: templateConfig.resolution || '720p',
        movement_amplitude: templateConfig.movement_amplitude || 'auto',
        bgm: templateConfig.bgm || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('❌ DB ERROR:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    
    console.log('✅ DATABASE: Task stored successfully');
    
    // Return success
    return new Response(JSON.stringify({
      success: true,
      job_id: result.task_id,
      status: result.state || 'processing',
      message: 'Video generation started with template-specific configuration',
      template_used: template,
      config_applied: templateConfig
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ VIDEO ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
