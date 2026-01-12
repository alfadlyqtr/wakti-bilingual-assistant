import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the service parameter from the request
    const { service } = await req.json();
    
    if (!service) {
      return new Response(
        JSON.stringify({ error: 'Service parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the appropriate API key based on the requested service
    let apiKey = null;
    
    switch (service.toLowerCase()) {
      case 'freepik':
        apiKey = Deno.env.get('FREEPIK_API_KEY');
        break;
      case 'elevenlabs':
        apiKey = Deno.env.get('ELEVENLABS_API_KEY');
        break;
      case 'runware':
        apiKey = Deno.env.get('RUNWARE_API_KEY');
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported service: ${service}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key for ${service} is not configured` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return the API key
    return new Response(
      JSON.stringify({ apiKey }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
