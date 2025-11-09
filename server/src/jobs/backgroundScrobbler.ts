/**
 * Background Scrobbler Job
 * 
 * Runs every 30 minutes to fetch Recently Played tracks from Spotify for all users.
 * 
 * Key Features:
 * - Fetches last 50 tracks from Spotify Recently Played API
 * - Auto-refreshes expired access tokens using refresh tokens
 * - Deduplicates scrobbles using existing unique index (userId + spotifyId + playedAt)
 * - Updates AlbumStats, TrackStats, and UserStatsSummary
 * - Staggered execution (5s delay between users) to avoid CPU overload on free tier
 * - Graceful error handling per user (one failure doesn't stop the job)
 * 
 * Compromise:
 * - Treats all Recently Played tracks as "scrobbled" (bypasses 40% threshold)
 * - User may miss songs if they played >50 between cron runs
 * 
 * Environment:
 * - BACKGROUND_SCROBBLE_ENABLED=true (default: true)
 * - BACKGROUND_SCROBBLE_INTERVAL_MS=1800000 (default: 30 minutes)
 * - BACKGROUND_SCROBBLE_USER_DELAY_MS=5000 (default: 5 seconds)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Scrobble from '../models/Scrobble.js';
import AlbumStats from '../models/AlbumStats.js';
import TrackStats from '../models/TrackStats.js';
import UserStatsSummary from '../models/UserStatsSummary.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played';

const BACKGROUND_SCROBBLE_ENABLED = process.env.BACKGROUND_SCROBBLE_ENABLED !== 'false';
const BACKGROUND_SCROBBLE_INTERVAL_MS = Number(process.env.BACKGROUND_SCROBBLE_INTERVAL_MS) || 30 * 60 * 1000; // 30 minutes
const BACKGROUND_SCROBBLE_USER_DELAY_MS = Number(process.env.BACKGROUND_SCROBBLE_USER_DELAY_MS) || 5000; // 5 seconds between users
const SKIP_DETECTION_ENABLED = process.env.BACKGROUND_SCROBBLE_SKIP_DETECTION !== 'false'; // Enable by default

// Skip detection constants
const SCROBBLE_THRESHOLD = 0.4;           // 40% of track duration
const GRACE_MARGIN_MS = 5000;             // 5 seconds grace for timing imprecision
const PAUSE_DETECTION_MULTIPLIER = 1.5;   // 150% of duration = pause detected
const MAX_RECENT_TRACK_AGE_MS = 120000;   // 2 minutes (for last track evaluation)

interface RecentlyPlayedTrack {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      id?: string;
      name: string;
      images: Array<{ url: string }>;
    };
    duration_ms: number;
  };
  played_at: string;
}

interface RecentlyPlayedResponse {
  items: RecentlyPlayedTrack[];
}

/**
 * Refresh Spotify access token using refresh token
 */
async function refreshUserToken(user: any): Promise<{ accessToken: string; refreshToken?: string }> {
  try {
    const response = await axios.post(
      SPOTIFY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const result: any = { accessToken: data.access_token };
    
    // Spotify may return new refresh token
    if (data.refresh_token) {
      result.refreshToken = data.refresh_token;
    }

    return result;
  } catch (error: any) {
    const errorData = error.response?.data || {};
    const errorType = errorData.error || 'unknown';
    
    console.error(`❌ Failed to refresh token for user ${user.spotifyId}:`, errorData);
    
    // Differentiate between revoked tokens and other errors
    if (errorType === 'invalid_grant') {
      // Token revoked - user needs to re-authenticate
      throw new Error('TOKEN_REVOKED');
    } else {
      // Other error (network, server, etc.)
      throw new Error('Token refresh failed');
    }
  }
}

/**
 * Fetch Recently Played tracks from Spotify
 */
async function fetchRecentlyPlayed(accessToken: string, limit = 50): Promise<RecentlyPlayedTrack[]> {
  try {
    const response = await axios.get<RecentlyPlayedResponse>(
      `${SPOTIFY_RECENTLY_PLAYED_URL}?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    return response.data.items || [];
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    console.error('Failed to fetch recently played:', error.response?.data || error.message);
    throw new Error('Fetch failed');
  }
}

/**
 * Filter out skipped tracks using time gap analysis
 * Applies 40% scrobble threshold by comparing timestamps of consecutive tracks
 */
function filterSkippedTracks(tracks: RecentlyPlayedTrack[], spotifyId: string): RecentlyPlayedTrack[] {
  if (!SKIP_DETECTION_ENABLED || tracks.length === 0) {
    return tracks;
  }

  const filtered: RecentlyPlayedTrack[] = [];
  const nowMs = Date.now();

  // Sort by played_at ascending (oldest first) for easier logic
  const sorted = [...tracks].sort((a, b) =>
    new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentStartMs = new Date(current.played_at).getTime();
    const currentDuration = current.track.duration_ms;
    const scrobbleThreshold = currentDuration * SCROBBLE_THRESHOLD;

    // EDGE CASE 1: First track (oldest in list)
    // We don't know what came before it, so assume it was listened to
    if (i === 0) {
      filtered.push(current);
      console.log(`  ✅ [${spotifyId}] First track (assume listened): ${current.track.name}`);
      continue;
    }

    // EDGE CASE 2: Last track (most recent)
    // Compare with current time to see if enough time has passed
    if (!next) {
      const timeSinceStartMs = nowMs - currentStartMs;

      // If track is "old enough" (> 2 min ago), likely finished or played enough
      if (timeSinceStartMs >= MAX_RECENT_TRACK_AGE_MS) {
        filtered.push(current);
        console.log(`  ✅ [${spotifyId}] Last track (old enough): ${current.track.name} (${Math.floor(timeSinceStartMs / 1000)}s ago)`);
      } else if (timeSinceStartMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
        // Enough time passed to reach scrobble threshold
        filtered.push(current);
        console.log(`  ✅ [${spotifyId}] Last track (threshold reached): ${current.track.name} (${Math.floor(timeSinceStartMs / 1000)}s ago)`);
      } else {
        // Too recent - wait for next sync
        console.log(`  ⏭️  [${spotifyId}] Last track (too recent): ${current.track.name} (${Math.floor(timeSinceStartMs / 1000)}s ago, need ${Math.floor((scrobbleThreshold - GRACE_MARGIN_MS) / 1000)}s)`);
      }
      continue;
    }

    // NORMAL CASE: Compare with next track
    const nextStartMs = new Date(next.played_at).getTime();
    const actualPlaybackMs = nextStartMs - currentStartMs;

    // EDGE CASE 3: Long pause detection
    // If gap is 50%+ longer than track duration, assume full listen + pause
    if (actualPlaybackMs > currentDuration * PAUSE_DETECTION_MULTIPLIER) {
      filtered.push(current);
      console.log(`  ✅ [${spotifyId}] Full listen (pause detected): ${current.track.name} (gap: ${Math.floor(actualPlaybackMs / 1000)}s, duration: ${Math.floor(currentDuration / 1000)}s)`);
      continue;
    }

    // EDGE CASE 4: Timing precision (grace margin)
    // Count if within grace margin of threshold
    if (actualPlaybackMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
      filtered.push(current);
      const percent = Math.floor((actualPlaybackMs / currentDuration) * 100);
      console.log(`  ✅ [${spotifyId}] Scrobble: ${current.track.name} (played ${Math.floor(actualPlaybackMs / 1000)}s / ${Math.floor(currentDuration / 1000)}s = ${percent}%)`);
    } else {
      const percent = Math.floor((actualPlaybackMs / currentDuration) * 100);
      console.log(`  ⏭️  [${spotifyId}] Skip: ${current.track.name} (played ${Math.floor(actualPlaybackMs / 1000)}s / ${Math.floor(currentDuration / 1000)}s = ${percent}%, need ${Math.floor(SCROBBLE_THRESHOLD * 100)}%)`);
    }
  }

  const skippedCount = tracks.length - filtered.length;
  console.log(`  📊 [${spotifyId}] Skip detection: ${filtered.length} scrobbles, ${skippedCount} skipped`);

  return filtered;
}

/**
 * Process recently played tracks for a user
 * - Filters skipped tracks using time gap analysis
 * - Saves new scrobbles to DB (deduplication via unique index)
 * - Updates aggregate stats (AlbumStats, TrackStats, UserStatsSummary)
 */
async function processUserScrobbles(userId: mongoose.Types.ObjectId, tracks: RecentlyPlayedTrack[], spotifyId: string): Promise<number> {
  if (!tracks || tracks.length === 0) {
    return 0;
  }

  // Apply skip detection filter
  const filteredTracks = filterSkippedTracks(tracks, spotifyId);

  if (filteredTracks.length === 0) {
    console.log(`  ⚠️  [${spotifyId}] All tracks filtered out (all skipped)`);
    return 0;
  }

  let newScrobblesCount = 0;
  const albumStatsMap = new Map<string, any>();
  const trackStatsMap = new Map<string, any>();

  for (const item of filteredTracks) {
    const { track, played_at } = item;
    const spotifyId = track.id;
    const trackName = track.name;
    const artistName = track.artists.map((a) => a.name).join(', ');
    const albumId = track.album.id || undefined;
    const albumName = track.album.name;
    const albumArt = track.album.images[0]?.url || undefined;
    const durationMs = track.duration_ms;
    const playedAt = new Date(played_at);

    // Round playedAt to 10s for deduplication (same as real-time scrobbling)
    const roundedMs = Math.floor(playedAt.getTime() / 10000) * 10000;
    const roundedPlayedAt = new Date(roundedMs);

    try {
      // Try to insert scrobble (unique index will prevent duplicates)
      const result = await Scrobble.findOneAndUpdate(
        { userId, spotifyId, playedAt: roundedPlayedAt },
        {
          $setOnInsert: {
            userId,
            spotifyId,
            trackName,
            artistName,
            albumId,
            albumName,
            albumArt,
            durationMs,
            playedAt: roundedPlayedAt,
            source: 'spotify',
          },
        },
        { upsert: true, new: true }
      );

      // If document was just created, count it as new
      if (result && result.createdAt.getTime() === result.updatedAt.getTime()) {
        newScrobblesCount++;

        // Aggregate album stats
        const albumKey = albumId || albumName;
        if (!albumStatsMap.has(albumKey)) {
          albumStatsMap.set(albumKey, {
            albumKey,
            albumId,
            albumName,
            artistName,
            albumArt,
            count: 0,
            lastPlayedAt: roundedPlayedAt,
          });
        }
        const albumStat = albumStatsMap.get(albumKey);
        albumStat.count++;
        if (roundedPlayedAt > albumStat.lastPlayedAt) {
          albumStat.lastPlayedAt = roundedPlayedAt;
        }

        // Aggregate track stats
        const trackKey = spotifyId || trackName;
        if (!trackStatsMap.has(trackKey)) {
          trackStatsMap.set(trackKey, {
            trackKey,
            trackId: spotifyId,
            trackName,
            artistName,
            albumName,
            albumArt,
            durationMs,
            count: 0,
            lastPlayedAt: roundedPlayedAt,
          });
        }
        const trackStat = trackStatsMap.get(trackKey);
        trackStat.count++;
        if (roundedPlayedAt > trackStat.lastPlayedAt) {
          trackStat.lastPlayedAt = roundedPlayedAt;
        }
      }
    } catch (error: any) {
      // Duplicate key error is expected (E11000), skip it
      if (error.code !== 11000) {
        console.error(`Error saving scrobble for user ${userId}:`, error.message);
      }
    }
  }

  // Update AlbumStats in bulk
  if (albumStatsMap.size > 0) {
    const albumOps = Array.from(albumStatsMap.values()).map((stat) => ({
      updateOne: {
        filter: { userId, albumKey: stat.albumKey },
        update: {
          $setOnInsert: { userId, albumKey: stat.albumKey, albumId: stat.albumId },
          $set: { albumName: stat.albumName, artistName: stat.artistName, albumArt: stat.albumArt },
          $inc: { playCount: stat.count },
          $max: { lastPlayedAt: stat.lastPlayedAt },
        },
        upsert: true,
      },
    }));

    try {
      await AlbumStats.bulkWrite(albumOps, { ordered: false });
    } catch (error: any) {
      console.error(`Error updating album stats for user ${userId}:`, error.message);
    }
  }

  // Update TrackStats in bulk
  if (trackStatsMap.size > 0) {
    const trackOps = Array.from(trackStatsMap.values()).map((stat) => ({
      updateOne: {
        filter: { userId, trackKey: stat.trackKey },
        update: {
          $setOnInsert: { userId, trackKey: stat.trackKey, trackId: stat.trackId },
          $set: {
            trackName: stat.trackName,
            artistName: stat.artistName,
            albumName: stat.albumName,
            albumArt: stat.albumArt,
            durationMs: stat.durationMs,
          },
          $inc: { playCount: stat.count },
          $max: { lastPlayedAt: stat.lastPlayedAt },
        },
        upsert: true,
      },
    }));

    try {
      await TrackStats.bulkWrite(trackOps, { ordered: false });
    } catch (error: any) {
      console.error(`Error updating track stats for user ${userId}:`, error.message);
    }
  }

  // Update UserStatsSummary
  if (newScrobblesCount > 0) {
    try {
      await UserStatsSummary.findOneAndUpdate(
        { userId },
        { $inc: { totalScrobbles: newScrobblesCount } },
        { upsert: true }
      );
    } catch (error: any) {
      console.error(`Error updating user stats summary for user ${userId}:`, error.message);
    }
  }

  return newScrobblesCount;
}

/**
 * Process a single user: refresh token if needed, fetch recently played, save scrobbles
 */
async function processUser(user: any): Promise<{ success: boolean; newScrobbles: number; error?: string }> {
  const userId = user._id;
  const spotifyId = user.spotifyId;

  try {
    let accessToken = user.accessToken;
    let tokenRefreshed = false;

    // Try to fetch with current token
    let tracks: RecentlyPlayedTrack[] = [];
    try {
      tracks = await fetchRecentlyPlayed(accessToken);
    } catch (error: any) {
      // If unauthorized, refresh token and retry
      if (error.message === 'UNAUTHORIZED') {
        console.log(`🔄 Token expired for user ${spotifyId}, refreshing...`);
        
        try {
          const refreshed = await refreshUserToken(user);
          accessToken = refreshed.accessToken;
          tokenRefreshed = true;

          // Update user's tokens in DB
          const updateData: any = { accessToken };
          if (refreshed.refreshToken) {
            updateData.refreshToken = refreshed.refreshToken;
          }
          await User.findByIdAndUpdate(userId, updateData);

          // Retry fetch with new token
          tracks = await fetchRecentlyPlayed(accessToken);
        } catch (refreshError: any) {
          // Token was revoked - user needs to re-authenticate
          if (refreshError.message === 'TOKEN_REVOKED') {
            console.warn(`⚠️  User ${spotifyId} needs to re-authenticate (token revoked)`);
            // TODO: Add field to User model to track this state and notify user
            return { success: false, newScrobbles: 0, error: 'Token revoked - user needs to re-login' };
          }
          throw refreshError;
        }
      } else {
        throw error;
      }
    }

    // Process tracks and save scrobbles
    const newScrobbles = await processUserScrobbles(userId, tracks, spotifyId);

    console.log(`✅ User ${spotifyId}: ${newScrobbles} new scrobbles from ${tracks.length} tracks${tokenRefreshed ? ' (token refreshed)' : ''}`);
    return { success: true, newScrobbles };
  } catch (error: any) {
    console.error(`❌ Failed to process user ${spotifyId}:`, error.message);
    return { success: false, newScrobbles: 0, error: error.message };
  }
}

/**
 * Main job: process all users with staggered delays
 * Uses existing MongoDB connection from main server (no connect/disconnect)
 * Exported for manual triggering via API endpoint
 */
export async function runBackgroundScrobbler() {
  console.log('🎵 Starting background scrobbler job...');

  try {
    // Check if MongoDB is connected (should be connected by main server)
    if (mongoose.connection.readyState !== 1) {
      console.error('⚠️  MongoDB not connected, skipping scrobbler job');
      return;
    }

    // Get all users
    const users = await User.find().select('_id spotifyId accessToken refreshToken').lean();
    console.log(`📊 Found ${users.length} users to process`);

    if (users.length === 0) {
      console.log('No users to process');
      return;
    }

    let totalNewScrobbles = 0;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`\n[${i + 1}/${users.length}] Processing user: ${user.spotifyId}`);

      const result = await processUser(user);
      if (result.success) {
        successCount++;
        totalNewScrobbles += result.newScrobbles;
      } else {
        failureCount++;
      }

      // Stagger requests (except for last user)
      if (i < users.length - 1) {
        console.log(`⏳ Waiting ${BACKGROUND_SCROBBLE_USER_DELAY_MS}ms before next user...`);
        await new Promise((resolve) => setTimeout(resolve, BACKGROUND_SCROBBLE_USER_DELAY_MS));
      }
    }

    console.log('\n🎉 Background scrobbler job completed');
    console.log(`📊 Stats: ${successCount} success, ${failureCount} failures, ${totalNewScrobbles} new scrobbles`);
  } catch (error: any) {
    console.error('❌ Background scrobbler job failed:', error.message);
    // Don't throw - let the job fail gracefully without crashing the server
  }
}

/**
 * Start the cron job (run immediately, then every interval)
 */
export function startBackgroundScrobbler() {
  if (!BACKGROUND_SCROBBLE_ENABLED) {
    console.log('⚠️ Background scrobbler disabled (BACKGROUND_SCROBBLE_ENABLED=false)');
    return;
  }

  const intervalMinutes = Math.floor(BACKGROUND_SCROBBLE_INTERVAL_MS / 60000);
  console.log(`🚀 Background scrobbler enabled (interval: ${intervalMinutes} minutes)`);

  // Run immediately on startup
  runBackgroundScrobbler().catch((err) => {
    console.error('Initial background scrobbler run failed:', err);
  });

  // Schedule recurring runs
  setInterval(() => {
    runBackgroundScrobbler().catch((err) => {
      console.error('Scheduled background scrobbler run failed:', err);
    });
  }, BACKGROUND_SCROBBLE_INTERVAL_MS);
}

// If running directly (not imported), execute once
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackgroundScrobbler()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
