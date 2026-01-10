import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create admin client for backend operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RequestBody {
  projectId: string;
  action: string;
  formName?: string;
  data?: Record<string, unknown>;
  id?: string;
  collection?: string;
  email?: string;
  password?: string;
  name?: string;
}

// Simple password hashing (for site users - not WAKTI auth users)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'wakti-project-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate simple JWT-like token for site users
function generateSiteToken(projectId: string, siteUserId: string, email: string): string {
  const payload = {
    projectId,
    siteUserId,
    email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return btoa(JSON.stringify(payload));
}

// Verify site token
function verifySiteToken(token: string): { projectId: string; siteUserId: string; email: string } | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Validate that project backend is enabled and origin is allowed
async function validateRequest(projectId: string, origin: string | null): Promise<{ valid: boolean; error?: string; ownerId?: string }> {
  console.log(`[project-backend-api] Validating request for project ${projectId}, origin: ${origin}`);
  
  const { data: backend, error } = await supabase
    .from('project_backends')
    .select('enabled, allowed_origins, user_id')
    .eq('project_id', projectId)
    .single();

  if (error || !backend) {
    console.log(`[project-backend-api] Backend not found or error:`, error);
    return { valid: false, error: 'Backend not enabled for this project' };
  }

  if (!backend.enabled) {
    return { valid: false, error: 'Backend is disabled' };
  }

  // Allow all origins if array is empty (development mode) or check allowed origins
  const allowedOrigins = backend.allowed_origins || [];
  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some((allowed: string) => 
      origin === allowed || 
      origin.endsWith(allowed) || 
      allowed === '*'
    );
    
    if (!isAllowed) {
      console.log(`[project-backend-api] Origin ${origin} not in allowed list:`, allowedOrigins);
      return { valid: false, error: 'Origin not allowed' };
    }
  }

  return { valid: true, ownerId: backend.user_id };
}

// Handle form submissions
async function handleFormSubmit(projectId: string, ownerId: string, formName: string, data: Record<string, unknown>, origin: string | null) {
  console.log(`[project-backend-api] Form submit: ${formName}`, data);
  
  const { data: result, error } = await supabase
    .from('project_form_submissions')
    .insert({
      project_id: projectId,
      user_id: ownerId,
      form_name: formName,
      data,
      origin: origin || 'unknown',
      status: 'unread',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[project-backend-api] Form submit error:`, error);
    throw new Error('Failed to save form submission');
  }

  return { success: true, id: result.id };
}

// Handle collection operations (CRUD)
async function handleCollection(
  method: string,
  projectId: string,
  ownerId: string,
  collectionName: string,
  data?: Record<string, unknown>,
  itemId?: string
) {
  console.log(`[project-backend-api] Collection ${method}: ${collectionName}`, { itemId, data });

  switch (method) {
    case 'GET': {
      const { data: items, error } = await supabase
        .from('project_collections')
        .select('*')
        .eq('project_id', projectId)
        .eq('collection_name', collectionName)
        .eq('status', 'active')
        .order('sort_order', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw new Error('Failed to fetch collection');
      return { items };
    }

    case 'POST': {
      if (!data) throw new Error('Data required for create');
      
      // Auto-create schema if first item
      const { data: schemaExists } = await supabase
        .from('project_collection_schemas')
        .select('id')
        .eq('project_id', projectId)
        .eq('collection_name', collectionName)
        .single();

      if (!schemaExists) {
        // Infer schema from data
        const fields = Object.entries(data).map(([name, value]) => ({
          name,
          type: typeof value === 'number' ? 'number' : 
                typeof value === 'boolean' ? 'boolean' :
                Array.isArray(value) ? 'array' : 'text'
        }));

        await supabase
          .from('project_collection_schemas')
          .insert({
            project_id: projectId,
            user_id: ownerId,
            collection_name: collectionName,
            schema: { fields },
            display_name: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
          });
      }

      const { data: item, error } = await supabase
        .from('project_collections')
        .insert({
          project_id: projectId,
          user_id: ownerId,
          collection_name: collectionName,
          data,
        })
        .select()
        .single();

      if (error) throw new Error('Failed to create item');
      return { item };
    }

    case 'PUT': {
      if (!itemId) throw new Error('Item ID required for update');
      if (!data) throw new Error('Data required for update');

      const { data: item, error } = await supabase
        .from('project_collections')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw new Error('Failed to update item');
      return { item };
    }

    case 'DELETE': {
      if (!itemId) throw new Error('Item ID required for delete');

      const { error } = await supabase
        .from('project_collections')
        .update({ status: 'deleted' })
        .eq('id', itemId)
        .eq('project_id', projectId);

      if (error) throw new Error('Failed to delete item');
      return { success: true };
    }

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

// Handle site user authentication
async function handleSiteAuth(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Site auth: ${action}`);

  switch (action) {
    case 'signup': {
      const { email, password, name } = data;
      if (!email || !password) throw new Error('Email and password required');

      const passwordHash = await hashPassword(password as string);

      const { data: user, error } = await supabase
        .from('project_site_users')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          email: email as string,
          password_hash: passwordHash,
          display_name: (name as string) || null,
        })
        .select('id, email, display_name')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Email already registered');
        }
        throw new Error('Failed to create account');
      }

      const token = generateSiteToken(projectId, user.id, user.email);
      return { user: { id: user.id, email: user.email, name: user.display_name }, token };
    }

    case 'login': {
      const { email, password } = data;
      if (!email || !password) throw new Error('Email and password required');

      const passwordHash = await hashPassword(password as string);

      const { data: user, error } = await supabase
        .from('project_site_users')
        .select('id, email, display_name, status')
        .eq('project_id', projectId)
        .eq('email', email as string)
        .eq('password_hash', passwordHash)
        .single();

      if (error || !user) {
        throw new Error('Invalid email or password');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Update last login
      await supabase
        .from('project_site_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      const token = generateSiteToken(projectId, user.id, user.email);
      return { user: { id: user.id, email: user.email, name: user.display_name }, token };
    }

    case 'me': {
      const { token } = data;
      if (!token) throw new Error('Token required');

      const decoded = verifySiteToken(token as string);
      if (!decoded) throw new Error('Invalid or expired token');

      const { data: user, error } = await supabase
        .from('project_site_users')
        .select('id, email, display_name, metadata')
        .eq('id', decoded.siteUserId)
        .eq('project_id', projectId)
        .single();

      if (error || !user) throw new Error('User not found');

      return { user: { id: user.id, email: user.email, name: user.display_name, metadata: user.metadata } };
    }

    default:
      throw new Error(`Unknown auth action: ${action}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const method = req.method;

    console.log(`[project-backend-api] ${method} ${url.pathname}`);

    // Parse request
    let body: RequestBody | null = null;
    let projectId: string | null = null;
    let action: string | null = null;
    let collection: string | null = null;
    let itemId: string | null = null;

    if (method === 'GET') {
      projectId = url.searchParams.get('projectId');
      action = url.searchParams.get('action');
      collection = url.searchParams.get('collection');
      itemId = url.searchParams.get('id');
    } else {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Handle file upload
        const formData = await req.formData();
        projectId = formData.get('projectId') as string;
        action = 'upload';
        
        // File upload logic
        const file = formData.get('file') as File;
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'No file provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate request
        const validation = await validateRequest(projectId, origin);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Upload file to storage
        const fileName = `${validation.ownerId}/${projectId}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(fileName, file);

        if (uploadError) {
          console.error(`[project-backend-api] Upload error:`, uploadError);
          return new Response(
            JSON.stringify({ error: 'Failed to upload file' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('project-uploads')
          .getPublicUrl(fileName);

        // Save upload record
        await supabase
          .from('project_uploads')
          .insert({
            project_id: projectId,
            user_id: validation.ownerId,
            filename: file.name,
            storage_path: fileName,
            file_type: file.type,
            size_bytes: file.size,
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.publicUrl,
            path: fileName,
            filename: file.name,
            size: file.size,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // JSON body
        body = await req.json();
        projectId = body.projectId;
        action = body.action;
        collection = body.collection;
        itemId = body.id;
      }
    }

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate project backend
    const validation = await validateRequest(projectId, origin);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownerId = validation.ownerId!;

    // Route to handler
    let result: unknown;

    // Parse action - format: "action" or "collection/name" or "auth/action"
    if (action?.startsWith('collection/')) {
      const collectionName = action.replace('collection/', '');
      result = await handleCollection(method, projectId, ownerId, collectionName, body?.data, itemId || body?.id);
    } else if (action?.startsWith('auth/')) {
      const authAction = action.replace('auth/', '');
      result = await handleSiteAuth(authAction, projectId, ownerId, body?.data || body || {});
    } else if (action === 'submit' || action === 'subscribe') {
      const formName = body?.formName || (action === 'subscribe' ? 'newsletter' : 'contact');
      result = await handleFormSubmit(projectId, ownerId, formName, body?.data || {}, origin);
    } else if (collection) {
      // Legacy format: ?collection=products
      result = await handleCollection(method, projectId, ownerId, collection, body?.data, itemId || body?.id);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[project-backend-api] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});