
import { DEEPSEEK_API_KEY } from "./utils.ts";

export async function processWithBuddyChatAI(
  userMessage: string, 
  context: string | null, 
  language: string,
  tools: any[] = [],
  knowledgeContext: string = '',
  trigger: string = 'chat',
  analysisType: string = 'direct_chat',
  attachedFiles: any[] = []
) {
  console.log('🤖 BUDDY-CHAT AI: Ultra-fast processing initiated');
  
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured');
  }

  try {
    // ULTRA-FAST: Minimal system prompt for speed
    let systemPrompt = "You are Wakti AI, a helpful assistant.";
    
    // Add language-specific instructions only if needed
    if (language === 'ar') {
      systemPrompt += " Respond in Arabic.";
    }
    
    // ULTRA-FAST: Minimal context building
    let messages = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add context only if it's short and relevant
    if (context && context.length < 500) {
      messages.push({ role: "system", content: `Context: ${context}` });
    }
    
    // Handle attached files (vision)
    if (attachedFiles && attachedFiles.length > 0) {
      const userContent = [
        { type: "text", text: userMessage }
      ];
      
      // Add first image only for speed (limit to 1 image)
      const firstImage = attachedFiles[0];
      if (firstImage && firstImage.type === 'image_url') {
        userContent.push(firstImage);
      }
      
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

    // ULTRA-FAST: Optimized API call with speed settings
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.3, // Lower temperature for faster, more predictable responses
        max_tokens: 800, // Reduced from 1200 for speed
        top_p: 0.8, // Lower top_p for faster generation
        frequency_penalty: 0,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from DeepSeek');
    }

    console.log('🤖 BUDDY-CHAT AI: Ultra-fast response generated');
    return content.trim();

  } catch (error) {
    console.error('🤖 BUDDY-CHAT AI Error:', error);
    
    // Fallback response for speed
    const fallbackMessage = language === 'ar' 
      ? 'عذراً، حدث خطأ مؤقت. يرجى المحاولة مرة أخرى.'
      : 'Sorry, there was a temporary error. Please try again.';
    
    return fallbackMessage;
  }
}
