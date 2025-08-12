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

    // First, find the support ticket for this submission
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('id')
      .eq('user_id', userProfile.id)
      .eq('subject', subject || 'Your Support Request')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (ticketError) {
      console.log('No existing support ticket found, this is a contact form submission');
      // For contact form submissions, we'll create a notification instead
      // This ensures admin responses don't mix with regular user messages
      const notificationContent = `📧 Response from WAKTI Support\n\nRe: ${subject || 'Your Message'}\n\n${adminResponse.trim()}\n\n---\nWAKTI Support Team`;
      
      const { error: notificationError } = await supabaseAdmin
        .from('notification_queue')
        .insert({
          user_id: userProfile.id,
          notification_type: 'admin_response',
          title: 'Response from WAKTI Support',
          body: `You have received a response to your message: ${subject || 'Your Message'}`,
          data: {
            type: 'admin_response',
            subject: subject || 'Your Message',
            response: adminResponse.trim(),
            submission_id: submissionId
          },
          deep_link: '/help',
          status: 'pending',
          scheduled_for: new Date().toISOString()
        });

      if (notificationError) {
        console.error('Error creating admin response notification:', notificationError);
        return new Response(
          JSON.stringify({ error: 'Failed to send admin response notification', details: notificationError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin response notification queued successfully');
    } else {
      // This is a support ticket, add the message to the support system
      const { error: supportMessageError } = await supabaseAdmin
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'staff',
          message_body: adminResponse.trim(),
          created_at: new Date().toISOString()
        });

      if (supportMessageError) {
        console.error('Error adding support message:', supportMessageError);
        return new Response(
          JSON.stringify({ error: 'Failed to add support message', details: supportMessageError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Support message added successfully');
    }

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