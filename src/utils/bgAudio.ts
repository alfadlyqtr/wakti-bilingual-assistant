/**
 * Background music helpers.
 * AppHeader owns the actual Audio object (never unmounts).
 * This module just emits events to tell AppHeader what to do.
 */
import { emitEvent } from '@/utils/eventBus';

export const bgAudio = {
  /** Card started playing + bg is active → tell AppHeader to start playing */
  sync(src: string) {
    emitEvent('wakti-bg-music-start', { src });
  },

  /** Deactivate button pressed → tell AppHeader to stop */
  stop() {
    emitEvent('wakti-bg-music-pause');
  },
};
