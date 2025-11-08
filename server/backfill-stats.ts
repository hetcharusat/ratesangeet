import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble.js';
import AlbumStats from './src/models/AlbumStats.js';
import TrackStats from './src/models/TrackStats.js';
import UserStatsSummary from './src/models/UserStatsSummary.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotify-tracker';

async function backfillStats() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Get all scrobbles (we'll aggregate them into stats)
    const scrobbles = await Scrobble.find({}).lean();
    console.log(`📊 Found ${scrobbles.length} scrobbles to process\n`);

    if (scrobbles.length === 0) {
      console.log('No scrobbles to process. You need to scrobble some tracks first.');
      return;
    }

    // Group by user
    const userMap = new Map<string, any[]>();
    for (const scrobble of scrobbles) {
      const userId = (scrobble as any).userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, []);
      }
      userMap.get(userId)!.push(scrobble);
    }

    console.log(`👥 Processing ${userMap.size} users...\n`);

    for (const [userId, userScrobbles] of userMap.entries()) {
      console.log(`\n📍 User: ${userId} (${userScrobbles.length} scrobbles)`);

      // Aggregate by album
      const albumMap = new Map<string, { count: number; lastPlayedAt: number; albumName?: string; artistName?: string; albumArt?: string; albumId?: string }>();
      const trackMap = new Map<string, { count: number; lastPlayedAt: number; trackName?: string; artistName?: string; albumName?: string; albumArt?: string; trackId?: string; durationMs?: number }>();

      for (const s of userScrobbles) {
        const albumId = (s as any).albumId || undefined;
        const albumKey = albumId || ((s as any).albumName || '');
        const trackId = (s as any).spotifyId;
        const trackKey = trackId || ((s as any).trackName || '');
        const playedMs = new Date((s as any).playedAt).getTime();

        // Aggregate by album
        const prevAlbum = albumMap.get(albumKey) || { count: 0, lastPlayedAt: 0, albumName: s.albumName, artistName: s.artistName, albumArt: s.albumArt, albumId: undefined };
        prevAlbum.count += 1;
        if (playedMs > prevAlbum.lastPlayedAt) prevAlbum.lastPlayedAt = playedMs;
        if (albumId) prevAlbum.albumId = albumId;
        albumMap.set(albumKey, prevAlbum);

        // Aggregate by track
        const prevTrack = trackMap.get(trackKey) || { count: 0, lastPlayedAt: 0, trackName: s.trackName, artistName: s.artistName, albumName: s.albumName, albumArt: s.albumArt, durationMs: s.durationMs, trackId: undefined };
        prevTrack.count += 1;
        if (playedMs > prevTrack.lastPlayedAt) prevTrack.lastPlayedAt = playedMs;
        if (trackId) prevTrack.trackId = trackId;
        trackMap.set(trackKey, prevTrack);
      }

      // Create AlbumStats
      const albumOps = [] as any[];
      for (const [albumKey, meta] of albumMap.entries()) {
        albumOps.push({
          updateOne: {
            filter: { userId, albumKey },
            update: {
              $set: {
                userId,
                albumKey,
                albumId: meta.albumId,
                albumName: meta.albumName,
                artistName: meta.artistName,
                albumArt: meta.albumArt,
                playCount: meta.count,
                lastPlayedAt: new Date(meta.lastPlayedAt),
              },
            },
            upsert: true,
          },
        });
      }

      if (albumOps.length) {
        await AlbumStats.bulkWrite(albumOps, { ordered: false });
        console.log(`   ✅ Created/updated ${albumOps.length} AlbumStats`);
      }

      // Create TrackStats
      const trackOps = [] as any[];
      for (const [trackKey, meta] of trackMap.entries()) {
        trackOps.push({
          updateOne: {
            filter: { userId, trackKey },
            update: {
              $set: {
                userId,
                trackKey,
                trackId: meta.trackId,
                trackName: meta.trackName,
                artistName: meta.artistName,
                albumName: meta.albumName,
                albumArt: meta.albumArt,
                durationMs: meta.durationMs,
                playCount: meta.count,
                lastPlayedAt: new Date(meta.lastPlayedAt),
              },
            },
            upsert: true,
          },
        });
      }

      if (trackOps.length) {
        await TrackStats.bulkWrite(trackOps, { ordered: false });
        console.log(`   ✅ Created/updated ${trackOps.length} TrackStats`);
      }

      // Create/update UserStatsSummary
      await UserStatsSummary.findOneAndUpdate(
        { userId },
        {
          $set: {
            totalScrobbles: userScrobbles.length,
            totalMinutes: Math.round(userScrobbles.reduce((sum, s: any) => sum + ((s.durationMs || 0) / 60000), 0)),
          },
        },
        { upsert: true }
      );
      console.log(`   ✅ Updated UserStatsSummary (${userScrobbles.length} total scrobbles)`);
    }

    console.log('\n✨ Backfill complete!');
    console.log('   Stats collections now have aggregated data from all scrobbles.');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

backfillStats();
