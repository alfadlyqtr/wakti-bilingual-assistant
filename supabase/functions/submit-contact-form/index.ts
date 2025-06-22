
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { name, email, subject, message, submissionType } = await req.json()

    console.log('Submitting contact form:', { name, email, subject, submissionType })

    // Insert into contact_submissions table
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert({
        name,
        email,
        subject,
        message,
        submission_type: submissionType || 'contact'
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting contact submission:', error)
      throw error
    }

    console.log('Contact form submitted successfully:', data.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Form submitted successfully',
        id: data.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in submit-contact-form:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
