import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ticket_id } = await req.json();

    if (action === 'close_now' && ticket_id) {
      // Manual close: delete attachments and ticket
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('user_id')
        .eq('id', ticket_id)
        .single();

      if (ticket) {
        // Delete all files in user's ticket folder
        const folderPath = `${ticket.user_id}/${ticket_id}/`;
        
        const { data: files } = await supabase.storage
          .from('support-attachments')
          .list(folderPath.replace(/\/$/, ''));

        if (files && files.length > 0) {
          const filePaths = files.map(file => `${folderPath}${file.name}`);
          await supabase.storage
            .from('support-attachments')
            .remove(filePaths);
        }

        // Delete the ticket (cascades to messages)
        await supabase
          .from('support_tickets')
          .delete()
          .eq('id', ticket_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'auto') {
      // Auto cleanup: find and delete inactive tickets
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: inactiveTickets } = await supabase
        .from('support_tickets')
        .select('id, user_id')
        .in('status', ['open', 'pending', 'solved'])
        .lt('last_activity_at', sevenDaysAgo);

      if (inactiveTickets && inactiveTickets.length > 0) {
        for (const ticket of inactiveTickets) {
          // Delete attachments
          const folderPath = `${ticket.user_id}/${ticket.id}/`;
          
          const { data: files } = await supabase.storage
            .from('support-attachments')
            .list(folderPath.replace(/\/$/, ''));

          if (files && files.length > 0) {
            const filePaths = files.map(file => `${folderPath}${file.name}`);
            await supabase.storage
              .from('support-attachments')
              .remove(filePaths);
          }

          // Set closed_at and delete ticket
          await supabase
            .from('support_tickets')
            .update({ closed_at: new Date().toISOString() })
            .eq('id', ticket.id);

          await supabase
            .from('support_tickets')
            .delete()
            .eq('id', ticket.id);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        cleaned: inactiveTickets?.length || 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in support-ticket-maintenance:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});