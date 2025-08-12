import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, adminResponse, subject, submissionId, adminId } = await req.json();

    if (!userEmail || !adminResponse || !submissionId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userEmail, adminResponse, submissionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Looking for user with email:', userEmail);

    // Find the user profile by email
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError) {
      console.error('Error finding user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found user profile:', userProfile.id);

    // Update the contact submission with admin response
    const { error: updateError } = await supabaseAdmin
      .from('contact_submissions')
      .update({
        admin_response: adminResponse.trim(),
        status: 'responded',
        responded_at: new Date().toISOString(),
        responded_by: adminId,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update submission status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Contact submission updated successfully');

    // Send direct message to the user with admin response
    const messageContent = `📧 Response from WAKTI Support\n\nRe: ${subject || 'Your Message'}\n\n${adminResponse.trim()}\n\n---\nWAKTI Support Team`;
    
    const { error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: '00000000-0000-0000-0000-000000000001', // System profile
        recipient_id: userProfile.id,
        message_type: 'text',
        content: messageContent,
        created_at: new Date().toISOString()
      });

    if (messageError) {
      console.error('Error sending direct message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to send direct message', details: messageError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Direct message sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Response sent successfully via direct message' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reply-to-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});