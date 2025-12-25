export type ShareLanguage = 'en' | 'ar';

export type ShareSlide = {
  index: number;
  title: string;
  startMs: number;
  durationMs: number;
  imagePath: string;
};

export type ShareSlideDataV2 = {
  id: string;
  slideNumber: number;
  role: string;
  layoutType: string;
  theme: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  highlightedStats?: string[];
  columns?: unknown[];
  imageUrl?: string;
  imageMeta?: {
    photographer?: string;
    photographerUrl?: string;
    pexelsUrl?: string;
  };
  footer?: string;
  titleStyle?: {
    fontSize: 'small' | 'medium' | 'large';
    fontWeight: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    color?: string;
  };
  subtitleStyle?: {
    fontSize: 'small' | 'medium' | 'large';
    fontWeight: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    color?: string;
  };
  bulletStyle?: {
    fontSize: 'small' | 'medium' | 'large';
    fontWeight: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
    color?: string;
  };
  accentColor?: string;
  accentFontWeight?: 'normal' | 'bold';
  accentFontStyle?: 'normal' | 'italic';
  accentFontSize?: 'small' | 'medium' | 'large';
  bulletDotColor?: string;
  bulletDotSize?: 'small' | 'medium' | 'large';
  bulletDotShape?: 'dot' | 'diamond' | 'arrow' | 'dash' | 'number' | 'letter';
  layoutVariant?: 'text_left' | 'image_left' | 'image_top' | 'image_bottom' | 'text_only';
  imageSize?: 'small' | 'medium' | 'large' | 'full';
  imageFit?: 'crop' | 'fit' | 'fill';
  imageTransform?: {
    scale: number;
    xPct: number;
    yPct: number;
  };
  imageFocusX?: 'left' | 'center' | 'right';
  imageFocusY?: 'top' | 'center' | 'bottom';
  slideBg?: string;
  voiceGender?: 'male' | 'female';
};

export type ShareSlideV2 = {
  index: number;
  title: string;
  startMs: number;
  durationMs: number;
  data: ShareSlideDataV2;
};

export type ShareManifestV1 = {
  version: 1;
  createdAt: string;
  title: string;
  theme: string;
  language: ShareLanguage;
  audioPath: string;
  totalDurationMs: number;
  slides: ShareSlide[];
};

export type ShareManifestV2 = {
  version: 2;
  createdAt: string;
  title: string;
  theme: string;
  language: ShareLanguage;
  audioPath: string;
  totalDurationMs: number;
  thumbnailPath?: string;
  slides: ShareSlideV2[];
};

export function generateShareToken(length = 20): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    output.setInt16(offset, s, true);
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  if (numChannels === 1) {
    floatTo16BitPCM(view, offset, audioBuffer.getChannelData(0));
  } else {
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));
    const interleaved = new Float32Array(length * numChannels);
    let idx = 0;
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        interleaved[idx++] = channels[c][i];
      }
    }
    floatTo16BitPCM(view, offset, interleaved);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function getPublicStorageUrl(args: {
  supabaseUrl: string;
  bucket: string;
  path: string;
}): string {
  const { supabaseUrl, bucket, path } = args;
  const cleanBase = supabaseUrl.replace(/\/$/, '');
  return `${cleanBase}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
