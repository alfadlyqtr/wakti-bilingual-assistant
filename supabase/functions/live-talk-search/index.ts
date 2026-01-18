const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyResponse = {
  answer?: string | null;
  results?: TavilyResult[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const language = typeof body?.language === 'string' ? body.language : 'en';

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing query', context: '' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tavilyKey = Deno.env.get('TAVILY_API_KEY');
    if (!tavilyKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search service not configured', context: '' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchPayload = {
      api_key: tavilyKey,
      query,
      search_depth: 'basic',
      time_range: 'day',
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ success: false, error: `Tavily error: ${response.status}`, details: errorText, context: '' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = (await response.json()) as TavilyResponse;
    const results = Array.isArray(data?.results) ? data.results : [];
    const answer = typeof data?.answer === 'string' ? data.answer.trim() : '';

    const topLines = results.slice(0, 5).map((r, i) => {
      const title = r.title || `Result ${i + 1}`;
      const url = r.url || '';
      const snippet = (r.content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      return `${i + 1}. ${title}${url ? ` — ${url}` : ''}${snippet ? `\n   ${snippet}` : ''}`;
    });

    const contextParts = [
      answer ? `Answer:\n${answer}` : '',
      topLines.length ? `Top results:\n${topLines.join('\n')}` : '',
    ].filter(Boolean);

    const context = contextParts.join('\n\n');

    return new Response(
      JSON.stringify({ success: true, context, results, language }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, context: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
