
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Get environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Define bucket configurations
const bucketConfigurations = [
  {
    id: "images",
    name: "User Images Storage",
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/svg+xml", "image/webp"],
    lifecycleDays: 10
  }
];

// Create headers for Supabase Admin API requests
const adminHeaders = {
  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
};

async function createOrUpdateBucket(bucket) {
  try {
    // Check if bucket exists
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/storage/buckets?id=eq.${bucket.id}`, {
      method: "GET",
      headers: adminHeaders
    });
    
    const existingBuckets = await checkResponse.json();
    const exists = existingBuckets.length > 0;
    
    if (exists) {
      // Update existing bucket
      console.log(`Updating bucket: ${bucket.id}`);
      await fetch(`${SUPABASE_URL}/rest/v1/storage/buckets?id=eq.${bucket.id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          public: bucket.public,
          file_size_limit: bucket.fileSizeLimit,
          allowed_mime_types: bucket.allowedMimeTypes
        })
      });
    } else {
      // Create new bucket
      console.log(`Creating bucket: ${bucket.id}`);
      await fetch(`${SUPABASE_URL}/rest/v1/storage/buckets`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          id: bucket.id,
          name: bucket.name,
          public: bucket.public,
          file_size_limit: bucket.fileSizeLimit,
          allowed_mime_types: bucket.allowedMimeTypes
        })
      });
    }
    
    return { success: true, bucket: bucket.id, action: exists ? "updated" : "created" };
  } catch (error) {
    console.error(`Error configuring bucket ${bucket.id}:`, error);
    return { success: false, bucket: bucket.id, error: error.message };
  }
}

async function configureBucketPolicies(bucket) {
  try {
    // Delete existing policies
    console.log(`Deleting existing policies for bucket: ${bucket.id}`);
    await fetch(`${SUPABASE_URL}/rest/v1/storage/policies?bucket_id=eq.${bucket.id}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    
    // Create policies for authenticated users
    const policies = [
      {
        name: `Users can view their own files in ${bucket.id}`,
        definition: "(auth.uid() = storage.foldername(name))::boolean",
        operation: "SELECT"
      },
      {
        name: `Users can upload their own files to ${bucket.id}`,
        definition: "(auth.uid() = storage.foldername(name))::boolean",
        operation: "INSERT"
      },
      {
        name: `Users can update their own files in ${bucket.id}`,
        definition: "(auth.uid() = storage.foldername(name))::boolean",
        operation: "UPDATE"
      },
      {
        name: `Users can delete their own files in ${bucket.id}`,
        definition: "(auth.uid() = storage.foldername(name))::boolean",
        operation: "DELETE"
      }
    ];
    
    const policyResults = [];
    
    for (const policy of policies) {
      console.log(`Creating policy: ${policy.name}`);
      const response = await fetch(`${SUPABASE_URL}/rest/v1/storage/policies`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          name: policy.name,
          bucket_id: bucket.id,
          definition: policy.definition,
          operation: policy.operation
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create policy: ${error}`);
      }
      
      policyResults.push({ name: policy.name, success: true });
    }
    
    return { success: true, bucket: bucket.id, policies: policyResults };
  } catch (error) {
    console.error(`Error configuring policies for bucket ${bucket.id}:`, error);
    return { success: false, bucket: bucket.id, error: error.message };
  }
}

async function configureLifecyclePolicies(bucket) {
  try {
    // First, check if pg_cron exists
    const checkCronResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_pg_cron_exists`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({})
    });
    
    // Create PostgreSQL function if it doesn't exist
    const functionName = `cleanup_old_files_${bucket.id}`;
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION storage.${functionName}()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $func$
      DECLARE
        cutoff_date TIMESTAMP := NOW() - INTERVAL '${bucket.lifecycleDays} days';
        obj RECORD;
      BEGIN
        FOR obj IN 
          SELECT id, name 
          FROM storage.objects 
          WHERE bucket_id = '${bucket.id}' 
          AND created_at < cutoff_date
        LOOP
          -- Delete the file from storage
          PERFORM storage.delete(obj.name, '${bucket.id}');
          
          -- Log the deletion
          RAISE NOTICE 'Deleted file % from ${bucket.id} bucket', obj.name;
        END LOOP;
      END;
      $func$;
    `;
    
    // Create the function
    console.log(`Creating lifecycle function for ${bucket.id}`);
    const createFunctionResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        query: createFunctionQuery
      })
    });
    
    if (!createFunctionResponse.ok) {
      const error = await createFunctionResponse.text();
      throw new Error(`Failed to create lifecycle function: ${error}`);
    }
    
    // Schedule the function to run daily
    const cronJobQuery = `
      SELECT cron.unschedule('${functionName}');
      SELECT cron.schedule(
        '${functionName}',
        '0 3 * * *', -- Run at 3 AM every day
        $$ SELECT storage.${functionName}() $$
      );
    `;
    
    console.log(`Scheduling lifecycle job for ${bucket.id}`);
    const scheduleJobResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        query: cronJobQuery
      })
    });
    
    if (!scheduleJobResponse.ok) {
      const error = await scheduleJobResponse.text();
      throw new Error(`Failed to schedule lifecycle job: ${error}`);
    }
    
    return { 
      success: true, 
      bucket: bucket.id, 
      lifecycle: {
        days: bucket.lifecycleDays,
        schedule: "0 3 * * *" // 3 AM daily
      }
    };
  } catch (error) {
    console.error(`Error configuring lifecycle policy for bucket ${bucket.id}:`, error);
    return { success: false, bucket: bucket.id, error: error.message };
  }
}

// Create RPCs for checking if pg_cron exists and running SQL
async function createHelperRPCs() {
  try {
    // Create function to check if pg_cron extension exists
    const checkCronFunction = `
      CREATE OR REPLACE FUNCTION check_pg_cron_exists()
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        extension_exists boolean;
      BEGIN
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) INTO extension_exists;
        
        IF NOT extension_exists THEN
          EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron;';
          RETURN true;
        END IF;
        
        RETURN extension_exists;
      END;
      $$;
    `;
    
    // Create function to run SQL commands
    const runSqlFunction = `
      CREATE OR REPLACE FUNCTION run_sql(query text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE query;
        RETURN 'SQL executed successfully';
      EXCEPTION WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
      END;
      $$;
    `;
    
    // Deploy helper functions
    console.log("Creating helper RPCs");
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_helper_functions`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        query: checkCronFunction + runSqlFunction
      })
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error creating helper RPCs:", error);
    return { success: false, error: error.message };
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Starting storage bucket configuration");
    const results = {
      buckets: [],
      policies: [],
      lifecycle: [],
      timestamp: new Date().toISOString()
    };

    // First create helper RPCs if needed
    await createHelperRPCs();
    
    // Process each bucket configuration
    for (const bucketConfig of bucketConfigurations) {
      console.log(`Processing bucket: ${bucketConfig.id}`);
      
      // Create or update bucket
      const bucketResult = await createOrUpdateBucket(bucketConfig);
      results.buckets.push(bucketResult);
      
      // Configure bucket policies
      const policyResult = await configureBucketPolicies(bucketConfig);
      results.policies.push(policyResult);
      
      // Configure lifecycle policies
      const lifecycleResult = await configureLifecyclePolicies(bucketConfig);
      results.lifecycle.push(lifecycleResult);
    }
    
    console.log("Completed storage bucket configuration");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: "Storage bucket configuration completed successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in configure-storage-buckets function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Internal server error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
