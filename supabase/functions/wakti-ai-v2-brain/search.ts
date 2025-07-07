
/**
 * SIMPLIFIED: Search functionality with robust JSON parsing
 */

export async function executeRegularSearch(query: string, language: string = 'en') {
  const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
  
  console.log('🔍 SEARCH: Starting search for:', query.substring(0, 50));
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: 'Search service not configured',
      data: null,
      context: ''
    };
  }

  try {
    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SEARCH API ERROR:', response.status, errorText);
      throw new Error(`Search API error: ${response.status}`);
    }

    // Safe JSON parsing with validation
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from search service');
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      console.error('❌ Raw response:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from search service');
    }

    // Extract information safely
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result: any, index: number) => {
        if (result && typeof result === 'object') {
          context += `${index + 1}. ${result.title || 'No title'}\n`;
          context += `   ${result.content || 'No content'}\n`;
          context += `   Source: ${result.url || 'No URL'}\n\n`;
        }
      });
    }

    console.log(`✅ SEARCH: Found ${results.length} results`);
    return {
      success: true,
      error: null,
      data: {
        answer,
        results,
        query,
        total_results: results.length
      },
      context: context.trim()
    };

  } catch (error) {
    console.error('❌ SEARCH: Critical error:', error);
    
    return {
      success: false,
      error: 'Search failed',
      data: null,
      context: '',
      details: error.message
    };
  }
}
