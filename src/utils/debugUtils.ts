
import { supabase } from "@/integrations/supabase/client";

/**
 * Debug utility to check storage permissions for a bucket
 * @param bucket Bucket name to check
 * @returns Object with bucket status and permission information
 */
export async function checkStoragePermissions(bucket: string) {
  console.log(`[Debug] Checking permissions for bucket: ${bucket}`);
  
  try {
    // Check authentication
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error("[Debug] No authenticated session found");
      return { 
        authenticated: false,
        error: "Not authenticated",
        bucketExists: false,
        canList: false, 
        canUpload: false
      };
    }
    
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error("[Debug] Error listing buckets:", bucketsError);
      return { 
        authenticated: true,
        error: bucketsError.message,
        bucketExists: false,
        canList: false, 
        canUpload: false
      };
    }
    
    const bucketExists = buckets.some(b => b.name === bucket);
    if (!bucketExists) {
      console.error(`[Debug] Bucket '${bucket}' does not exist`);
      return { 
        authenticated: true,
        error: `Bucket '${bucket}' not found`,
        bucketExists: false,
        buckets: buckets.map(b => b.name),
        canList: false, 
        canUpload: false
      };
    }
    
    // Try to list files in the bucket
    const testListPath = `${session.session.user.id}/test`;
    const { data: listData, error: listError } = await supabase.storage
      .from(bucket)
      .list(testListPath, { limit: 1 });
      
    const canList = !listError;
    
    // Try to check if we can upload (just prepare the upload without sending data)
    const testBlob = new Blob(["test"], { type: "text/plain" });
    const testPath = `${session.session.user.id}/test/permissions-test.txt`;
    
    // Instead of actually uploading, we'll get an upload URL which checks permissions
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(testPath);
      
    const canUpload = !uploadError && !!uploadData;
    
    console.log(`[Debug] Bucket '${bucket}' permissions:`, {
      bucketExists: true,
      canList,
      canUpload,
      listError: listError?.message || null,
      uploadError: uploadError?.message || null
    });
    
    return {
      authenticated: true,
      bucketExists: true,
      canList,
      canUpload,
      listError: listError?.message || null,
      uploadError: uploadError?.message || null,
      userInfo: {
        id: session.session.user.id,
        email: session.session.user.email,
        role: session.session.user.role
      }
    };
  } catch (error) {
    console.error(`[Debug] Error checking permissions for bucket '${bucket}':`, error);
    return {
      error: error instanceof Error ? error.message : String(error),
      authenticated: false,
      bucketExists: false,
      canList: false,
      canUpload: false
    };
  }
}

/**
 * Log detailed information about an audio blob
 * @param blob Audio blob to log information about
 */
export function logAudioBlobDetails(blob: Blob) {
  if (!blob) {
    console.log("[Debug] Audio blob is null or undefined");
    return;
  }
  
  const details = {
    size: blob.size + " bytes",
    type: blob.type || "no type specified",
    isFile: blob instanceof File,
  };
  
  if (blob instanceof File) {
    Object.assign(details, {
      name: (blob as File).name,
      lastModified: new Date((blob as File).lastModified).toISOString(),
    });
  }
  
  console.log("[Debug] Audio blob details:", details);
  
  // Create a small slice to verify the blob is valid
  try {
    const slice = blob.slice(0, Math.min(1024, blob.size));
    console.log("[Debug] First bytes available:", !!slice && slice.size > 0);
  } catch (e) {
    console.error("[Debug] Error accessing blob data:", e);
  }
}

/**
 * Debug function to get Supabase storage bucket details
 */
export async function listStorageBuckets() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error("[Debug] Error listing storage buckets:", error);
      return { error };
    }
    
    const bucketsInfo = await Promise.all(buckets.map(async (bucket) => {
      // Try to get bucket details if possible
      try {
        // Check public/private status
        const isPublic = bucket.public;
        
        return {
          id: bucket.id,
          name: bucket.name,
          public: isPublic,
          createdAt: bucket.created_at,
        };
      } catch (e) {
        return {
          id: bucket.id,
          name: bucket.name,
          error: e instanceof Error ? e.message : String(e)
        };
      }
    }));
    
    console.log("[Debug] Storage buckets:", bucketsInfo);
    return { buckets: bucketsInfo };
  } catch (error) {
    console.error("[Debug] Error in listStorageBuckets:", error);
    return { error };
  }
}
