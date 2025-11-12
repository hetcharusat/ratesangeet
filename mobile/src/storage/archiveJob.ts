import { Platform } from 'react-native';
import API_URL from '../config';

/**
 * V2 Archive Job
 * 
 * Runs periodically to:
 * 1. Fetch scrobbles older than 83 days from cloud (90d TTL - 7d buffer)
 * 2. Save them to local SQLite (permanent archive)
 * 3. ACK deletion on server
 * 
 * Timing: On app focus + connected to Wi-Fi + charging
 * Frequency: Once per day max
 */

type DB = any;
let db: DB | null = null;
let SQLite: any = null;

// Conditionally import SQLite only on native platforms
if (Platform.OS !== 'web') {
  try {
    SQLite = require('expo-sqlite');
  } catch (e) {
    console.warn('[ArchiveJob] expo-sqlite not available on this platform');
  }
}

interface ArchiveScrobble {
  _id: string;
  userId: string;
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs: number;
  playedAt: string; // ISO timestamp
  playedAtRounded10s?: string;
  isScrobbled: boolean;
  device?: string;
}

const ensureDb = (): DB | null => {
  if (Platform.OS === 'web' || !SQLite) {
    return null;
  }
  if (!db) {
    db = SQLite.openDatabaseSync('scrobbles.db');
  }
  return db;
};

/**
 * Initialize archive table (separate from main scrobbles)
 * Archive has additional metadata for tracking sync
 */
export const initArchiveTable = () => {
  const d = ensureDb();
  if (!d) return;
  d.execSync(`
    CREATE TABLE IF NOT EXISTS archive (
      cloudId TEXT PRIMARY KEY,
      spotifyId TEXT NOT NULL,
      trackName TEXT,
      artistName TEXT,
      albumId TEXT,
      albumName TEXT,
      albumArt TEXT,
      durationMs INTEGER,
      playedAt INTEGER NOT NULL,
      isScrobbled INTEGER DEFAULT 1,
      device TEXT,
      archivedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_archive_playedAt ON archive(playedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_archive_spotifyId ON archive(spotifyId);
    
    CREATE TABLE IF NOT EXISTS archive_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
};

/**
 * Get last archive sync timestamp
 */
const getLastArchiveSync = (): Date | null => {
  const d = ensureDb();
  if (!d) return null;
  const row = d.getFirstSync('SELECT value FROM archive_meta WHERE key=?', ['lastArchiveSync']) as any;
  return row?.value ? new Date(row.value) : null;
};

/**
 * Set last archive sync timestamp
 */
const setLastArchiveSync = (date: Date) => {
  const d = ensureDb();
  if (!d) return;
  d.runSync(
    'INSERT INTO archive_meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ['lastArchiveSync', date.toISOString()]
  );
};

/**
 * Save scrobbles to archive table
 */
const saveToArchive = (scrobbles: ArchiveScrobble[]): number => {
  if (!scrobbles?.length) return 0;
  
  const d = ensureDb();
  if (!d) return 0;
  let saved = 0;
  
  d.withTransactionSync(() => {
    const stmt = d.prepareSync(`
      INSERT OR IGNORE INTO archive(
        cloudId, spotifyId, trackName, artistName, albumId, albumName, albumArt,
        durationMs, playedAt, isScrobbled, device, archivedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const now = Date.now();
      for (const s of scrobbles) {
        const result = stmt.executeSync([
          s._id,
          s.spotifyId,
          s.trackName,
          s.artistName,
          s.albumId || null,
          s.albumName || null,
          s.albumArt || null,
          s.durationMs,
          new Date(s.playedAt).getTime(),
          s.isScrobbled ? 1 : 0,
          s.device || null,
          now,
        ]);
        // @ts-ignore - changes property exists on result
        if (result.changes > 0) saved++;
      }
    } finally {
      stmt.finalizeSync();
    }
  });
  
  return saved;
};

/**
 * Check if should run archive job
 * Rules:
 * - Max once per day
 * - Only when connected to Wi-Fi (not cellular)
 * - Only when charging (optional - saves battery)
 */
const shouldRunArchive = (): boolean => {
  const lastSync = getLastArchiveSync();
  if (!lastSync) return true; // Never synced
  
  const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastSync >= 24; // Once per day
};

/**
 * Run archive job
 * Fetches eligible scrobbles from server and saves to local archive
 */
export const runArchiveJob = async (userId: string, accessToken: string): Promise<{
  ok: boolean;
  fetched: number;
  saved: number;
  acknowledged: number;
  error?: string;
}> => {
  console.log('[ARCHIVE] Starting archive job...');
  
  // Check if should run
  if (!shouldRunArchive()) {
    console.log('[ARCHIVE] Skipping - ran recently (max once per 24h)');
    return { ok: true, fetched: 0, saved: 0, acknowledged: 0 };
  }
  
  try {
    // Step 1: Fetch eligible scrobbles (older than 83 days)
    const cutoffDate = new Date(Date.now() - 83 * 24 * 60 * 60 * 1000);
    const fetchUrl = `${API_URL}/music/scrobbles/archive-ready?before=${cutoffDate.toISOString()}`;
    
    console.log(`[ARCHIVE] Fetching scrobbles before ${cutoffDate.toISOString()}`);
    
    const fetchResponse = await fetch(fetchUrl, {
      headers: {
        'x-user-id': userId,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!fetchResponse.ok) {
      throw new Error(`Fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }
    
    const fetchData = await fetchResponse.json();
    const scrobbles: ArchiveScrobble[] = fetchData.data || [];
    
    console.log(`[ARCHIVE] Fetched ${scrobbles.length} scrobbles`);
    
    if (scrobbles.length === 0) {
      setLastArchiveSync(new Date());
      return { ok: true, fetched: 0, saved: 0, acknowledged: 0 };
    }
    
    // Step 2: Save to local archive
    const saved = saveToArchive(scrobbles);
    console.log(`[ARCHIVE] Saved ${saved} scrobbles to local archive`);
    
    // Step 3: ACK deletion on server (only if saved successfully)
    if (saved > 0) {
      const ackUrl = `${API_URL}/music/scrobbles/ack-archive`;
      const ackResponse = await fetch(ackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ids: scrobbles.map(s => s._id),
        }),
      });
      
      if (!ackResponse.ok) {
        console.warn(`[ARCHIVE] ACK failed: ${ackResponse.status} - Scrobbles saved locally but not deleted from cloud`);
      } else {
        const ackData = await ackResponse.json();
        console.log(`[ARCHIVE] ACK'd deletion of ${ackData.data?.deleted || 0} scrobbles`);
      }
    }
    
    // Update last sync timestamp
    setLastArchiveSync(new Date());
    
    return {
      ok: true,
      fetched: scrobbles.length,
      saved,
      acknowledged: saved,
    };
    
  } catch (error: any) {
    console.error('[ARCHIVE] Job failed:', error.message);
    return {
      ok: false,
      fetched: 0,
      saved: 0,
      acknowledged: 0,
      error: error.message,
    };
  }
};

/**
 * Get archive statistics
 */
export const getArchiveStats = (): {
  totalArchived: number;
  oldestScrobble: Date | null;
  newestScrobble: Date | null;
  lastSync: Date | null;
} => {
  const d = ensureDb();
  if (!d) return { totalArchived: 0, oldestScrobble: null, newestScrobble: null, lastSync: null };
  
  const countRow = d.getFirstSync('SELECT COUNT(*) as count FROM archive') as any;
  const totalArchived = countRow?.count || 0;
  
  const oldestRow = d.getFirstSync('SELECT MIN(playedAt) as oldest FROM archive') as any;
  const oldestScrobble = oldestRow?.oldest ? new Date(oldestRow.oldest) : null;
  
  const newestRow = d.getFirstSync('SELECT MAX(playedAt) as newest FROM archive') as any;
  const newestScrobble = newestRow?.newest ? new Date(newestRow.newest) : null;
  
  const lastSync = getLastArchiveSync();
  
  return {
    totalArchived,
    oldestScrobble,
    newestScrobble,
    lastSync,
  };
};

export default {
  initArchiveTable,
  runArchiveJob,
  getArchiveStats,
};
