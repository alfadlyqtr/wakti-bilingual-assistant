
import { supabase } from "@/integrations/supabase/client";

/**
 * Lists all storage buckets in the Supabase project
 */
export async function listStorageBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error("Error listing buckets:", error);
      return { error: error.message, buckets: [] };
    }
    
    return { 
      buckets: data.map(b => ({
        id: b.id,
        name: b.name,
        public: b.public,
        createdAt: b.created_at
      })),
      count: data.length 
    };
  } catch (err) {
    console.error("Exception listing buckets:", err);
    return { error: err.message, buckets: [] };
  }
}

/**
 * Creates a voice_recordings bucket with proper configuration if it doesn't exist
 * Ensures only one set of RLS policies exists to prevent conflicts
 */
export async function createVoiceRecordingsBucket() {
  try {
    // First check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const existingBucket = buckets.find(b => b.name === 'voice_recordings');
    
    if (existingBucket) {
      console.log("voice_recordings bucket already exists (id:", existingBucket.id, ")");
      console.log("Checking bucket configuration...");
      
      // Bucket exists but might have incorrect settings or conflicting policies
      // We'll update its configuration to ensure it's correct
      try {
        // Set proper configuration - this will overwrite any existing incorrect settings
        const { data, error } = await supabase.rpc('update_storage_bucket_configuration', {
          bucket_id: 'voice_recordings',
          public_flag: false,
          file_size_limit: 10485760, // 10MB in bytes
          allowed_mime_types: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg']
        });
        
        if (error) {
          console.error("Error updating bucket configuration:", error);
          return { success: true, warning: "Bucket exists but configuration update failed: " + error.message };
        }
        
        console.log("Bucket configuration updated successfully");
        return { success: true };
      } catch (configErr) {
        console.error("Exception updating bucket configuration:", configErr);
        return { success: true, warning: "Bucket exists but configuration update failed" };
      }
    }
    
    console.log("Creating voice_recordings bucket...");
    const { data, error } = await supabase.storage
      .createBucket('voice_recordings', { 
        public: false,
        fileSizeLimit: 10485760, // 10MB in bytes
        allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg']
      });
      
    if (error) {
      console.error("Error creating voice_recordings bucket:", error);
      return { error: error.message, success: false };
    }
    
    console.log("voice_recordings bucket created successfully");
    return { success: true };
  } catch (err) {
    console.error("Exception creating voice_recordings bucket:", err);
    return { error: err.message, success: false };
  }
}

/**
 * Checks permissions on a specific storage bucket
 */
export async function checkStoragePermissions(bucketId: string) {
  try {
    // Test if we can list files in the bucket
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketId)
      .list();
    
    // Test if we can upload a file to the bucket (dummy test)
    const testBlob = new Blob(['test'], { type: 'audio/webm' });
    const testPath = `__permission_check_${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketId)
      .upload(testPath, testBlob);
    
    // Try to delete the test file if it was uploaded successfully
    if (uploadData?.path) {
      await supabase.storage
        .from(bucketId)
        .remove([testPath]);
    }
    
    return {
      bucketId,
      canList: !listError,
      listError: listError?.message,
      canUpload: !!uploadData?.path,
      uploadError: uploadError?.message
    };
  } catch (err) {
    console.error(`Exception checking permissions on bucket ${bucketId}:`, err);
    return {
      bucketId,
      canList: false,
      listError: "Exception occurred",
      canUpload: false,
      uploadError: err.message
    };
  }
}

/**
 * Gets the details of a specific storage bucket
 */
export async function getBucketDetails(bucketId: string) {
  try {
    const { data, error } = await supabase
      .from('storage.buckets')
      .select('*')
      .eq('id', bucketId)
      .single();
    
    if (error) {
      console.error(`Error getting bucket details for ${bucketId}:`, error);
      return { error: error.message };
    }
    
    return { details: data };
  } catch (err) {
    console.error(`Exception getting bucket details for ${bucketId}:`, err);
    return { error: err.message };
  }
}
