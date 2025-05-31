
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mode, contentType, tone, length, format, to, from, originalMessage, replyType, topic } = await req.json()

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      throw new Error('DeepSeek API key not configured')
    }

    let systemPrompt = ''
    let userPrompt = ''

    // Length mapping
    const lengthMap = {
      'Short': '1-2 paragraphs (50-100 words)',
      'Medium': '3-4 paragraphs (150-300 words)', 
      'Long': '5+ paragraphs (400+ words)'
    }

    // Format instructions
    const formatMap = {
      'Plain': 'Write in continuous text format.',
      'Bullet Points': 'Use bullet points and clear structure.',
      'Paragraphs': 'Organize into well-structured paragraphs with clear topic sentences.'
    }

    if (mode === 'compose') {
      systemPrompt = `You are a professional text generator. Create ${contentType.toLowerCase()} content that is ${tone.toLowerCase()} in tone. 

Length: ${lengthMap[length]}
Format: ${formatMap[format]}

${to ? `Recipient: ${to}` : ''}
${from ? `Sender: ${from}` : ''}

Focus on clarity, appropriate tone, and meeting the exact requirements specified.`

      userPrompt = topic ? `Please write a ${contentType.toLowerCase()} about: ${topic}` : `Please write a ${contentType.toLowerCase()}.`
    } else {
      // Reply mode
      systemPrompt = `You are writing a ${replyType.toLowerCase()} reply. Be ${tone.toLowerCase()} in tone and keep it ${lengthMap[length]}.

${formatMap[format]}

${to ? `To: ${to}` : ''}
${from ? `From: ${from}` : ''}

Write a direct reply that addresses the original message appropriately.`

      userPrompt = `Original message to reply to:
"${originalMessage}"

Please write an appropriate reply.`
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to generate text')
    }

    const data = await response.json()
    const generatedText = data.choices[0].message.content

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in text-generator function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
