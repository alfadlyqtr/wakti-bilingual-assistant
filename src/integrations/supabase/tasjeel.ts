import { supabase } from './client';
import { ensurePassport, getCurrentUserId } from './auth';
import { callEdgeFunctionWithRetry } from './edgeFunctions';
import { TasjeelRecord, AudioUploadOptions } from '@/components/tasjeel/types';
import type { Database } from '@/integrations/supabase/types';

const mapDbTasjeelRecord = (row: Database['public']['Tables']['tasjeel_records']['Row']): TasjeelRecord => {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title ?? null,
    original_recording_path: String(row.original_recording_path),
    transcription: row.transcription ?? null,
    summary: row.summary ?? null,
    summary_audio_path: row.summary_audio_path ?? null,
    duration: row.duration ?? null,
    saved: row.saved ?? false,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? undefined,
    source_type: (row.source_type as TasjeelRecord['source_type']) ?? 'recording'
  };
};

export const manuallyDeleteOldRecordings = async (): Promise<{ success: boolean; message: string; deletedCount?: number }> => {
  try {
    const data = await callEdgeFunctionWithRetry<{
      message: string;
      deleted_count: number;
      deleted_recordings?: Array<{ id: string; title: string; created_at: string }>;
    }>('auto-delete-recordings', {
      body: {},
      maxRetries: 1,
      retryDelay: 1000
    });

    return {
      success: true,
      message: data.message,
      deletedCount: data.deleted_count
    };
  } catch (error) {
    console.error('Error manually deleting old recordings:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete old recordings';
    return {
      success: false,
      message
    };
  }
};

export const saveTasjeelRecord = async (
  recordData: Omit<TasjeelRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<TasjeelRecord> => {
  try {
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user found');
    }

    const finalRecordData = {
      ...recordData,
      saved: recordData.saved !== undefined ? recordData.saved : true
    };

    const { data, error } = await supabase
      .from('tasjeel_records')
      .insert({
        ...finalRecordData,
        user_id: userId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error saving Tasjeel record:', error);
      throw error;
    }

    return mapDbTasjeelRecord(data);
  } catch (error) {
    console.error('Error saving Tasjeel record:', error);
    throw error;
  }
};

export const updateTasjeelRecord = async (
  id: string,
  updates: Partial<Omit<TasjeelRecord, 'id' | 'user_id' | 'created_at'>>
): Promise<TasjeelRecord> => {
  try {
    const { data, error } = await supabase
      .from('tasjeel_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error updating Tasjeel record:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Record not found or could not be updated');
    }

    console.log('Successfully updated Tasjeel record:', data);
    return mapDbTasjeelRecord(data);
  } catch (error) {
    console.error('Error updating Tasjeel record:', error);
    throw error;
  }
};

export const getTasjeelRecords = async (limit = 20, page = 0, savedOnly = false): Promise<TasjeelRecord[]> => {
  try {
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user found');
    }

    console.log('Fetching Tasjeel records for user:', userId);

    let query = supabase
      .from('tasjeel_records')
      .select('*')
      .eq('user_id', userId);

    if (savedOnly) {
      query = query.eq('saved', true);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
      console.error('Error fetching Tasjeel records:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} Tasjeel records`);
    return (data || []).map(mapDbTasjeelRecord);
  } catch (error) {
    console.error('Error fetching Tasjeel records:', error);
    throw error;
  }
};

export const deleteTasjeelRecord = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasjeel_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting Tasjeel record:', error);
    throw error;
  }
};

export const uploadAudioFile = async (options: AudioUploadOptions): Promise<string> => {
  const { file, onProgress, onError, onSuccess } = options;

  try {
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const fileName = `upload-${Date.now()}-${file.name}`;
    const filePath = `${userId}/${fileName}`;

    const { data, error } = await supabase
      .storage
      .from('tasjeel_recordings')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600'
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase
      .storage
      .from('tasjeel_recordings')
      .getPublicUrl(filePath);

    const audioUrl = publicUrlData.publicUrl;

    if (onSuccess) onSuccess(audioUrl);
    return audioUrl;
  } catch (error) {
    console.error('Error uploading audio file:', error);
    if (onError) onError(error);
    throw error;
  }
};

export const updateRecordingTitle = async (id: string, title: string): Promise<TasjeelRecord> => {
  return updateTasjeelRecord(id, { title });
};
