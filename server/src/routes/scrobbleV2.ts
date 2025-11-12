import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import Scrobble from '../models/Scrobble';
import TrackStats from '../models/TrackStats';
import AlbumStats from '../models/AlbumStats';
import UserStatsSummary from '../models/UserStatsSummary';
import CompletionEvent from '../models/CompletionEvent';
import { spotifyService } from '../services/SpotifyService';
import { snapshotRateLimiter } from '../middleware/optimization';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * 🚀 V2: Smart Server-Assisted Scrobbling
 * 
 * Mobile app sends RAW playback snapshots every 30s.
 * Server calculates EVERYTHING:
 * - 40% threshold detection
 * - Deduplication (playedAtRounded10s)
 * - Replay guard (15 min)
 * - Album completion (4-track min, 70%)
 * 
 * Mobile complexity: ZERO! Just poll & send.
 */

interface PlaybackSnapshot {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs: number;
  progressMs: number;
  timestamp: number;       // When this snapshot was taken
  isPlaying: boolean;
  device?: string;
}

/**
 * POST /api/scrobble/v2/snapshot
 * 
 * Mobile sends current playback state every ~30s.
 * Server calculates if it should scrobble.
 * 
 * Request: { userId, accessToken, snapshot: PlaybackSnapshot }
 * Response: { action: 'scrobbled' | 'skipped' | 'duplicate' | 'too-early', ... }
 * 
 * Rate limit: 150 requests/min (30s poll + buffer)
 */
router.post('/v2/snapshot', snapshotRateLimiter, requireAuth, async (req: Request, res: Response) => {
  const { accessToken, snapshot } = req.body as {
    accessToken?: string;
    snapshot?: PlaybackSnapshot;
  };
  const userId = (req as any).authUser._id; // Validated by requireAuth middleware

  if (!accessToken || !snapshot) {
    return res.status(400).json({ error: 'accessToken and snapshot required' });
  }

  const {
    spotifyId,
    trackName,
    artistName,
    albumId,
    albumName,
    albumArt,
    durationMs,
    progressMs,
    timestamp,
    isPlaying,
    device,
  } = snapshot;

  // Validate snapshot
  if (!spotifyId || !trackName || !artistName || durationMs === undefined || progressMs === undefined) {
    return res.status(400).json({ error: 'Invalid snapshot: missing required fields' });
  }

  try {
    // ========== STEP 1: Calculate isScrobbled (40% threshold OR >= 30s) ==========
    const isScrobbled = (progressMs / durationMs >= 0.4) || (progressMs >= 30000);

    // ========== STEP 2: Calculate playedAtRounded10s (stable dedup key) ==========
    const startedAtMs = timestamp - progressMs;
    const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
    const playedAt = new Date(roundedStartMs);
    const playedAtRounded10s = new Date(roundedStartMs);

    // ========== STEP 3: Idempotent upsert (no duplicates) ==========
    // Phase A: Ensure a scrobble doc exists (upsert) and always set latest fields
    await Scrobble.updateOne(
      { userId, spotifyId, playedAtRounded10s },
      {
        $setOnInsert: {
          userId,
          spotifyId,
          playedAt,
          playedAtRounded10s,
          source: 'spotify',
          clientVersion: 'v2-snapshot',
        },
        $set: {
          trackName,
          artistName,
          albumId,
          albumName,
          albumArt,
          durationMs,
          device,
          isPaused: !isPlaying,
          // Keep isSkip true until promoted to scrobbled (flip below)
          isSkip: !isScrobbled,
        },
      },
      { upsert: true }
    );

    // Phase B: If threshold reached, atomically promote to scrobbled exactly once
    let promotedNow = false;
    if (isScrobbled) {
      const promoteRes = await Scrobble.updateOne(
        { userId, spotifyId, playedAtRounded10s, isScrobbled: { $ne: true } },
        { $set: { isScrobbled: true, isSkip: false } }
      );
      promotedNow = promoteRes.modifiedCount === 1;
    }

    // Fetch scrobble id for response
    const scrobbleDoc = await Scrobble.findOne({ userId, spotifyId, playedAtRounded10s }).select('_id isScrobbled').lean();

    if (!isScrobbled) {
      return res.json({
        action: 'too-early',
        message: `Track progress ${Math.floor(progressMs/1000)}s (${Math.floor(progressMs/durationMs*100)}%) < 40% threshold`,
        progressPercent: Math.floor(progressMs/durationMs*100),
        scrobbleId: scrobbleDoc?._id,
      });
    }

    // ========== STEP 4: Update TrackStats (with replay guard) ==========
    if (!promotedNow) {
      // Someone else already promoted or already counted; treat as duplicate
      return res.json({
        action: 'duplicate',
        message: 'Already processed this playback snapshot',
        scrobbleId: scrobbleDoc?._id,
        wasScrobbled: true,
      });
    }

    const trackKey = spotifyId || `${artistName}::${trackName}`;
    const existingTrack = await TrackStats.findOne({ userId, trackKey }).select('lastPlayedAt').lean();

    const replayGuardMs = 15 * 60 * 1000; // 15 minutes
    const shouldUpdateTrack = !existingTrack?.lastPlayedAt || (playedAt.getTime() - new Date(existingTrack.lastPlayedAt).getTime() >= replayGuardMs);

    let trackStatsUpdated = false;
    if (shouldUpdateTrack) {
      await TrackStats.findOneAndUpdate(
        { userId, trackKey },
        {
          $setOnInsert: {
            trackId: spotifyId,
            trackKey,
          },
          $set: {
            trackName,
            artistName,
            albumName,
            albumArt,
            lastPlayedAt: playedAt,
            replayGuardAt: playedAt,
          },
          $inc: { playCount: 1 },
        },
        { upsert: true }
      );
      trackStatsUpdated = true;
    }

    // ========== STEP 5: Update AlbumStats (4-track min, 70% completion) ==========
    let albumStatsUpdated = false;
    let albumCompleted = false;
    let albumProgress = 0;

    if (albumId) {
      // Fetch totalTracks (cached)
      const totalTracks = await spotifyService.getAlbumTotalTracks(albumId, accessToken);
      
      if (totalTracks && totalTracks >= 4) {
        const albumKey = albumId || albumName || 'Unknown Album';
        const albumStats = await AlbumStats.findOneAndUpdate(
          { userId, albumKey },
          {
            $setOnInsert: {
              albumId,
              albumKey,
              totalTracks,
              albumPlayCount: 0,
              uniqueTracksPlayed: [],
            },
            $set: {
              albumName,
              artistName,
              albumArt,
              lastPlayedAt: playedAt,
            },
            $inc: { playCount: 1 },
          },
          { upsert: true, new: true }
        );

        albumStatsUpdated = true;

        // Add track to uniqueTracksPlayed (if not already present)
        const uniqueTracks = Array.isArray(albumStats.uniqueTracksPlayed) ? albumStats.uniqueTracksPlayed : [];
        if (!uniqueTracks.includes(spotifyId)) {
          uniqueTracks.push(spotifyId);

          // Check if 70% threshold reached
          albumProgress = Math.floor((uniqueTracks.length / totalTracks) * 100);
          if (albumProgress >= 70) {
            // Completion achieved! Increment albumPlayCount, reset cycle
            await AlbumStats.updateOne(
              { _id: albumStats._id },
              {
                $inc: { albumPlayCount: 1 },
                $set: {
                  uniqueTracksPlayed: [], // Reset for new cycle
                  lastCompletedAt: playedAt,
                },
              }
            );

            albumCompleted = true;

            // Emit completion event (optional analytics)
            try {
              await CompletionEvent.create({
                userId,
                albumId,
                albumKey,
                albumName: albumName || 'Unknown Album',
                artistName,
                albumArt,
                completedAt: playedAt,
              });
            } catch (e) {
              console.warn('[SNAPSHOT] CompletionEvent failed:', (e as any)?.message);
            }
          } else {
            // Partial progress: update uniqueTracksPlayed
            await AlbumStats.updateOne(
              { _id: albumStats._id },
              { $set: { uniqueTracksPlayed: uniqueTracks } }
            );
          }
        } else {
          // Track already counted in this cycle
          albumProgress = Math.floor((uniqueTracks.length / totalTracks) * 100);
        }
      }
    }

    // ========== STEP 6: Update UserStatsSummary ==========
    await UserStatsSummary.findOneAndUpdate(
      { userId },
      {
        $inc: { totalScrobbles: 1 },
        $set: {
          lastScrobbled: {
            spotifyId,
            trackName,
            artistName,
            albumName,
            playedAt,
          },
        },
      },
      { upsert: true }
    );

    // ========== RESPONSE ==========
    return res.json({
      action: 'scrobbled',
      message: 'Track scrobbled successfully',
      scrobbleId: scrobbleDoc?._id,
      stats: {
        trackStatsUpdated,
        trackReplayGuardPassed: shouldUpdateTrack,
        albumStatsUpdated,
        albumCompleted,
        albumProgress: albumProgress > 0 ? `${albumProgress}%` : undefined,
      },
    });
  } catch (error: any) {
    console.error('[SNAPSHOT] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to process snapshot',
      message: error.message,
    });
  }
});

/**
 * POST /api/scrobble/v2/batch-snapshot
 * 
 * Mobile sends multiple snapshots at once (e.g., after being offline).
 * Server processes each one individually.
 * 
 * Request: { userId, accessToken, snapshots: PlaybackSnapshot[] }
 * Response: { processed, scrobbled, skipped, duplicates, errors }
 * 
 * Rate limit: 150 requests/min (shared with single snapshot)
 */
router.post('/v2/batch-snapshot', snapshotRateLimiter, async (req: Request, res: Response) => {
  const { userId, accessToken, snapshots } = req.body as {
    userId?: string;
    accessToken?: string;
    snapshots?: PlaybackSnapshot[];
  };

  if (!userId || !accessToken || !Array.isArray(snapshots)) {
    return res.status(400).json({ error: 'userId, accessToken, and snapshots[] required' });
  }

  if (snapshots.length > 100) {
    return res.status(400).json({ error: 'Max 100 snapshots per batch' });
  }

  const results = {
    ok: true,
    processed: 0,
    scrobbled: 0,
    skipped: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  for (const snapshot of snapshots) {
    try {
      results.processed++;

      // Call single snapshot endpoint logic by making internal HTTP-like call
      const mockRes = {
        jsonData: null as any,
        json: function(data: any) { this.jsonData = data; return this; },
        status: function(code: number) { return { json: (data: any) => ({ statusCode: code, ...data }) }; },
      };

      // Process snapshot using same logic as single endpoint
      // (This is a simplified approach - in production, extract logic to shared function)
      try {
        const response = await axios.post(`http://localhost:5000/api/scrobble/v2/snapshot`, {
          userId,
          accessToken,
          snapshot,
        });
        
        const result = response.data;
        if (result.action === 'scrobbled') results.scrobbled++;
        else if (result.action === 'duplicate') results.duplicates++;
        else if (result.action === 'too-early') results.skipped++;
      } catch (err: any) {
        if (err.response?.data?.action) {
          const result = err.response.data;
          if (result.action === 'scrobbled') results.scrobbled++;
          else if (result.action === 'duplicate') results.duplicates++;
          else if (result.action === 'too-early') results.skipped++;
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      results.errors.push(`Snapshot ${results.processed}: ${error.message}`);
    }
  }

  return res.json(results);
});

export default router;
