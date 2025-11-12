/*
 backfill-v2-stats.ts — Skeleton for migrating v1 stats -> v2

 Usage (PowerShell):
   cd server
   npx ts-node --transpile-only backfill-v2-stats.ts

 Notes:
 - Reads lightweight projections from v1 (albumstats, trackstats, userstatssummaries)
 - Writes idempotent upserts into v2 with unique indexes
 - Batches and minimal concurrency; logs progress every N rows
*/

import mongoose from 'mongoose';

const V1_URI = process.env.MONGODB_URI || '';
const V2_URI = process.env.MONGODB_URI_V2 || '';

if (!V1_URI || !V2_URI) {
  console.error('Missing MONGODB_URI or MONGODB_URI_V2. Aborting.');
  process.exit(1);
}

// Minimal interfaces (adjust to your model fields)
interface AlbumStatV1 { userId: string; albumId?: string; albumName?: string; listenedTracks?: number; totalTracks?: number; count?: number; totalTimeMs?: number; }
interface TrackStatV1 { userId: string; spotifyId?: string; trackName?: string; artistName?: string; count?: number; totalTimeMs?: number; }
interface UserSummaryV1 { userId: string; totalMinutes?: number; totalScrobbles?: number; uniqueArtistsCount?: number; }

const albumKeyOf = (a: AlbumStatV1) => a.albumId || (a.albumName || '').trim();
const trackKeyOf = (t: TrackStatV1) => t.spotifyId || `${(t.artistName||'').trim()}::${(t.trackName||'').trim()}`;

async function run() {
  const v1 = await mongoose.createConnection(V1_URI).asPromise();
  const v2 = await mongoose.createConnection(V2_URI).asPromise();

  console.log('✅ Connected to v1 and v2');

  // Generic helpers using raw collections (no Mongoose models required)
  const v1AlbumStats = v1.collection('albumstats');
  const v1TrackStats = v1.collection('trackstats');
  const v1UserSummaries = v1.collection('userstatssummaries');

  const v2AlbumStats = v2.collection('albumstats');
  const v2TrackStats = v2.collection('trackstats');
  const v2UserSummaries = v2.collection('userstatssummaries');

  const batchSize = Number(process.env.BATCH_SIZE || 1000);

  // Backfill albumstats
  console.log('➡️  Backfilling albumstats...');
  let processed = 0;
  const cursorA = v1AlbumStats.find({}, { projection: { userId: 1, albumId: 1, albumName: 1, listenedTracks: 1, totalTracks: 1, count: 1, totalTimeMs: 1 } }).batchSize(batchSize);
  while (await cursorA.hasNext()) {
    const docs = await cursorA.next();
    if (!docs) break;
    const a = docs as unknown as AlbumStatV1;
    const albumKey = albumKeyOf(a);
    if (!albumKey) continue;

    await v2AlbumStats.updateOne(
      { userId: a.userId, albumKey },
      { $set: { listenedTracks: a.listenedTracks || 0, totalTracks: a.totalTracks || 0, count: a.count || 0, totalTimeMs: a.totalTimeMs || 0 } },
      { upsert: true }
    );
    processed++;
    if (processed % 1000 === 0) console.log(`albumstats: ${processed}`);
  }

  // Backfill trackstats
  console.log('➡️  Backfilling trackstats...');
  processed = 0;
  const cursorT = v1TrackStats.find({}, { projection: { userId: 1, spotifyId: 1, trackName: 1, artistName: 1, count: 1, totalTimeMs: 1 } }).batchSize(batchSize);
  while (await cursorT.hasNext()) {
    const docs = await cursorT.next();
    if (!docs) break;
    const t = docs as unknown as TrackStatV1;
    const trackKey = trackKeyOf(t);
    if (!trackKey) continue;

    await v2TrackStats.updateOne(
      { userId: t.userId, trackKey },
      { $set: { count: t.count || 0, totalTimeMs: t.totalTimeMs || 0 } },
      { upsert: true }
    );
    processed++;
    if (processed % 1000 === 0) console.log(`trackstats: ${processed}`);
  }

  // Backfill userstatssummaries
  console.log('➡️  Backfilling userstatssummaries...');
  processed = 0;
  const cursorU = v1UserSummaries.find({}, { projection: { userId: 1, totalMinutes: 1, totalScrobbles: 1, uniqueArtistsCount: 1 } }).batchSize(batchSize);
  while (await cursorU.hasNext()) {
    const docs = await cursorU.next();
    if (!docs) break;
    const u = docs as unknown as UserSummaryV1;

    await v2UserSummaries.updateOne(
      { userId: u.userId },
      { $set: { totalMinutes: u.totalMinutes || 0, totalScrobbles: u.totalScrobbles || 0, uniqueArtistsCount: u.uniqueArtistsCount || 0 } },
      { upsert: true }
    );
    processed++;
    if (processed % 1000 === 0) console.log(`userstatssummaries: ${processed}`);
  }

  console.log('✅ Backfill completed');
  await v1.close();
  await v2.close();
  process.exit(0);
}

run().catch((e) => {
  console.error('❌ Backfill failed:', e);
  process.exit(1);
});
