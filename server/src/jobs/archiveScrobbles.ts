import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Scrobble from '../models/Scrobble';
import AlbumStats from '../models/AlbumStats';
import TrackStats from '../models/TrackStats';
import UserStatsSummary from '../models/UserStatsSummary';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker';
const RETENTION_DAYS = Number(process.env.ARCHIVE_RETENTION_DAYS || 90);
const KEEP_RECENT_COUNT = Number(process.env.ARCHIVE_KEEP_RECENT || 200);
const DRY_RUN = process.env.ARCHIVE_DRY_RUN === '1' || process.env.ARCHIVE_DRY_RUN === 'true';

const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

async function run() {
  console.log('🗄️  Archive job starting', { RETENTION_DAYS, KEEP_RECENT_COUNT, DRY_RUN });
  
  // Check if MongoDB is connected (should be connected by main server)
  if (mongoose.connection.readyState !== 1) {
    console.error('⚠️  MongoDB not connected, skipping archive job');
    return;
  }

  // Iterate distinct users in scrobbles
  const users = await Scrobble.distinct('userId');
  console.log(`📊 Found ${users.length} users with scrobbles`);

  let totalArchived = 0;
  for (const userId of users) {
    try {
      // Fetch recent ids to keep
      const recent = await Scrobble.find({ userId }).sort({ playedAt: -1 }).limit(KEEP_RECENT_COUNT).select('_id').lean();
      const recentIds = recent.map((r: any) => r._id);

      // Find scrobbles older than cutoff and not in recentIds
      const toArchive = await Scrobble.find({ userId, _id: { $nin: recentIds }, playedAt: { $lt: cutoffDate } }).lean();
      if (!toArchive || toArchive.length === 0) continue;

      // Aggregate counts by albumId
      const albumMap = new Map<string, { count: number; lastPlayedAt: number; albumName?: string; artistName?: string; albumArt?: string; albumId?: string }>();
      const trackMap = new Map<string, { count: number; lastPlayedAt: number; trackName?: string; artistName?: string; albumName?: string; albumArt?: string; trackId?: string; durationMs?: number }>();
      
      for (const s of toArchive) {
        const albumId = (s as any).albumId || undefined;
        const albumKey = albumId || ((s as any).albumName || '');
        const trackId = (s as any).spotifyId;
        const trackKey = trackId || ((s as any).trackName || '');
        const playedMs = new Date((s as any).playedAt).getTime();
        
        // Aggregate by album
        const prevAlbum = albumMap.get(albumKey) || { count: 0, lastPlayedAt: 0, albumName: s.albumName, artistName: s.artistName, albumArt: s.albumArt };
        prevAlbum.count += 1;
        if (playedMs > prevAlbum.lastPlayedAt) prevAlbum.lastPlayedAt = playedMs;
        prevAlbum.albumId = albumId;
        albumMap.set(albumKey, prevAlbum);
        
        // Aggregate by track
        const prevTrack = trackMap.get(trackKey) || { count: 0, lastPlayedAt: 0, trackName: s.trackName, artistName: s.artistName, albumName: s.albumName, albumArt: s.albumArt, durationMs: s.durationMs };
        prevTrack.count += 1;
        if (playedMs > prevTrack.lastPlayedAt) prevTrack.lastPlayedAt = playedMs;
        prevTrack.trackId = trackId;
        trackMap.set(trackKey, prevTrack);
      }

      // Prepare bulk ops for AlbumStats
      const albumOps = [] as any[];
      for (const [albumKey, meta] of albumMap.entries()) {
        albumOps.push({
          updateOne: {
            filter: { userId, albumKey },
            update: {
              $setOnInsert: { userId, albumKey, albumId: meta.albumId },
              $set: { albumName: meta.albumName, artistName: meta.artistName, albumArt: meta.albumArt },
              $inc: { playCount: meta.count },
              $max: { lastPlayedAt: new Date(meta.lastPlayedAt) },
            },
            upsert: true,
          },
        });
      }

      if (albumOps.length) {
        if (DRY_RUN) {
          console.log(`[DRY] Would upsert ${albumOps.length} album stats for user ${userId}`);
        } else {
          await AlbumStats.bulkWrite(albumOps, { ordered: false });
        }
      }

      // Prepare bulk ops for TrackStats
      const trackOps = [] as any[];
      for (const [trackKey, meta] of trackMap.entries()) {
        trackOps.push({
          updateOne: {
            filter: { userId, trackKey },
            update: {
              $setOnInsert: { userId, trackKey, trackId: meta.trackId },
              $set: { trackName: meta.trackName, artistName: meta.artistName, albumName: meta.albumName, albumArt: meta.albumArt, durationMs: meta.durationMs },
              $inc: { playCount: meta.count },
              $max: { lastPlayedAt: new Date(meta.lastPlayedAt) },
            },
            upsert: true,
          },
        });
      }

      if (trackOps.length) {
        if (DRY_RUN) {
          console.log(`[DRY] Would upsert ${trackOps.length} track stats for user ${userId}`);
        } else {
          await TrackStats.bulkWrite(trackOps, { ordered: false });
        }
      }

      // Update UserStatsSummary: increment total scrobbles and update lastScrobbled from latest remaining scrobble
      const archivedCount = toArchive.length;
      if (DRY_RUN) {
        console.log(`[DRY] Would archive ${archivedCount} scrobbles for user ${userId}`);
      } else {
        await UserStatsSummary.findOneAndUpdate(
          { userId },
          { $inc: { totalScrobbles: archivedCount } },
          { upsert: true }
        );
      }

      // Delete raw scrobbles
      if (!DRY_RUN) {
        const idsToDelete = toArchive.map((t) => t._id);
        const del = await Scrobble.deleteMany({ _id: { $in: idsToDelete } });
        totalArchived += del.deletedCount || 0;
      }
    } catch (err) {
      console.error('Error processing user', userId, err);
    }
  }

  console.log('✅ Archive job finished', { totalArchived });
}

// Export the function for use by main server
export function runArchiveJob() {
  run().catch((err) => {
    console.error('❌ Archive job failed', err);
    // Don't exit - let the job fail gracefully
  });
}

// If run directly as a script (for manual testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error('❌ Archive job failed', err);
    process.exit(1);
  });
}
