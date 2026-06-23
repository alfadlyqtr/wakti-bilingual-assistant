import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Stock search is removed. Use Nano Banana image generation instead.',
      replacement: {
        function: 'wakti-text2image',
        model: 'nano-banana-2',
        provider: 'KIE',
        resolution: '1K',
      },
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
