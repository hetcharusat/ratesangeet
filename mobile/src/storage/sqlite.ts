import { Platform } from 'react-native';

type DB = any; // typed as any to avoid dependency on expo-sqlite type declarations at build time
let db: DB | null = null;

// Conditionally import SQLite only on native platforms
let SQLite: any = null;
if (Platform.OS !== 'web') {
  try {
    SQLite = require('expo-sqlite');
  } catch (e) {
    console.warn('[SQLite] expo-sqlite not available on this platform');
  }
}

export type LocalScrobble = {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs?: number;
  playedAt: number; // ms epoch
};

const ensureDb = (): DB | null => {
  if (Platform.OS === 'web' || !SQLite) {
    return null;
  }
  if (!db) {
    // Use synchronous API for simplicity; Expo SDK 54 supports it.
    db = SQLite.openDatabaseSync('scrobbles.db');
  }
  return db;
};

export const initLocalDb = () => {
  const d = ensureDb();
  if (!d) return;
  d.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS scrobbles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spotifyId TEXT NOT NULL,
      trackName TEXT,
      artistName TEXT,
      albumId TEXT,
      albumName TEXT,
      albumArt TEXT,
      durationMs INTEGER,
      playedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scrobbles_playedAt ON scrobbles(playedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_scrobbles_spotifyId_playedAt ON scrobbles(spotifyId, playedAt DESC);
  `);
};

export const setMeta = (key: string, value: string) => {
  const d = ensureDb();
  if (!d) return;
  d.runSync('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
};

export const getMeta = (key: string): string | null => {
  const d = ensureDb();
  if (!d) return null;
  const row = d.getFirstSync('SELECT value FROM meta WHERE key=?', [key]) as any;
  return row && typeof row.value !== 'undefined' ? String(row.value) : null;
};

export const saveScrobbles = (items: LocalScrobble[]) => {
  if (!items?.length) return 0;
  const d = ensureDb();
  if (!d) return 0;
  d.withTransactionSync(() => {
    const stmt = d.prepareSync(
      'INSERT INTO scrobbles(spotifyId, trackName, artistName, albumId, albumName, albumArt, durationMs, playedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    try {
      for (const s of items) {
        stmt.executeSync([
          s.spotifyId,
          s.trackName,
          s.artistName,
          s.albumId || null,
          s.albumName || null,
          s.albumArt || null,
          s.durationMs ?? null,
          s.playedAt,
        ]);
      }
    } finally {
      stmt.finalizeSync();
    }
  });
  return items.length;
};

export const getRecentScrobbles = (limit: number = 100): LocalScrobble[] => {
  const d = ensureDb();
  if (!d) return [];
  const rows = d.getAllSync(
    'SELECT spotifyId, trackName, artistName, albumId, albumName, albumArt, durationMs, playedAt FROM scrobbles ORDER BY playedAt DESC LIMIT ?',
    [limit]
  ) as any[];
  return rows.map((r: any) => ({ ...r }));
};

export type AlbumAggregate = {
  albumId: string;
  albumName?: string;
  artistName?: string;
  albumArt?: string;
  count: number;
  lastPlayedAt?: number;
};

export const getAlbumAggregatesSince = (sinceMs?: number): AlbumAggregate[] => {
  const d = ensureDb();
  if (!d) return [];
  const rows = d.getAllSync(
    `SELECT 
        COALESCE(albumId, albumName, '') as albumId,
        MAX(albumName) as albumName,
        MAX(artistName) as artistName,
        MAX(albumArt) as albumArt,
        COUNT(1) as count,
        MAX(playedAt) as lastPlayedAt
      FROM scrobbles
      ${sinceMs ? 'WHERE playedAt > ?' : ''}
      GROUP BY COALESCE(albumId, albumName, '')
      HAVING albumId != ''
      ORDER BY count DESC`,
    sinceMs ? [sinceMs] : []
  ) as any[];
  return rows.map((r: any) => ({ ...r }));
};

export type TrackAggregate = {
  trackId?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  count: number;
  lastPlayedAt?: number;
};

export const getTrackAggregatesSince = (sinceMs?: number): TrackAggregate[] => {
  const d = ensureDb();
  if (!d) return [];
  const rows = d.getAllSync(
    `SELECT 
        MAX(spotifyId) as trackId,
        MAX(trackName) as trackName,
        MAX(artistName) as artistName,
        MAX(albumName) as albumName,
        MAX(albumArt) as albumArt,
        COUNT(1) as count,
        MAX(playedAt) as lastPlayedAt
      FROM scrobbles
      ${sinceMs ? 'WHERE playedAt > ?' : ''}
      GROUP BY COALESCE(spotifyId, trackName || '|' || artistName)
      ORDER BY count DESC`,
    sinceMs ? [sinceMs] : []
  ) as any[];
  return rows.map((r: any) => ({ ...r }));
};

export const setLastAlbumStatsPush = (ms: number) => setMeta('lastAlbumStatsPush', String(ms));
export const getLastAlbumStatsPush = (): number => {
  const v = getMeta('lastAlbumStatsPush');
  return v ? Number(v) : 0;
};
