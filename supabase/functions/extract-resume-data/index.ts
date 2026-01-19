import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, mimeType } = await req.json();

    if (!fileContent) {
      return new Response(
        JSON.stringify({ error: 'No file content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API keys
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!anthropicKey && !openaiKey) {
      throw new Error('No AI API key configured');
    }

    let extractedText = '';
    
    // Try Claude first (better at document understanding)
    if (anthropicKey) {
      try {
        console.log('Attempting extraction with Claude...');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: {
                      type: 'base64',
                      media_type: mimeType || 'application/pdf',
                      data: fileContent,
                    },
                  },
                  {
                    type: 'text',
                    text: `Extract contact and professional information from this resume/CV document. Return ONLY a valid JSON object with these fields:
{
  "firstName": "string or null",
  "lastName": "string or null", 
  "email": "string or null",
  "phone": "string or null",
  "companyName": "most recent company or null",
  "jobTitle": "most recent job title or null",
  "website": "personal website or LinkedIn URL or null"
}

Rules:
- Extract ONLY what you can clearly identify
- For names, split into first and last name
- For phone, include country code if present
- For company, use the most recent/current employer
- For job title, use the most recent/current position
- Return null for any field you cannot find
- Return ONLY the JSON object, no other text`
                  }
                ]
              }
            ],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          extractedText = result.content?.[0]?.text || '';
          console.log('Claude extraction successful');
        } else {
          const errorText = await response.text();
          console.error('Claude API error:', errorText);
          throw new Error('Claude failed');
        }
      } catch (claudeError) {
        console.error('Claude extraction failed:', claudeError);
        // Fall through to OpenAI
      }
    }
    
    // Fallback to OpenAI if Claude failed or not available
    if (!extractedText && openaiKey) {
      console.log('Attempting extraction with OpenAI...');
      // OpenAI can't read PDFs directly, so we'll ask it to extract from the base64 text representation
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a resume/CV data extractor. The user will provide a base64 encoded document. Try to decode and extract any readable text patterns (emails, phone numbers, names) and return ONLY a valid JSON object with these fields:
{
  "firstName": "string or null",
  "lastName": "string or null", 
  "email": "string or null",
  "phone": "string or null",
  "companyName": "most recent company or null",
  "jobTitle": "most recent job title or null",
  "website": "personal website or LinkedIn URL or null"
}

Look for patterns like:
- Email: anything@domain.com
- Phone: +XX XXX XXX XXXX or similar
- Names: usually at the top of the document
- Job titles: Software Engineer, Manager, etc.

Return null for any field you cannot find. Return ONLY the JSON object.`
            },
            {
              role: 'user',
              content: `Extract information from this resume (filename: ${fileName}). Here's the base64 content (look for readable text patterns): ${fileContent.substring(0, 15000)}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      extractedText = result.choices?.[0]?.message?.content || '';
    }
    
    if (!extractedText) {
      throw new Error('No AI service could extract the data');
    }

    // Parse the JSON response
    let extracted = null;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedText = extractedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();
      
      extracted = JSON.parse(cleanedText);
    } catch (_parseError) {
      console.error('Failed to parse extracted data:', extractedText);
      // Try to extract with regex as fallback
      extracted = {
        firstName: null,
        lastName: null,
        email: extractedText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || null,
        phone: extractedText.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/)?.[0] || null,
        companyName: null,
        jobTitle: null,
        website: null,
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        extracted,
        rawResponse: extractedText 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error extracting resume data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract resume data';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        extracted: null 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
