import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import axios from 'axios';

const router = Router();

/**
 * GET /api/v2/now-playing
 * Returns currently playing track from Spotify
 */
router.get('/now-playing', requireAuth, async (req: Request, res: Response) => {
  try {
    const accessToken = (req as any).authUser.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No access token' });
    }
    
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.status === 204 || !response.data || !response.data.item) {
      return res.json({ isPlaying: false });
    }
    
    const { item, progress_ms, is_playing } = response.data;
    
    res.json({
      isPlaying: is_playing,
      trackId: item.id,
      trackName: item.name,
      artistName: item.artists?.[0]?.name || 'Unknown Artist',
      albumId: item.album?.id,
      albumName: item.album?.name || 'Unknown Album',
      albumArt: item.album?.images?.[0]?.url,
      durationMs: item.duration_ms,
      progressMs: progress_ms,
      deviceName: response.data.device?.name,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.response?.status === 204) {
      return res.json({ isPlaying: false });
    }
    console.error('❌ Error fetching now playing:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch now playing' });
  }
});

/**
 * GET /api/v2/playing-progress
 * Returns only progress (lighter endpoint for polling)
 */
router.get('/playing-progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const accessToken = (req as any).authUser.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'No access token' });
    }
    
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.status === 204 || !response.data) {
      return res.json({ isPlaying: false });
    }
    
    const { progress_ms, is_playing, item } = response.data;
    
    res.json({
      isPlaying: is_playing,
      progressMs: progress_ms,
      durationMs: item?.duration_ms,
      deviceName: response.data.device?.name,
    });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.response?.status === 204) {
      return res.json({ isPlaying: false });
    }
    console.error('❌ Error fetching playing progress:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

export default router;
