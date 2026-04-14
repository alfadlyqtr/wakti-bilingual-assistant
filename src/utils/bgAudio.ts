/**
 * Shared background music Audio singleton.
 * The HTMLAudioElement lives here at module scope — survives all React lifecycles.
 * Both AppHeader (indicator) and PlaylistPlayer (controls/UI) reference the same object.
 *
 * Playlist mode: stores the full URL array + index so track advancement
 * works entirely without React state — even when PlaylistPlayer is unmounted.
 */
import { emitEvent } from '@/utils/eventBus';

let _audio: HTMLAudioElement | null = null;
let _src: string | null = null;

// Playlist state — lives at module scope, survives unmounts
let _plUrls: string[] = [];
let _plIdx: number = 0;
let _plLoop: 'none' | 'one' | 'all' = 'none';
let _onTrackChange: ((idx: number) => void) | null = null; // notify React when idx changes

function _syncNativeLoop() {
  if (!_audio) return;
  if (_plUrls.length > 0) {
    _audio.loop = _plLoop === 'one';
    return;
  }
  _audio.loop = _audio.loop;
}

function _onEndedHandler() {
  if (_plUrls.length === 0) return; // single-track mode — audio.loop handles it
  if (_plLoop === 'one') {
    // restart same track
    if (_audio) { _audio.currentTime = 0; _audio.play().catch(() => {}); }
    return;
  }
  const next = _plIdx + 1;
  if (next < _plUrls.length) {
    _plIdx = next;
  } else if (_plLoop === 'all') {
    _plIdx = 0;
  } else {
    // end of playlist, no loop
    emitEvent('wakti-bg-music-pause');
    return;
  }
  _src = _plUrls[_plIdx];
  if (_audio) {
    _audio.src = _src;
    _audio.load();
    _audio.play().catch(() => {});
  }
  try { sessionStorage.setItem('wakti-pl-bg-idx', String(_plIdx)); } catch {}
  if (_onTrackChange) _onTrackChange(_plIdx);
}

export const bgAudio = {
  /** Get or create the shared Audio for a given src */
  getOrCreate(src: string, loop = true): HTMLAudioElement {
    if (_audio && _src === src) { _audio.loop = loop; return _audio; }
    if (_audio) { _audio.pause(); _audio.removeEventListener('ended', _onEndedHandler); _audio.src = ''; }
    _audio = new Audio(src);
    _audio.loop = loop;
    _src = src;
    if (_plUrls.length > 0) {
      _audio.addEventListener('ended', _onEndedHandler);
    }
    return _audio;
  },

  get audio(): HTMLAudioElement | null { return _audio; },
  get src(): string | null { return _src; },
  get isPlaying(): boolean { return _audio ? !_audio.paused : false; },
  get plIdx(): number { return _plIdx; },
  get plUrls(): string[] { return _plUrls; },

  /** Single-track mode */
  play(src: string) {
    _plUrls = [];
    _plIdx = 0;
    _plLoop = 'none';
    _onTrackChange = null;
    const audio = this.getOrCreate(src, true);
    if (audio.paused) audio.play().catch(() => {});
    emitEvent('wakti-bg-music-indicator-on');
  },

  /**
   * Single-track mode starting from a specific time.
   * Always creates a fresh module-level Audio element (never uses a React-owned one).
   * Safe to call when transferring from a React component that is about to unmount.
   */
  playFrom(src: string, startTime = 0, paused = false) {
    _plUrls = [];
    _plIdx = 0;
    _plLoop = 'none';
    _onTrackChange = null;
    // Always create a fresh element owned by this module
    if (_audio) { _audio.pause(); _audio.removeEventListener('ended', _onEndedHandler); _audio.src = ''; }
    _audio = new Audio(src);
    _audio.loop = true;
    _src = src;
    if (startTime > 0) {
      const seek = () => {
        if (_audio) { _audio.currentTime = startTime; }
        _audio?.removeEventListener('loadedmetadata', seek);
      };
      _audio.addEventListener('loadedmetadata', seek);
    }
    if (!paused) _audio.play().catch(() => {});
    emitEvent('wakti-bg-music-indicator-on');
  },

  /**
   * Playlist mode: store the full URL list and start playing from startIdx.
   * Track advancement happens entirely in _onEndedHandler — no React needed.
   */
  startPlaylist(
    urls: string[],
    startIdx: number,
    loop: 'none' | 'one' | 'all',
    onTrackChange?: (idx: number) => void
  ) {
    _plUrls = urls;
    _plIdx = startIdx;
    _plLoop = loop;
    _onTrackChange = onTrackChange || null;
    const src = urls[startIdx];
    if (!src) return;

    if (_audio && _src === src) {
      // Already playing this track — just adopt it, attach ended listener, don't restart
      _audio.loop = _plLoop === 'one';
      _audio.removeEventListener('ended', _onEndedHandler);
      _audio.addEventListener('ended', _onEndedHandler);
      if (_audio.paused) _audio.play().catch(() => {});
    } else {
      // Different src or no audio — create fresh
      if (_audio) { _audio.pause(); _audio.removeEventListener('ended', _onEndedHandler); _audio.src = ''; }
      _audio = new Audio(src);
      _audio.loop = _plLoop === 'one';
      _src = src;
      _audio.addEventListener('ended', _onEndedHandler);
      _audio.play().catch(() => {});
    }
    emitEvent('wakti-bg-music-indicator-on');
  },

  /**
   * Adopt an existing HTMLAudioElement as the singleton (e.g. when activating bg mode
   * on an already-playing private audio). Preserves current time and play state.
   */
  adoptAudio(audio: HTMLAudioElement, src: string) {
    if (_audio && _audio !== audio) {
      _audio.removeEventListener('ended', _onEndedHandler);
      // Don't pause/clear — the caller's audioRef still holds it temporarily
    }
    _audio = audio;
    _src = src;
    _audio.loop = _plLoop === 'one';
    _audio.removeEventListener('ended', _onEndedHandler);
    _audio.addEventListener('ended', _onEndedHandler);
  },

  /** Attach React notify callback (called on mount/remount) */
  setOnTrackChange(cb: ((idx: number) => void) | null) {
    _onTrackChange = cb;
  },

  /** Set loop mode */
  setLoopMode(mode: 'none' | 'one' | 'all') {
    _plLoop = mode;
    _syncNativeLoop();
    emitEvent('wakti-bg-loop-change', mode);
  },
  get loopMode(): 'none' | 'one' | 'all' { return _plLoop; },

  /** Skip to next track (works even when component unmounted) */
  next() {
    if (_plUrls.length === 0 || !_audio) return;
    const nextIdx = _plIdx + 1 < _plUrls.length ? _plIdx + 1 : (_plLoop === 'all' ? 0 : null);
    if (nextIdx === null) return;
    _plIdx = nextIdx;
    _src = _plUrls[_plIdx];
    _audio.src = _src;
    _audio.load();
    _audio.play().catch(() => {});
    try { sessionStorage.setItem('wakti-pl-bg-idx', String(_plIdx)); } catch {}
    if (_onTrackChange) _onTrackChange(_plIdx);
  },

  /** Skip to previous track */
  prev() {
    if (_plUrls.length === 0 || !_audio) return;
    const prevIdx = _plIdx - 1 >= 0 ? _plIdx - 1 : (_plLoop === 'all' ? _plUrls.length - 1 : 0);
    _plIdx = prevIdx;
    _src = _plUrls[_plIdx];
    _audio.src = _src;
    _audio.load();
    _audio.play().catch(() => {});
    try { sessionStorage.setItem('wakti-pl-bg-idx', String(_plIdx)); } catch {}
    if (_onTrackChange) _onTrackChange(_plIdx);
  },

  /** Legacy: attach ended callback (kept for compatibility) */
  setOnEnded(cb: (() => void) | null) { /* no-op — handled by _onEndedHandler now */ },

  /** Legacy: single-src playlist start (kept for compatibility) */
  playPlaylist(src: string, _onEnded: () => void) {
    this.startPlaylist([src], 0, 'none');
  },

  /** Fully stop and clear everything */
  stop() {
    if (_audio) {
      _audio.removeEventListener('ended', _onEndedHandler);
      _audio.pause();
      _audio.src = '';
    }
    _audio = null;
    _src = null;
    _plUrls = [];
    _plIdx = 0;
    _plLoop = 'none';
    _onTrackChange = null;
    emitEvent('wakti-bg-music-pause');
  },
};
