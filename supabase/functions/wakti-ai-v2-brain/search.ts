
// FIXED: Search functionality with proper JSON parsing
import { TAVILY_API_KEY } from './utils.ts';

export async function executeRegularSearch(query: string, language: string = 'en') {
  try {
    console.log('🔍 SEARCH: Starting search for:', query);
    
    if (!TAVILY_API_KEY) {
      return {
        success: false,
        error: 'Search service not configured',
        data: null,
        context: ''
      };
    }

    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
      include_domains: [],
      exclude_domains: []
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Search API error: ${response.status}`,
        data: null,
        context: ''
      };
    }

    // Safe JSON parsing
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      return {
        success: false,
        error: 'Empty response from search service',
        data: null,
        context: ''
      };
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      return {
        success: false,
        error: 'Error processing search response',
        data: null,
        context: ''
      };
    }

    // Extract relevant information
    const results = searchData.results || [];
    const answer = searchData.answer || '';
    
    // Build context from search results
    let context = '';
    if (answer) {
      context += `Search Answer: ${answer}\n\n`;
    }
    
    if (results.length > 0) {
      context += 'Search Results:\n';
      results.forEach((result: any, index: number) => {
        context += `${index + 1}. ${result.title}\n`;
        context += `   ${result.content}\n`;
        context += `   Source: ${result.url}\n\n`;
      });
    }

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
      context: ''
    };
  }
}
