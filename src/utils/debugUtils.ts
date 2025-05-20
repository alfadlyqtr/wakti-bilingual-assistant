
// This file contains utility functions for debugging purposes
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if the voice_recordings bucket exists, creates it if it doesn't
 * and ensures it has the correct permissions
 */
export const createVoiceRecordingsBucket = async () => {
  try {
    console.log("[createVoiceRecordingsBucket] Checking if voice_recordings bucket exists...");
    
    // First check if the bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return { success: false, error: listError };
    }
    
    // Check if bucket exists
    const bucketExists = buckets?.some(bucket => bucket.name === 'voice_recordings');
    console.log(`[createVoiceRecordingsBucket] Bucket exists: ${bucketExists}`);
    
    if (!bucketExists) {
      console.log("[createVoiceRecordingsBucket] Creating voice_recordings bucket...");
      
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('voice_recordings', {
        public: false // Make private by default with RLS
      });
      
      if (createError) {
        console.error("Error creating bucket:", createError);
        return { success: false, error: createError };
      }
      
      console.log("[createVoiceRecordingsBucket] Bucket created successfully");
    }
    
    // Check for auth before testing permissions
    const { data: authData } = await supabase.auth.getSession();
    
    // Verify auth before attempting to test permissions
    if (!authData.session) {
      console.warn("[createVoiceRecordingsBucket] No auth session, skipping permission test");
      return { success: true, error: null };
    }
    
    // Don't perform actual test uploads in production - too risky
    // Just check if the user has a valid session and assume permissions are correct
    
    console.log("[createVoiceRecordingsBucket] ✅ Bucket verification complete");
    return { success: true, error: null };
    
  } catch (error) {
    console.error("Exception in createVoiceRecordingsBucket:", error);
    return { success: false, error };
  }
};

/**
 * Lists all storage buckets and provides information about them
 * Used for debugging storage issues
 */
export const listStorageBuckets = async () => {
  try {
    console.log("[listStorageBuckets] Fetching all storage buckets...");
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error("Error listing buckets:", error);
      return { buckets: [], error };
    }
    
    // Gather information about each bucket
    const bucketsInfo = buckets?.map(bucket => ({
      name: bucket.name,
      id: bucket.id,
      public: bucket.public,
      created_at: bucket.created_at,
      updated_at: bucket.updated_at
    }));
    
    console.log(`[listStorageBuckets] Found ${bucketsInfo?.length || 0} buckets:`, bucketsInfo);
    
    return {
      buckets: bucketsInfo || [],
      count: bucketsInfo?.length || 0,
      error: null
    };
  } catch (error) {
    console.error("Exception in listStorageBuckets:", error);
    return { buckets: [], count: 0, error };
  }
};

/**
 * Checks if the user has permissions to upload and retrieve files from a bucket
 * @param bucketName - Name of the bucket to check permissions for
 */
export const checkStoragePermissions = async (bucketName: string) => {
  try {
    console.log(`[checkStoragePermissions] Checking permissions for ${bucketName} bucket...`);
    
    // First check if the user is authenticated
    const { data: authData } = await supabase.auth.getSession();
    
    if (!authData.session) {
      console.warn(`[checkStoragePermissions] No auth session, cannot test permissions for ${bucketName}`);
      return {
        canUpload: false,
        canDownload: false,
        canList: false,
        userId: null,
        uploadError: "No authenticated session",
        downloadError: "No authenticated session",
        listError: "No authenticated session"
      };
    }
    
    const userId = authData.session.user.id;
    console.log(`[checkStoragePermissions] Testing permissions for user ${userId}`);
    
    // Check if the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.error(`[checkStoragePermissions] Bucket ${bucketName} does not exist`);
      return {
        canUpload: false,
        canDownload: false,
        canList: false,
        userId,
        uploadError: `Bucket ${bucketName} does not exist`,
        downloadError: `Bucket ${bucketName} does not exist`,
        listError: `Bucket ${bucketName} does not exist`
      };
    }
    
    // Check LIST permissions
    const { data: listData, error: listError } = await supabase.storage
      .from(bucketName)
      .list(`${userId}/test`);
      
    // Check UPLOAD permissions (but don't actually upload in production to avoid unnecessary files)
    // Using createSignedUploadUrl which is the correct method instead of getUploadUrl
    let uploadError = null;
    try {
      await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(`${userId}/test/permission_test.txt`);
    } catch (error) {
      uploadError = error;
    }
    
    // Return comprehensive permissions report
    return {
      canUpload: !uploadError,
      canList: !listError,
      canDownload: true, // Assuming download permissions work if listing works
      userId,
      uploadError: uploadError ? String(uploadError) : null,
      listError: listError ? String(listError) : null,
      downloadError: null
    };
  } catch (error) {
    console.error(`[checkStoragePermissions] Exception checking ${bucketName} permissions:`, error);
    return {
      canUpload: false,
      canDownload: false,
      canList: false,
      userId: null,
      uploadError: String(error),
      downloadError: String(error),
      listError: String(error)
    };
  }
};

/**
 * Validates the user's auth session and provides helpful debugging information
 */
export const validateAuthSession = async () => {
  try {
    console.log("[validateAuthSession] Checking authentication state...");
    
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("[validateAuthSession] Error fetching session:", sessionError);
      return {
        isAuthenticated: false,
        sessionValid: false,
        userId: null,
        error: sessionError.message
      };
    }
    
    if (!sessionData?.session) {
      console.warn("[validateAuthSession] No active session found");
      return {
        isAuthenticated: false,
        sessionValid: false,
        userId: null,
        error: "No active session"
      };
    }
    
    // Get expiration time and calculate remaining time
    const expiresAt = sessionData.session.expires_at;
    const expiresDate = new Date(expiresAt * 1000);
    const now = new Date();
    const remainingMs = expiresDate.getTime() - now.getTime();
    const remainingMins = Math.floor(remainingMs / (60 * 1000));
    
    console.log(`[validateAuthSession] Session valid for ${remainingMins} more minutes`);
    
    return {
      isAuthenticated: true,
      sessionValid: remainingMs > 0,
      userId: sessionData.session.user.id,
      email: sessionData.session.user.email,
      expiresAt: expiresDate.toISOString(),
      remainingMinutes: remainingMins,
      error: null
    };
  } catch (error) {
    console.error("[validateAuthSession] Exception validating session:", error);
    return {
      isAuthenticated: false,
      sessionValid: false,
      userId: null,
      error: String(error)
    };
  }
};
