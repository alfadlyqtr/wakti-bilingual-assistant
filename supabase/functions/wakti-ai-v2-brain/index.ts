import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to call Tavily API with different configurations
async function callTavilyAPI(query: string, isAdvanced: boolean = false) {
  const tavilyApiKey = Deno.env.get('TAVILY_API_KEY');
  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY is not configured');
  }

  const requestBody = {
    api_key: tavilyApiKey,
    query: query,
    search_depth: isAdvanced ? "advanced" : "basic",
    include_answer: true,
    include_images: true,
    include_raw_content: false,
    max_results: isAdvanced ? 5 : 3,
    chunks_per_source: isAdvanced ? 5 : 3,
    time_range: isAdvanced ? "year" : "month"
  };

  console.log(`🔍 Calling Tavily API with ${isAdvanced ? 'advanced' : 'basic'} search:`, {
    query,
    search_depth: requestBody.search_depth,
    max_results: requestBody.max_results,
    chunks_per_source: requestBody.chunks_per_source,
    time_range: requestBody.time_range
  });

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Tavily API error:', response.status, errorText);
    throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`✅ Tavily API response received (${isAdvanced ? 'advanced' : 'basic'}):`, {
    resultsCount: data.results?.length || 0,
    hasAnswer: !!data.answer,
    hasImages: !!data.images?.length
  });

  return data;
}

// Format advanced search results with enhanced presentation
function formatAdvancedSearchResults(data: any, query: string, language: string) {
  const isArabic = language === 'ar';
  
  let formattedResponse = `## 🔍 ${isArabic ? 'نتائج البحث المتقدم' : 'Advanced Search Results'}\n\n`;
  
  // Add search summary
  formattedResponse += `### ${isArabic ? '📊 ملخص البحث' : '📊 Search Summary'}\n`;
  formattedResponse += `**${isArabic ? 'الاستعلام:' : 'Query:**'} ${query}\n`;
  formattedResponse += `**${isArabic ? 'عمق البحث:' : 'Search Depth:**'} ${isArabic ? 'متقدم' : 'Advanced'}\n`;
  formattedResponse += `**${isArabic ? 'النتائج:' : 'Results:**'} ${data.results?.length || 0} ${isArabic ? 'مصادر شاملة' : 'comprehensive sources'}\n`;
  formattedResponse += `**${isArabic ? 'النطاق الزمني:' : 'Time Range:**'} ${isArabic ? 'العام الماضي' : 'Past year'}\n\n`;

  // Add main answer if available
  if (data.answer) {
    formattedResponse += `### ${isArabic ? '🎯 الإجابة الشاملة' : '🎯 Comprehensive Answer'}\n`;
    formattedResponse += `${data.answer}\n\n`;
  }

  // Add detailed results
  if (data.results && data.results.length > 0) {
    formattedResponse += `### ${isArabic ? '📚 المصادر التفصيلية' : '📚 Detailed Sources'}\n\n`;
    
    data.results.forEach((result: any, index: number) => {
      formattedResponse += `#### ${index + 1}. ${result.title}\n`;
      formattedResponse += `**${isArabic ? 'المصدر:' : 'Source:**'} [${new URL(result.url).hostname}](${result.url})\n`;
      if (result.published_date) {
        formattedResponse += `**${isArabic ? 'تاريخ النشر:' : 'Published:**'} ${result.published_date}\n`;
      }
      if (result.score) {
        formattedResponse += `**${isArabic ? 'الصلة:' : 'Relevance:**'} ${Math.round(result.score * 100)}%\n`;
      }
      formattedResponse += `\n${result.content}\n\n`;
      formattedResponse += `---\n\n`;
    });
  }

  // Add images if available
  if (data.images && data.images.length > 0) {
    formattedResponse += `### ${isArabic ? '🖼️ الصور ذات الصلة' : '🖼️ Related Images'}\n\n`;
    data.images.slice(0, 3).forEach((image: any, index: number) => {
      formattedResponse += `${index + 1}. ![${isArabic ? 'صورة' : 'Image'} ${index + 1}](${image.url})\n`;
      if (image.description) {
        formattedResponse += `   *${image.description}*\n`;
      }
      formattedResponse += `\n`;
    });
  }

  // Add comprehensive conclusion
  formattedResponse += `### ${isArabic ? '📝 الخلاصة الشاملة' : '📝 Comprehensive Conclusion'}\n`;
  formattedResponse += isArabic 
    ? `تم إجراء بحث متقدم شامل حول "${query}" باستخدام مصادر محدثة من العام الماضي. النتائج تشمل ${data.results?.length || 0} مصادر موثوقة مع تحليل عميق وشامل. هذا البحث المتقدم يوفر رؤى أكثر تفصيلاً وشمولية مقارنة بالبحث العادي.`
    : `A comprehensive advanced search has been conducted for "${query}" using up-to-date sources from the past year. The results include ${data.results?.length || 0} authoritative sources with deep and comprehensive analysis. This advanced search provides more detailed and comprehensive insights compared to standard search.`;

  formattedResponse += `\n\n---\n\n`;
  formattedResponse += `*${isArabic ? '🔬 بحث متقدم • نتائج شاملة • مصادر موثوقة' : '🔬 Advanced Search • Comprehensive Results • Authoritative Sources'}*`;

  return formattedResponse;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, activeTrigger, language = 'en', userContext } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Invalid messages format');
    }

    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;

    console.log('🤖 Wakti AI V2 Brain processing:', {
      activeTrigger,
      language,
      messageLength: userMessage.length,
      hasUserContext: !!userContext
    });

    let responseContent = '';
    let searchData = null;

    // Handle different trigger modes
    if (activeTrigger === 'search' || activeTrigger === 'advanced_search') {
      const isAdvanced = activeTrigger === 'advanced_search';
      console.log(`🔍 ${isAdvanced ? 'Advanced' : 'Basic'} search mode triggered for query:`, userMessage);
      
      try {
        searchData = await callTavilyAPI(userMessage, isAdvanced);
        
        if (isAdvanced) {
          // Format as advanced search results
          responseContent = formatAdvancedSearchResults(searchData, userMessage, language);
        } else {
          // Keep existing basic search formatting
          responseContent = searchData.answer || 'Search completed but no direct answer available.';
          
          if (searchData.results && searchData.results.length > 0) {
            responseContent += '\n\n**Sources:**\n';
            searchData.results.slice(0, 3).forEach((result: any, index: number) => {
              responseContent += `${index + 1}. [${result.title}](${result.url})\n`;
              responseContent += `   ${result.content.substring(0, 150)}...\n\n`;
            });
          }
        }
      } catch (error) {
        console.error(`❌ ${isAdvanced ? 'Advanced' : 'Basic'} search error:`, error);
        responseContent = language === 'ar' 
          ? `عذراً، حدث خطأ في ${isAdvanced ? 'البحث المتقدم' : 'البحث'}. يرجى المحاولة مرة أخرى.`
          : `Sorry, there was an error with the ${isAdvanced ? 'advanced search' : 'search'}. Please try again.`;
      }
    } else {
      // Handle other modes (chat, image, etc.) with existing logic
      const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!deepseekApiKey) {
        throw new Error('DEEPSEEK_API_KEY is not configured');
      }

      // ... keep existing chat/image logic unchanged
      const systemPrompt = language === 'ar' 
        ? 'أنت مساعد ذكي ومفيد. أجب باللغة العربية بطريقة واضحة ومفيدة.'
        : 'You are a helpful and intelligent assistant. Provide clear and useful responses.';

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      responseContent = data.choices[0].message.content;
    }

    return new Response(
      JSON.stringify({
        content: responseContent,
        searchData: searchData,
        activeTrigger: activeTrigger,
        language: language
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Wakti AI V2 Brain error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        content: 'Sorry, I encountered an error processing your request.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
