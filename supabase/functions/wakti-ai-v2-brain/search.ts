
// WAKTI AI Search functionality with Tavily API - Fixed with proper timeouts
import { TAVILY_API_KEY } from './utils.ts';

export async function executeRegularSearch(query: string, language: string = 'en') {
  try {
    console.log('🔍 SEARCH: Starting Tavily search for:', query);
    
    if (!TAVILY_API_KEY) {
      console.error('❌ SEARCH: Tavily API key not configured');
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

    console.log('🔍 SEARCH: Calling Tavily API with enhanced timeout handling');

    // Enhanced timeout handling - 30 seconds for search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('🔍 SEARCH: Tavily response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SEARCH: Tavily API error:', response.status, errorText);
      return {
        success: false,
        error: `Search API error: ${response.status}`,
        data: null,
        context: ''
      };
    }

    const searchData = await response.json();
    console.log('🔍 SEARCH: Tavily response received successfully');

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

    console.log('✅ SEARCH: Successfully processed Tavily search results');
    console.log('🔍 SEARCH: Context length:', context.length);

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
    console.error('❌ SEARCH: Critical error in executeRegularSearch:', error);
    
    // Handle different error types
    let errorMessage = 'Search failed';
    if (error.name === 'AbortError') {
      errorMessage = 'Search request timed out';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
      data: null,
      context: ''
    };
  }
}
