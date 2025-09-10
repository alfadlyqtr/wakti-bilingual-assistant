export interface MusicSearchResult {
  trackId: number;
  title: string;
  artist: string;
  artwork: string;
  previewUrl: string;
  durationSec: number;
}

// Simple iTunes Search API client for music previews (legal 30s MP3)
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
export async function searchITunes(term: string, limit = 10): Promise<MusicSearchResult[]> {
  const encoded = encodeURIComponent(term.trim());
  const url = `https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=${limit}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`iTunes Search failed with status ${resp.status}`);
  }
  const json = await resp.json();
  const results = Array.isArray(json?.results) ? json.results : [];
  return results.map((r: any) => ({
    trackId: r.trackId,
    title: r.trackName,
    artist: r.artistName,
    artwork: r.artworkUrl100 || r.artworkUrl60 || '',
    previewUrl: r.previewUrl,
    durationSec: Math.round((r.trackTimeMillis || 0) / 1000)
  })).filter((r: MusicSearchResult) => !!r.previewUrl);
}
