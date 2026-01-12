import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FREEPIK_API_URL = 'https://api.freepik.com/v1/resources';

interface FreepikSearchParams {
  term: string;
  filters?: {
    orientation?: {
      landscape?: number;
      portrait?: number;
      square?: number;
      panoramic?: number;
    };
    content_type?: {
      photo?: number;
      vector?: number;
      psd?: number;
    };
    people?: {
      include?: number;
      exclude?: number;
    };
    color?: string;
  };
  page?: number;
  limit?: number;
  language?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get API key from environment variables
    const apiKey = Deno.env.get('FREEPIK_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Freepik API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get request parameters
    const { term, filters, page = 1, limit = 10, language = 'en-US' } = await req.json() as FreepikSearchParams;

    if (!term) {
      return new Response(
        JSON.stringify({ error: 'Search term is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.append('term', term);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    // Add filters if provided
    if (filters) {
      // Orientation filters
      if (filters.orientation) {
        Object.entries(filters.orientation).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(`filters[orientation][${key}]`, value.toString());
          }
        });
      }
      
      // Content type filters
      if (filters.content_type) {
        Object.entries(filters.content_type).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(`filters[content_type][${key}]`, value.toString());
          }
        });
      }
      
      // People filters
      if (filters.people) {
        Object.entries(filters.people).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(`filters[people][${key}]`, value.toString());
          }
        });
      }
      
      // Color filter
      if (filters.color) {
        params.append('filters[color]', filters.color);
      }
    }

    // Make request to Freepik API
    const response = await fetch(`${FREEPIK_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-freepik-api-key': apiKey,
        'Accept-Language': language,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Freepik API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Freepik API error: ${response.status}`,
          details: errorText
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('Error processing request:', error);
    
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
