import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-session',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          }
        }
      }
    );

    const requestBody = await req.json();
    const { action, session_token, ...payload } = requestBody;
    
    // Get admin session token from header or body
    const adminToken = req.headers.get('x-admin-session') || session_token;
    
    if (!adminToken) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: { code: 'NO_TOKEN', message: 'Admin session token required' } 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate admin session using existing mechanism
    const { data: adminSession, error: sessionError } = await supabase.rpc('validate_admin_session', {
      p_session_token: adminToken
    });

    if (sessionError || !adminSession || adminSession.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: { code: 'INVALID_SESSION', message: 'Invalid or expired admin session' } 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminInfo = adminSession[0];
    
    // Handle different actions
    switch (action) {
      case 'list_tickets': {
        const { status, type, page = 1, limit = 20 } = payload;
        const offset = (page - 1) * limit;
        
        let query = supabase
          .from('support_tickets')
          .select(`
            *,
            profiles (display_name, email)
          `)
          .order('last_activity_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        
        if (type && type !== 'all') {
          query = query.eq('type', type);
        }
        
        const { data, error } = await query;
        
        if (error) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'DB_ERROR', message: error.message } 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ ok: true, tickets: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'get_ticket': {
        const { ticket_id } = payload;
        
        if (!ticket_id) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'MISSING_PARAM', message: 'ticket_id is required' } 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Get ticket details
        const { data: ticket, error: ticketError } = await supabase
          .from('support_tickets')
          .select(`
            *,
            profiles (display_name, email)
          `)
          .eq('id', ticket_id)
          .single();
        
        if (ticketError || !ticket) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'NOT_FOUND', message: 'Ticket not found' } 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Get messages
        const { data: messages, error: messagesError } = await supabase
          .from('support_messages')
          .select(`
            *,
            profiles (display_name)
          `)
          .eq('ticket_id', ticket_id)
          .order('created_at', { ascending: true });
        
        if (messagesError) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'DB_ERROR', message: messagesError.message } 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ 
          ok: true, 
          ticket, 
          messages: messages || [] 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'reply_ticket': {
        const { ticket_id, body, attachments = [] } = payload;
        
        if (!ticket_id || !body?.trim()) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'MISSING_PARAM', message: 'ticket_id and body are required' } 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Insert staff message
        const { error: messageError } = await supabase
          .from('support_messages')
          .insert({
            ticket_id,
            sender_id: adminInfo.admin_id,
            role: 'staff',
            body: body.trim(),
            attachments
          });
        
        if (messageError) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'DB_ERROR', message: messageError.message } 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Update ticket status and last activity
        const { error: updateError } = await supabase
          .from('support_tickets')
          .update({ 
            status: 'pending',
            last_activity_at: new Date().toISOString() 
          })
          .eq('id', ticket_id);
        
        if (updateError) {
          console.error('Error updating ticket:', updateError);
        }
        
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'close_ticket': {
        const { ticket_id } = payload;
        
        if (!ticket_id) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'MISSING_PARAM', message: 'ticket_id is required' } 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Get ticket and messages first
        const { data: ticket } = await supabase
          .from('support_tickets')
          .select('user_id')
          .eq('id', ticket_id)
          .single();
        
        if (!ticket) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'NOT_FOUND', message: 'Ticket not found' } 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const { data: messages } = await supabase
          .from('support_messages')
          .select('attachments')
          .eq('ticket_id', ticket_id);
        
        // Delete attachments from storage
        let deletedFiles = 0;
        if (messages) {
          const storageClient = supabase.storage.from('support-attachments');
          
          for (const message of messages) {
            if (message.attachments && Array.isArray(message.attachments)) {
              for (const attachment of message.attachments) {
                if (attachment.path) {
                  try {
                    await storageClient.remove([attachment.path]);
                    deletedFiles++;
                  } catch (error) {
                    console.error('Error deleting attachment:', error);
                  }
                }
                if (attachment.thumbPath) {
                  try {
                    await storageClient.remove([attachment.thumbPath]);
                    deletedFiles++;
                  } catch (error) {
                    console.error('Error deleting thumbnail:', error);
                  }
                }
              }
            }
          }
          
          // Also clean up any remaining files in the user's ticket folder
          try {
            const folderPath = `${ticket.user_id}/${ticket_id}/`;
            const { data: files } = await storageClient.list(folderPath);
            if (files && files.length > 0) {
              const filePaths = files.map(file => `${folderPath}${file.name}`);
              await storageClient.remove(filePaths);
              deletedFiles += files.length;
            }
          } catch (error) {
            console.error('Error cleaning up folder:', error);
          }
        }
        
        // Delete the ticket (messages will cascade)
        const { error: deleteError } = await supabase
          .from('support_tickets')
          .delete()
          .eq('id', ticket_id);
        
        if (deleteError) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: { code: 'DB_ERROR', message: deleteError.message } 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ 
          ok: true, 
          deletedFiles, 
          ticketDeleted: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      default:
        return new Response(JSON.stringify({ 
          ok: false, 
          error: { code: 'INVALID_ACTION', message: 'Invalid action specified' } 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
  } catch (error) {
    console.error('Error in admin-support-gateway:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});