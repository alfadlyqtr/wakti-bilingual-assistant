
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🔍 Text Generator: Request received', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    console.log('🔍 Text Generator: Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔍 Text Generator: Processing request...')
    const requestBody = await req.json()
    console.log('🔍 Text Generator: Request body:', requestBody)
    
    const { mode, contentType, tone, length, format, to, from, originalMessage, replyType, topic } = requestBody

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      console.error('🔍 Text Generator: DeepSeek API key not configured')
      throw new Error('DeepSeek API key not configured')
    }
    console.log('🔍 Text Generator: API key found')

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
      console.log('🔍 Text Generator: Compose mode')
      systemPrompt = `You are a professional text generator. Create ${contentType.toLowerCase()} content that is ${tone.toLowerCase()} in tone. 

Length: ${lengthMap[length]}
Format: ${formatMap[format]}

${to ? `Recipient: ${to}` : ''}
${from ? `Sender: ${from}` : ''}

Focus on clarity, appropriate tone, and meeting the exact requirements specified.`

      userPrompt = topic ? `Please write a ${contentType.toLowerCase()} about: ${topic}` : `Please write a ${contentType.toLowerCase()}.`
    } else {
      console.log('🔍 Text Generator: Reply mode')
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

    console.log('🔍 Text Generator: Calling DeepSeek API...')
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

    console.log('🔍 Text Generator: DeepSeek API response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error('🔍 Text Generator: DeepSeek API error:', errorData)
      throw new Error(errorData.error?.message || 'Failed to generate text')
    }

    const data = await response.json()
    console.log('🔍 Text Generator: DeepSeek API success')
    const generatedText = data.choices[0].message.content

    console.log('🔍 Text Generator: Returning generated text')
    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('🔍 Text Generator: Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
