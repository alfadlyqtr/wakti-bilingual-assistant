import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WOLFRAM_APP_ID = Deno.env.get('WOLFRAM_APP_ID') || 'H2PK3P9R7E';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WolframPod {
  title: string;
  id: string;
  primary?: boolean;
  subpods: Array<{
    title?: string;
    plaintext?: string;
    img?: { src: string; alt: string };
  }>;
}

interface WolframResult {
  success: boolean;
  error?: string;
  answer?: string;
  steps?: string[];
  plots?: Array<{ title: string; imageUrl: string }>;
  pods?: WolframPod[];
  inputInterpretation?: string;
  domain?: string;
}

/**
 * Calls Wolfram|Alpha Full Results API and extracts structured data
 */
async function queryWolfram(input: string, includeSteps: boolean = false): Promise<WolframResult> {
  try {
    // Build query URL
    const params = new URLSearchParams({
      appid: WOLFRAM_APP_ID,
      input: input,
      output: 'json',
      format: 'plaintext,image',
      units: 'metric',
      reinterpret: 'true',
    });

    // Request step-by-step if needed (for Study mode)
    if (includeSteps) {
      params.append('podstate', 'Step-by-step solution');
    }

    const url = `https://api.wolframalpha.com/v2/query?${params.toString()}`;
    console.log('🔢 WOLFRAM: Querying:', input.substring(0, 50));

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WOLFRAM API ERROR:', response.status, errorText);
      return { success: false, error: `Wolfram API error: ${response.status}` };
    }

    const data = await response.json();
    const queryResult = data?.queryresult;

    if (!queryResult || queryResult.success === false || queryResult.error === true) {
      console.log('⚠️ WOLFRAM: No results or error');
      return { 
        success: false, 
        error: queryResult?.error?.msg || 'No results found' 
      };
    }

    // Extract pods
    const pods: WolframPod[] = queryResult.pods || [];
    
    // Find primary result
    let answer: string | undefined;
    let inputInterpretation: string | undefined;
    const steps: string[] = [];
    const plots: Array<{ title: string; imageUrl: string }> = [];

    for (const pod of pods) {
      const podId = pod.id?.toLowerCase() || '';
      const podTitle = pod.title || '';

      // Input interpretation
      if (podId === 'input' || podTitle.toLowerCase().includes('input')) {
        const text = pod.subpods?.[0]?.plaintext;
        if (text) inputInterpretation = text;
      }

      // Primary result / answer
      if (pod.primary || podId === 'result' || podId === 'solution' || podId === 'value') {
        const text = pod.subpods?.[0]?.plaintext;
        if (text && !answer) answer = text;
      }

      // Decimal approximation as fallback answer
      if (!answer && (podId.includes('decimal') || podTitle.toLowerCase().includes('decimal'))) {
        const text = pod.subpods?.[0]?.plaintext;
        if (text) answer = text;
      }

      // Step-by-step solutions
      if (podTitle.toLowerCase().includes('step') || podId.includes('step')) {
        for (const subpod of pod.subpods || []) {
          if (subpod.plaintext) {
            steps.push(subpod.plaintext);
          }
        }
      }

      // Plots and images
      for (const subpod of pod.subpods || []) {
        if (subpod.img?.src) {
          plots.push({
            title: subpod.title || pod.title || 'Plot',
            imageUrl: subpod.img.src,
          });
        }
      }
    }

    // If no primary answer found, try to get from first pod with plaintext
    if (!answer) {
      for (const pod of pods) {
        if (pod.id !== 'Input') {
          const text = pod.subpods?.[0]?.plaintext;
          if (text) {
            answer = text;
            break;
          }
        }
      }
    }

    console.log(`✅ WOLFRAM: Got answer, ${steps.length} steps, ${plots.length} plots`);

    return {
      success: true,
      answer,
      steps: steps.length > 0 ? steps : undefined,
      plots: plots.length > 0 ? plots.slice(0, 3) : undefined, // Limit plots
      pods,
      inputInterpretation,
      domain: queryResult.datatypes || undefined,
    };

  } catch (error) {
    console.error('❌ WOLFRAM: Exception:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Detects if a query is likely to benefit from Wolfram|Alpha
 * Used for Chat mode facts booster
 */
function shouldUseWolfram(query: string): boolean {
  const q = query.toLowerCase();
  
  // Math patterns
  const mathPatterns = [
    /\d+\s*[\+\-\*\/\^]\s*\d+/,           // Basic arithmetic
    /\bsolve\b/i,                          // Solve equations
    /\bintegra[lt]/i,                      // Integrals
    /\bderivative\b/i,                     // Derivatives
    /\blimit\b/i,                          // Limits
    /\bfactor\b/i,                         // Factoring
    /\bsimplify\b/i,                       // Simplification
    /\bequation\b/i,                       // Equations
    /∫|∑|∏|√|π|∞/,                         // Math symbols
    /\bsin\b|\bcos\b|\btan\b|\blog\b|\bln\b/, // Trig/log functions
  ];

  // Science/data patterns
  const sciencePatterns = [
    /\b(distance|far|km|miles?|meters?)\b.*\b(from|to|between)\b/i,
    /\bconvert\b.*\b(to|into)\b/i,
    /\bpopulation\b/i,
    /\bgravity\b/i,
    /\bspeed of\b/i,
    /\batomic\b/i,
    /\bmolecular\b/i,
    /\bchemical\b/i,
    /\bplanet\b/i,
    /\bstar\b/i,
    /\btemperature\b/i,
    /\bcurrency\b|\bexchange rate\b/i,
    /\bcalories?\b/i,
    /\bnutrition\b/i,
    /\bloan\b.*\bpayment\b/i,
    /\binterest\b.*\brate\b/i,
  ];

  // Check math patterns
  for (const pattern of mathPatterns) {
    if (pattern.test(q)) return true;
  }

  // Check science patterns
  for (const pattern of sciencePatterns) {
    if (pattern.test(q)) return true;
  }

  // Contains numbers with units
  if (/\d+\s*(km|m|cm|mm|ft|in|mi|kg|g|lb|oz|l|ml|gal|°[CF]|mph|kph)/i.test(q)) {
    return true;
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, mode = 'chat', language = 'en' } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Query required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For chat mode, check if query is suitable for Wolfram
    if (mode === 'chat' && !shouldUseWolfram(query)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          skipped: true,
          reason: 'Query not suitable for computational answer' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query Wolfram|Alpha
    const includeSteps = mode === 'study';
    const result = await queryWolfram(query, includeSteps);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ WOLFRAM FUNCTION ERROR:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
