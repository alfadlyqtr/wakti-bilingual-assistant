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

    const WAKTI_SUPPORT_ID = '00000000-0000-0000-0000-000000000001';
    
    // Create/ensure WAKTI SUPPORT system profile exists
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: WAKTI_SUPPORT_ID,
        display_name: 'WAKTI SUPPORT',
        email: 'support@wakti.app',
        avatar_url: '/lovable-uploads/logo.png',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error creating/updating WAKTI SUPPORT profile:', profileError);
    } else {
      console.log('WAKTI SUPPORT profile ensured');
    }

    // Add WAKTI SUPPORT to user's contacts if not already added
    const { error: contactError } = await supabaseAdmin
      .from('contacts')
      .upsert({
        user_id: userProfile.id,
        contact_id: WAKTI_SUPPORT_ID,
        status: 'accepted',
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,contact_id' });

    if (contactError) {
      console.error('Error creating contact relationship:', contactError);
    } else {
      console.log('Contact relationship ensured');
    }

    // Send the admin response as a direct message from WAKTI SUPPORT
    const messageContent = `Re: ${subject || 'Your Message'}\n\n${adminResponse.trim()}`;
    
    const { error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: WAKTI_SUPPORT_ID,
        recipient_id: userProfile.id,
        message_type: 'text',
        content: messageContent,
        created_at: new Date().toISOString(),
        is_read: false
      });

    if (messageError) {
      console.error('Error sending direct message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to send direct message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Direct message sent successfully');

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

    console.log('Submission updated successfully');

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