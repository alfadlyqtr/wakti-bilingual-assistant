import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fal } from "npm:@fal-ai/client@latest";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade") || "";
  
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const FAL_KEY = Deno.env.get('FAL_KEY');
  if (!FAL_KEY) {
    console.error('❌ FAL_KEY not configured');
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Configure fal.ai client with our API key
  fal.config({ credentials: FAL_KEY });

  console.log('🚀 WebSocket upgrade requested for wakti-co-draw');

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log('✅ WebSocket connection established');
      socket.send(JSON.stringify({ 
        type: 'connected',
        message: 'Ready for real-time drawing enhancement'
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received generation request');

        if (!data.imageBase64 || !data.prompt) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing imageBase64 or prompt'
          }));
          return;
        }

        const strength = data.strength || 0.7;

        console.log(`🎨 Triggering fal.ai generation (strength: ${strength})`);

        // Correctly handle the async iterator stream
        let finalResult = null;
        
        // Iterate over the stream to get the final result object
        for await (const update of fal.subscribe("fal-ai/fast-lightning-sdxl/image-to-image", {
          input: {
            image_url: data.imageBase64,
            prompt: `A highly detailed, cinematic, professional digital painting of ${data.prompt}, enhancing the original doodle while strictly adhering to the sketch lines. Volumetric lighting, hyper-detailed, 8k, concept art.`,
            strength: strength,
            num_inference_steps: 4,
            guidance_scale: 2.0,
            output_format: "jpeg",
            enable_safety_checker: false
          },
          logs: true,
          onQueueUpdate: (update) => {
            console.log('Queue update:', update.status);
            socket.send(JSON.stringify({
              type: 'progress',
              status: update.status
            }));
          }
        })) {
          // The final result is the last item yielded by the stream
          finalResult = update;
        }
        
        console.log('🎨 Generation result:', finalResult);
        
        if (finalResult?.images && finalResult.images.length > 0) {
          console.log('✅ Generation complete');
          socket.send(JSON.stringify({
            type: 'image',
            data: finalResult.images[0].url
          }));
        } else {
          console.error('❌ No images in response');
          socket.send(JSON.stringify({
            type: 'error',
            message: 'No images generated'
          }));
        }

      } catch (err: any) {
        console.error('❌ Generation error:', err);
        socket.send(JSON.stringify({
          type: 'error',
          message: err.message || 'Generation failed'
        }));
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('🔌 WebSocket connection closed');
    };

    return response;

  } catch (error: any) {
    console.error('❌ WebSocket upgrade failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
