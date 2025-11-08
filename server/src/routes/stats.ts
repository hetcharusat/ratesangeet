import { Router, Request, Response } from 'express';
import AlbumStats from '../models/AlbumStats.js';
import TrackStats from '../models/TrackStats.js';

const router = Router();

// Batch upsert album stats deltas from device
// Body: { userId: string, albums: Array<{ albumId: string; albumName?: string; artistName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: string | number | Date; }> }
router.post('/album-batch-upsert', async (req: Request, res: Response) => {
  const { userId, albums } = req.body as {
    userId?: string;
    albums?: Array<{
      albumId: string;
      albumName?: string;
      artistName?: string;
      albumArt?: string;
      deltaCount: number;
      lastPlayedAt?: string | number | Date;
    }>;
  };

  if (!userId || !Array.isArray(albums)) {
    return res.status(400).json({ error: 'userId and albums[] required' });
  }

  try {
    const ops = albums
      .filter((a) => a && (a.albumId || a.albumName) && Number.isFinite(a.deltaCount))
      .map((a) => {
        const lastPlayedAt = a.lastPlayedAt ? new Date(a.lastPlayedAt) : undefined;
        const albumKey = a.albumId || a.albumName || '';
        return {
          updateOne: {
            filter: { userId, albumKey },
            update: {
              $setOnInsert: { userId, albumKey, albumId: a.albumId },
              $set: {
                albumName: a.albumName,
                artistName: a.artistName,
                albumArt: a.albumArt,
                ...(lastPlayedAt ? { lastPlayedAt } : {}),
              },
              $inc: { playCount: a.deltaCount },
            },
            upsert: true,
          },
        } as const;
      });

    if (!ops.length) return res.json({ success: true, matched: 0, modified: 0, upserted: 0 });

    const result = await AlbumStats.bulkWrite(ops, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const modified = (result.modifiedCount || 0) + (result.matchedCount || 0) - upserted;
    const matched = result.matchedCount || 0;
    return res.json({ success: true, matched, modified, upserted });
  } catch (error: any) {
    console.error('Error upserting album stats:', error?.message || error);
    return res.status(500).json({ error: 'Failed to upsert album stats' });
  }
});

// Get top albums for a user from cloud summary
router.get('/album/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const { limit = '50' } = req.query as { limit?: string };

  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const items = await AlbumStats.find({ userId })
      .sort({ playCount: -1, lastPlayedAt: -1 })
      .limit(Number(limit));
    return res.json(items);
  } catch (error: any) {
    console.error('Error fetching album stats:', error?.message || error);
    return res.status(500).json({ error: 'Failed to fetch album stats' });
  }
});

export default router;
 
// ===== Track Stats (per-user per-track) =====

// Batch upsert track stats deltas from device
// Body: { userId: string, tracks: Array<{ trackId?: string; trackName?: string; artistName?: string; albumName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: string | number | Date; }> }
router.post('/track-batch-upsert', async (req: Request, res: Response) => {
  const { userId, tracks } = req.body as {
    userId?: string;
    tracks?: Array<{
      trackId?: string;
      trackName?: string;
      artistName?: string;
      albumName?: string;
      albumArt?: string;
      deltaCount: number;
      lastPlayedAt?: string | number | Date;
    }>;
  };

  if (!userId || !Array.isArray(tracks)) {
    return res.status(400).json({ error: 'userId and tracks[] required' });
  }

  try {
    const ops = tracks
      .filter((t) => t && Number.isFinite(t.deltaCount) && (t.trackId || (t.trackName && t.artistName)))
      .map((t) => {
        const lastPlayedAt = t.lastPlayedAt ? new Date(t.lastPlayedAt) : undefined;
        const trackKey = t.trackId || `${t.trackName}|${t.artistName}`;
        return {
          updateOne: {
            filter: { userId, trackKey },
            update: {
              $setOnInsert: { userId, trackKey, trackId: t.trackId },
              $set: {
                trackName: t.trackName,
                artistName: t.artistName,
                albumName: t.albumName,
                albumArt: t.albumArt,
                ...(lastPlayedAt ? { lastPlayedAt } : {}),
              },
              $inc: { playCount: t.deltaCount },
            },
            upsert: true,
          },
        } as const;
      });

    if (!ops.length) return res.json({ success: true, matched: 0, modified: 0, upserted: 0 });

    const result = await TrackStats.bulkWrite(ops, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const matched = result.matchedCount || 0;
    const modified = (result.modifiedCount || 0) + matched - upserted;
    return res.json({ success: true, matched, modified, upserted });
  } catch (error: any) {
    console.error('Error upserting track stats:', error?.message || error);
    return res.status(500).json({ error: 'Failed to upsert track stats' });
  }
});

// Get top tracks for a user from cloud summary
router.get('/track/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const { limit = '50' } = req.query as { limit?: string };

  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const items = await TrackStats.find({ userId })
      .sort({ playCount: -1, lastPlayedAt: -1 })
      .limit(Number(limit));
    return res.json(items);
  } catch (error: any) {
    console.error('Error fetching track stats:', error?.message || error);
    return res.status(500).json({ error: 'Failed to fetch track stats' });
  }
});
