import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[setup-admin-auth] Starting admin auth setup...');

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the admin email from request or use default
    const { email = 'admin@tmw.qa', password = 'AdminPassword123!' } = await req.json();

    console.log('[setup-admin-auth] Creating Supabase Auth user for:', email);

    // Create Auth user using service role
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'TMW Admin',
        role: 'admin'
      }
    });

    if (authError) {
      console.error('[setup-admin-auth] Error creating auth user:', authError);
      
      // If user already exists, try to get them
      if (authError.message.includes('already registered')) {
        console.log('[setup-admin-auth] User already exists, fetching existing user...');
        
        const { data: existingUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (fetchError) {
          throw new Error(`Failed to fetch existing users: ${fetchError.message}`);
        }
        
        const existingUser = existingUsers.users.find(u => u.email === email);
        if (existingUser) {
          console.log('[setup-admin-auth] Found existing user:', existingUser.id);
          
          // Update admin_users table with auth_user_id
          const { error: updateError } = await supabaseAdmin
            .from('admin_users')
            .update({ auth_user_id: existingUser.id })
            .eq('email', email);
          
          if (updateError) {
            throw new Error(`Failed to link existing auth user: ${updateError.message}`);
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Admin auth setup completed with existing user',
              auth_user_id: existingUser.id,
              email
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log('[setup-admin-auth] Auth user created successfully:', authUser.user?.id);

    // Update admin_users table to link the Auth user
    const { error: linkError } = await supabaseAdmin
      .from('admin_users')
      .update({ auth_user_id: authUser.user?.id })
      .eq('email', email);

    if (linkError) {
      console.error('[setup-admin-auth] Error linking auth user to admin_users:', linkError);
      throw new Error(`Failed to link auth user: ${linkError.message}`);
    }

    console.log('[setup-admin-auth] Successfully linked auth user to admin_users table');

    // Verify the setup
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, auth_user_id, is_active')
      .eq('email', email)
      .single();

    if (verifyError) {
      console.error('[setup-admin-auth] Error verifying setup:', verifyError);
    } else {
      console.log('[setup-admin-auth] Setup verification:', verifyData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin auth setup completed successfully',
        auth_user_id: authUser.user?.id,
        email,
        verification: verifyData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[setup-admin-auth] Exception:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});