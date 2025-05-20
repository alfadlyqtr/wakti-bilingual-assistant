
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
 * Creates a voice_recordings bucket if it doesn't exist
 */
export async function createVoiceRecordingsBucket() {
  try {
    // First check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    
    if (!buckets.some(b => b.name === 'voice_recordings')) {
      console.log("Creating voice_recordings bucket...");
      const { data, error } = await supabase.storage
        .createBucket('voice_recordings', { public: true });
        
      if (error) {
        console.error("Error creating voice_recordings bucket:", error);
        return { error: error.message, success: false };
      }
      
      console.log("voice_recordings bucket created successfully");
      return { success: true };
    }
    
    console.log("voice_recordings bucket already exists");
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
