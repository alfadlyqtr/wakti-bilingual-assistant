/**
 * Shared background music Audio singleton.
 * The HTMLAudioElement lives here at module scope — survives all React lifecycles.
 * Both AppHeader (indicator) and AudioPlayer (controls/UI) reference the same object.
 *
 * Playlist mode: stores a persistent onEnded callback so track advancement
 * continues even when PlaylistPlayer is unmounted (navigated away from).
 */
import { emitEvent } from '@/utils/eventBus';

let _audio: HTMLAudioElement | null = null;
let _src: string | null = null;
let _onEnded: (() => void) | null = null;

function _attachEnded() {
  if (!_audio || !_onEnded) return;
  _audio.removeEventListener('ended', _onEnded);
  _audio.addEventListener('ended', _onEnded);
}

export const bgAudio = {
  /** Get or create the shared Audio for a given src (loop=false for playlist, true for single) */
  getOrCreate(src: string, loop = true): HTMLAudioElement {
    if (_audio && _src === src) { _audio.loop = loop; return _audio; }
    if (_audio) { _audio.pause(); _audio.removeEventListener('ended', _onEnded!); _audio.src = ''; }
    _audio = new Audio(src);
    _audio.loop = loop;
    _src = src;
    _attachEnded();
    return _audio;
  },

  get audio(): HTMLAudioElement | null { return _audio; },
  get src(): string | null { return _src; },
  get isPlaying(): boolean { return _audio ? !_audio.paused : false; },

  /** Single-track mode */
  play(src: string) {
    _onEnded = null;
    const audio = this.getOrCreate(src, true);
    if (audio.paused) audio.play().catch(() => {});
    emitEvent('wakti-bg-music-indicator-on');
  },

  /**
   * Playlist mode: play a src and register a persistent onEnded callback
   * that fires when the track ends — even if the component is unmounted.
   */
  playPlaylist(src: string, onEnded: () => void) {
    _onEnded = onEnded;
    const audio = this.getOrCreate(src, false);
    _attachEnded();
    if (audio.paused) audio.play().catch(() => {});
    emitEvent('wakti-bg-music-indicator-on');
  },

  /** Update the onEnded callback (e.g. when track index changes) */
  setOnEnded(cb: (() => void) | null) {
    if (_audio && _onEnded) _audio.removeEventListener('ended', _onEnded);
    _onEnded = cb;
    if (cb) _attachEnded();
  },

  /** Fully stop and clear everything */
  stop() {
    if (_audio) {
      if (_onEnded) _audio.removeEventListener('ended', _onEnded);
      _audio.pause();
      _audio.src = '';
    }
    _audio = null;
    _src = null;
    _onEnded = null;
    emitEvent('wakti-bg-music-pause');
  },
};
