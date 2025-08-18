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
    const { submissionId, adminResponse, adminId } = await req.json();

    if (!submissionId || !adminResponse) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: submissionId, adminResponse' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing admin reply for submission:', submissionId);

    // Get the contact submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, email, name, messages')
      .eq('id', submissionId)
      .single();

    if (submissionError) {
      console.error('Error finding submission:', submissionError);
      return new Response(
        JSON.stringify({ error: 'Contact submission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found submission for email:', submission.email);

    // Map Supabase Auth user ID to admin_users.id for FK correctness
    const { data: adminLookup, error: adminLookupError } = await supabaseAdmin
      .rpc('get_admin_by_auth_id', { auth_user_id: adminId });
    if (adminLookupError) {
      console.error('Error looking up admin by auth id:', adminLookupError);
    }
    const adminUserId = Array.isArray(adminLookup) && adminLookup.length > 0
      ? (adminLookup[0] as any).admin_id
      : null;

    // Add admin reply as a chat message
    const { error: chatError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        contact_submission_id: submissionId,
        sender_type: 'admin',
        sender_id: adminUserId,
        content: adminResponse.trim()
      });

    if (chatError) {
      console.error('Error adding chat message:', chatError);
      return new Response(
        JSON.stringify({ error: 'Failed to add chat message', details: chatError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare message object for the JSON messages array used by the UI
    const adminMsg = {
      content: adminResponse.trim(),
      sender_type: 'admin',
      sender_id: adminUserId || null,
      sender_name: 'WAKTI Support',
      created_at: new Date().toISOString()
    };

    // Safely append to existing messages array (if present)
    const existingMessages = Array.isArray((submission as any)?.messages) ? (submission as any).messages : [];
    const updatedMessages = [...existingMessages, adminMsg];

    // Update the contact submission with status, response, and messages (for current UI)
    const { error: updateError } = await supabaseAdmin
      .from('contact_submissions')
      .update({
        status: 'responded',
        responded_at: new Date().toISOString(),
        responded_by: adminUserId,
        updated_at: new Date().toISOString(),
        admin_response: adminResponse.trim(),
        messages: updatedMessages
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update submission status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin reply added to chat successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin reply added to chat successfully' 
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