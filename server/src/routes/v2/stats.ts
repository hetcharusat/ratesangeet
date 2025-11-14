import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import UserStatsSummary from '../../models/UserStatsSummary.js';
import AlbumStats from '../../models/AlbumStats.js';
import TrackStats from '../../models/TrackStats.js';

const router = Router();

/**
 * GET /api/v2/stats/summary
 * Returns minimal user stats summary
 */
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id;
    
    const summary = await UserStatsSummary.findOne({ userId })
      .select('totalMinutes totalScrobbles uniqueArtistsCount lastScrobbled')
      .lean();
    
    if (!summary) {
      return res.json({
        totalMinutes: 0,
        totalScrobbles: 0,
        uniqueArtistsCount: 0,
        lastScrobbled: null,
      });
    }
    
    // Type-safe access with fallback values
    const result = summary as any;
    res.json({
      totalMinutes: result.totalMinutes ?? 0,
      totalScrobbles: result.totalScrobbles ?? 0,
      uniqueArtistsCount: result.uniqueArtistsCount ?? 0,
      lastScrobbled: result.lastScrobbled ?? null,
    });
  } catch (error) {
    console.error('❌ Error fetching stats summary:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/v2/stats/top-albums?limit=10
 * Returns top albums by albumPlayCount (completion count)
 */
router.get('/top-albums', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const albums = await AlbumStats.find({ userId })
      .select('albumId albumKey albumName artistName albumArt totalTracks albumPlayCount playCount lastPlayedAt lastCompletedAt uniqueTracksPlayed')
      .sort({ albumPlayCount: -1, playCount: -1 })
      .limit(limit)
      .lean();
    
    const results = albums.map((album: any) => ({
      albumId: album.albumId || album.albumKey,
      albumKey: album.albumKey,
      name: album.albumName,
      artist: album.artistName,
      albumArt: album.albumArt,
      totalTracks: album.totalTracks || 0,
      playCount: album.playCount || 0,
      albumPlayCount: album.albumPlayCount || 0,
      completionProgress: album.totalTracks > 0 
        ? Math.round((album.uniqueTracksPlayed?.length || 0) / album.totalTracks * 100)
        : 0,
      lastPlayedAt: album.lastPlayedAt,
      lastCompletedAt: album.lastCompletedAt,
    }));
    
    res.json(results);
  } catch (error) {
    console.error('❌ Error fetching top albums:', error);
    res.status(500).json({ error: 'Failed to fetch top albums' });
  }
});

/**
 * GET /api/v2/stats/top-tracks?limit=10
 * Returns top tracks by playCount
 */
router.get('/top-tracks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const tracks = await TrackStats.find({ userId })
      .select('trackId spotifyId trackKey trackName artistName albumName albumArt playCount lastPlayedAt')
      .sort({ playCount: -1 })
      .limit(limit)
      .lean();
    
    const results = tracks.map((track: any) => ({
      spotifyId: track.spotifyId || track.trackId,
      trackKey: track.trackKey,
      name: track.trackName,
      artist: track.artistName,
      album: track.albumName,
      albumArt: track.albumArt,
      playCount: track.playCount || 0,
      lastPlayedAt: track.lastPlayedAt,
    }));
    
    res.json(results);
  } catch (error) {
    console.error('❌ Error fetching top tracks:', error);
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
});

export default router;
