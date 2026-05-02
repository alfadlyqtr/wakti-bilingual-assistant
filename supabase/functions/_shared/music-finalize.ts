type FinalizableMusicTrack = {
  id: string;
  audioUrl: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title?: string;
  tags?: string;
  duration?: number;
};

type PlaceholderMusicRow = {
  id: string;
  user_id: string;
  task_id?: string | null;
  meta?: Record<string, unknown> | null;
  title?: string | null;
  prompt?: string | null;
  include_styles?: string[] | null;
  requested_duration_seconds?: number | null;
  model?: string | null;
};

type SavedMusicTrack = {
  id: string;
  audioUrl: string;
  coverUrl: string | null;
  duration: number | null;
  title: string | null;
  variantIndex: number;
};

type ExistingVariantRow = {
  id: string;
  variant_index: number | null;
};

type InsertedIdRow = {
  id: string;
};

type StorageBucketApi = {
  upload: (path: string, body: Blob, options: { contentType: string; upsert: boolean }) => Promise<{ error: unknown | null }>;
  getPublicUrl: (path: string) => { data?: { publicUrl?: string | null } | null };
};

type MusicFinalizeService = {
  storage: {
    from: (bucket: string) => StorageBucketApi;
  };
  from: (table: "user_music_tracks") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => Promise<{ data: ExistingVariantRow[] | null; error: unknown | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown | null }>;
    };
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: InsertedIdRow | null; error: unknown | null }>;
      };
    };
  };
};

async function downloadAndStorePublicAsset(
  supabaseService: unknown,
  url: string,
  storageBucket: string,
  filePath: string,
  contentType: string,
): Promise<string | null> {
  const db = supabaseService as MusicFinalizeService;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const blob = new Blob([buffer], { type: contentType });

    const { error: uploadError } = await db.storage
      .from(storageBucket)
      .upload(filePath, blob, { contentType, upsert: true });

    if (uploadError) {
      console.error(`[music-finalize] Upload error for ${filePath}:`, uploadError);
      return null;
    }

    const { data: urlData } = db.storage
      .from(storageBucket)
      .getPublicUrl(filePath);

    return urlData?.publicUrl ?? null;
  } catch (error) {
    console.error(`[music-finalize] download/store error for ${filePath}:`, error);
    return null;
  }
}

export async function finalizeMusicTaskTracks(params: {
  supabaseService: unknown;
  placeholderRow: PlaceholderMusicRow;
  taskId: string;
  userId: string;
  normalizedTracks: FinalizableMusicTrack[];
  timestamp?: number;
}): Promise<SavedMusicTrack[]> {
  const {
    supabaseService,
    placeholderRow,
    taskId,
    userId,
    normalizedTracks,
    timestamp = Date.now(),
  } = params;
  const db = supabaseService as MusicFinalizeService;

  const savedTracks: SavedMusicTrack[] = [];

  const { data: existingRows, error: existingRowsError } = await db
    .from("user_music_tracks")
    .select("id, variant_index")
    .eq("task_id", taskId)
    .order("variant_index", { ascending: true });

  if (existingRowsError) {
    console.error(`[music-finalize] Failed to load existing rows for task ${taskId}:`, existingRowsError);
  }

  const existingByVariant = new Map<number, string>();
  for (const row of existingRows ?? []) {
    if (typeof row?.variant_index === "number" && typeof row?.id === "string") {
      existingByVariant.set(row.variant_index, row.id);
    }
  }

  const rootRowId = typeof placeholderRow.id === "string" && placeholderRow.id.length > 0
    ? placeholderRow.id
    : existingByVariant.get(0) ?? existingRows?.[0]?.id ?? null;

  if (rootRowId && !existingByVariant.has(0)) {
    existingByVariant.set(0, rootRowId);
  }

  for (let i = 0; i < normalizedTracks.length; i++) {
    const track = normalizedTracks[i];
    const audioFileName = `${userId}/${timestamp}_${taskId.slice(0, 8)}_v${i}.mp3`;
    const publicAudioUrl = await downloadAndStorePublicAsset(
      db,
      track.audioUrl,
      "music",
      audioFileName,
      "audio/mpeg",
    );

    let publicCoverUrl: string | null = null;
    if (track.imageUrl) {
      const coverFileName = `${userId}/${timestamp}_${taskId.slice(0, 8)}_v${i}.jpeg`;
      publicCoverUrl = await downloadAndStorePublicAsset(
        db,
        track.imageUrl,
        "music-covers",
        coverFileName,
        "image/jpeg",
      );
    }

    const trackMeta = {
      ...((placeholderRow.meta as Record<string, unknown> | null) ?? {}),
      status: "completed",
      saved: true,
      kie_track_id: track.id,
      model_name: track.modelName,
      tags: track.tags,
    };

    const basePayload = {
      storage_path: audioFileName,
      signed_url: publicAudioUrl,
      cover_url: publicCoverUrl,
      source_audio_url: track.audioUrl,
      duration: track.duration ?? null,
      title: track.title || placeholderRow.title || null,
      variant_index: i,
      mime: "audio/mpeg",
      meta: trackMeta,
    };

    let savedRowId = existingByVariant.get(i) ?? null;

    if (savedRowId) {
      const { error: updateError } = await db
        .from("user_music_tracks")
        .update(basePayload)
        .eq("id", savedRowId);

      if (updateError) {
        console.error(`[music-finalize] Failed to update variant ${i} for task ${taskId}:`, updateError);
        continue;
      }
    } else if (i === 0 && rootRowId) {
      const { error: updateError } = await db
        .from("user_music_tracks")
        .update(basePayload)
        .eq("id", rootRowId);

      if (updateError) {
        console.error(`[music-finalize] Failed to update root variant for task ${taskId}:`, updateError);
        continue;
      }

      savedRowId = rootRowId;
      existingByVariant.set(0, rootRowId);
    } else {
      const { data: insertedRow, error: insertError } = await db
        .from("user_music_tracks")
        .insert({
          user_id: userId,
          task_id: taskId,
          title: track.title || placeholderRow.title || null,
          prompt: track.prompt || placeholderRow.prompt || null,
          include_styles: placeholderRow.include_styles ?? null,
          requested_duration_seconds: placeholderRow.requested_duration_seconds ?? null,
          provider: "kie",
          model: placeholderRow.model ?? null,
          storage_path: audioFileName,
          signed_url: publicAudioUrl,
          cover_url: publicCoverUrl,
          source_audio_url: track.audioUrl,
          duration: track.duration ?? null,
          variant_index: i,
          mime: "audio/mpeg",
          meta: trackMeta,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[music-finalize] Failed to insert variant ${i} for task ${taskId}:`, insertError);
        continue;
      }

      savedRowId = insertedRow?.id ?? null;
      if (savedRowId) existingByVariant.set(i, savedRowId);
    }

    if (!savedRowId) continue;

    savedTracks.push({
      id: savedRowId,
      audioUrl: publicAudioUrl ?? track.audioUrl,
      coverUrl: publicCoverUrl,
      duration: track.duration ?? null,
      title: track.title || null,
      variantIndex: i,
    });
  }

  return savedTracks;
}
