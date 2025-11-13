// Minimal types for API v2

export interface SummaryStats {
  totalMinutes: number;
  totalScrobbles: number;
  uniqueArtistsCount: number;
}

export interface RecentScrobble {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName: string;
  durationMs: number;
  playedAt: string;
  albumArt?: string;
}
