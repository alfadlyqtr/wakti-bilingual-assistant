
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create a Supabase client with the auth header
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );
    
    // Get the session from auth
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.getUser();
    
    if (getUserError || !user) {
      return new Response(
        JSON.stringify({ error: getUserError?.message || 'Could not get user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Before deleting the user, attempt to delete any avatar files
    try {
      const { data: objects, error: listError } = await supabaseAdmin.storage
        .from('avatars')
        .list('', {
          search: user.id
        });
      
      if (!listError && objects && objects.length > 0) {
        // Delete matching avatar files
        const filesToDelete = objects
          .filter(obj => obj.name.includes(user.id))
          .map(obj => obj.name);
          
        if (filesToDelete.length > 0) {
          await supabaseAdmin.storage
            .from('avatars')
            .remove(filesToDelete);
        }
      }
    } catch (storageError) {
      // Log but don't fail if storage cleanup fails
      console.error('Error cleaning up user files:', storageError);
    }
    
    // Delete the user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
