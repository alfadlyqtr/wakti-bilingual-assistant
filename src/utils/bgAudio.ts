/**
 * Background music helpers.
 * AppHeader owns the actual Audio object (never unmounts).
 * This module just emits events to tell AppHeader what to do.
 */
import { emitEvent } from '@/utils/eventBus';

const BG_PLAYER_ID = '__wakti-bg__';

export const bgAudio = {
  /** Card started playing + bg is active → tell AppHeader to start, silence the card */
  sync(src: string) {
    emitEvent('wakti-bg-music-start', { src });
    // Silence the card's AudioPlayer so only AppHeader plays
    emitEvent('wakti-audio-play', { playerId: BG_PLAYER_ID });
  },

  /** Deactivate button pressed → tell AppHeader to stop */
  stop() {
    emitEvent('wakti-bg-music-pause');
  },
};
