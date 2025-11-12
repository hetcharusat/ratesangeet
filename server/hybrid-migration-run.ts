import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Track from './src/models/Track.js';
import Album from './src/models/Album.js';
import Artist from './src/models/Artist.js';

dotenv.config();

async function runHybridMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 HYBRID NORMALIZATION - MIGRATION STARTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ============================================================
    // STEP 1: Extract Unique Entities from Scrobbles
    // ============================================================
    console.log('📊 STEP 1: Extracting unique entities from scrobbles...\n');

    const scrobbles = await db.collection('scrobbles').find().toArray();
    console.log(`  Found ${scrobbles.length} scrobbles`);

    const uniqueArtists = new Map<string, { name: string; spotifyId?: string }>();
    const uniqueAlbums = new Map<string, { spotifyId: string; name: string; artistName: string; albumArt?: string }>();
    const uniqueTracks = new Map<string, { spotifyId: string; name: string; albumSpotifyId: string; durationMs: number }>();

    scrobbles.forEach(s => {
      // Extract artist
      if (s.artistName) {
        if (!uniqueArtists.has(s.artistName)) {
          uniqueArtists.set(s.artistName, {
            name: s.artistName,
            spotifyId: undefined, // We don't have artist Spotify IDs in scrobbles
          });
        }
      }

      // Extract album
      if (s.albumId && s.albumName) {
        if (!uniqueAlbums.has(s.albumId)) {
          uniqueAlbums.set(s.albumId, {
            spotifyId: s.albumId,
            name: s.albumName,
            artistName: s.artistName,
            albumArt: s.albumArt,
          });
        }
      }

      // Extract track
      if (s.spotifyId && s.trackName && s.albumId) {
        if (!uniqueTracks.has(s.spotifyId)) {
          uniqueTracks.set(s.spotifyId, {
            spotifyId: s.spotifyId,
            name: s.trackName,
            albumSpotifyId: s.albumId,
            durationMs: s.durationMs || 0,
          });
        }
      }
    });

    console.log(`  ✓ Extracted ${uniqueArtists.size} unique artists`);
    console.log(`  ✓ Extracted ${uniqueAlbums.size} unique albums`);
    console.log(`  ✓ Extracted ${uniqueTracks.size} unique tracks\n`);

    // ============================================================
    // STEP 2: Create Artists Collection
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 STEP 2: Creating artists collection...\n');

    const artistMap = new Map<string, mongoose.Types.ObjectId>(); // name -> _id
    let artistsCreated = 0;

    for (const [name, data] of uniqueArtists.entries()) {
      try {
        const artist = await Artist.findOneAndUpdate(
          { name: data.name },
          {
            $setOnInsert: {
              name: data.name,
              spotifyId: data.spotifyId,
            },
          },
          { upsert: true, new: true }
        );
        artistMap.set(name, artist!._id as mongoose.Types.ObjectId);
        artistsCreated++;
      } catch (error: any) {
        console.error(`  ⚠️  Error creating artist "${name}":`, error.message);
      }
    }

    console.log(`  ✅ Created ${artistsCreated} artists\n`);

    // ============================================================
    // STEP 3: Create Albums Collection
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💿 STEP 3: Creating albums collection...\n');

    const albumMap = new Map<string, mongoose.Types.ObjectId>(); // spotifyId -> _id
    let albumsCreated = 0;

    for (const [spotifyId, data] of uniqueAlbums.entries()) {
      try {
        const artistId = artistMap.get(data.artistName);
        if (!artistId) {
          console.error(`  ⚠️  No artist found for album "${data.name}" (artist: ${data.artistName})`);
          continue;
        }

        const album = await Album.findOneAndUpdate(
          { spotifyId: data.spotifyId },
          {
            $setOnInsert: {
              spotifyId: data.spotifyId,
              name: data.name,
              artistId,
              albumArt: data.albumArt,
            },
          },
          { upsert: true, new: true }
        );
        albumMap.set(spotifyId, album!._id as mongoose.Types.ObjectId);
        albumsCreated++;
      } catch (error: any) {
        console.error(`  ⚠️  Error creating album "${data.name}":`, error.message);
      }
    }

    console.log(`  ✅ Created ${albumsCreated} albums\n`);

    // ============================================================
    // STEP 4: Create Tracks Collection
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎵 STEP 4: Creating tracks collection...\n');

    const trackMap = new Map<string, mongoose.Types.ObjectId>(); // spotifyId -> _id
    let tracksCreated = 0;

    for (const [spotifyId, data] of uniqueTracks.entries()) {
      try {
        const albumId = albumMap.get(data.albumSpotifyId);
        if (!albumId) {
          console.error(`  ⚠️  No album found for track "${data.name}" (album: ${data.albumSpotifyId})`);
          continue;
        }

        const track = await Track.findOneAndUpdate(
          { spotifyId: data.spotifyId },
          {
            $setOnInsert: {
              spotifyId: data.spotifyId,
              name: data.name,
              albumId,
              durationMs: data.durationMs,
            },
          },
          { upsert: true, new: true }
        );
        trackMap.set(spotifyId, track!._id as mongoose.Types.ObjectId);
        tracksCreated++;
      } catch (error: any) {
        console.error(`  ⚠️  Error creating track "${data.name}":`, error.message);
      }
    }

    console.log(`  ✅ Created ${tracksCreated} tracks\n`);

    // ============================================================
    // STEP 5: Add References to Scrobbles (Keep Old Fields!)
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 STEP 5: Adding references to scrobbles...\n');

    let scrobblesUpdated = 0;
    let scrobblesSkipped = 0;

    for (const scrobble of scrobbles) {
      try {
        const trackId = trackMap.get(scrobble.spotifyId);
        const albumId = albumMap.get(scrobble.albumId);
        const artistId = artistMap.get(scrobble.artistName);

        if (!trackId || !albumId || !artistId) {
          scrobblesSkipped++;
          continue;
        }

        // Add references WITHOUT removing old fields
        await db.collection('scrobbles').updateOne(
          { _id: scrobble._id },
          {
            $set: {
              trackId,
              albumId,
              artistId,
            },
          }
        );
        scrobblesUpdated++;
      } catch (error: any) {
        console.error(`  ⚠️  Error updating scrobble:`, error.message);
        scrobblesSkipped++;
      }
    }

    console.log(`  ✅ Updated ${scrobblesUpdated} scrobbles with references`);
    console.log(`  ⚠️  Skipped ${scrobblesSkipped} scrobbles (missing references)\n`);

    // ============================================================
    // STEP 6: Verify Migration
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ STEP 6: Verifying migration...\n');

    const artistsCount = await Artist.countDocuments();
    const albumsCount = await Album.countDocuments();
    const tracksCount = await Track.countDocuments();
    const scrobblesWithRefs = await db.collection('scrobbles').countDocuments({
      trackId: { $exists: true },
      albumId: { $exists: true },
      artistId: { $exists: true },
    });

    console.log(`  Artists in database:       ${artistsCount}`);
    console.log(`  Albums in database:        ${albumsCount}`);
    console.log(`  Tracks in database:        ${tracksCount}`);
    console.log(`  Scrobbles with references: ${scrobblesWithRefs}/${scrobbles.length}\n`);

    // ============================================================
    // STEP 7: Test Sample Query
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 STEP 7: Testing sample query with .populate()...\n');

    const sampleScrobble = await db.collection('scrobbles')
      .findOne({ trackId: { $exists: true } });

    if (sampleScrobble && sampleScrobble.trackId && sampleScrobble.albumId) {
      const track = await Track.findById(sampleScrobble.trackId)
        .populate('albumId')
        .lean();

      if (track) {
        console.log('  ✅ Sample Track:');
        console.log(`     Name: ${track.name}`);
        console.log(`     Album: ${(track.albumId as any)?.name || 'N/A'}`);
        console.log(`     Album Art: ${(track.albumId as any)?.albumArt ? 'Present' : 'Missing'}\n`);
      }
    }

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 MIGRATION COMPLETE!\n');

    console.log('✅ NEW COLLECTIONS CREATED:');
    console.log(`   - artists:  ${artistsCount} documents`);
    console.log(`   - albums:   ${albumsCount} documents`);
    console.log(`   - tracks:   ${tracksCount} documents\n`);

    console.log('✅ SCROBBLES UPDATED:');
    console.log(`   - ${scrobblesWithRefs} scrobbles now have references`);
    console.log('   - Old fields (trackName, albumName, albumArt) KEPT for safety\n');

    console.log('📋 NEXT STEPS:');
    console.log('   1. Update Scrobble, AlbumStats, TrackStats models (add refs)');
    console.log('   2. Update routes to use .populate() for album art');
    console.log('   3. Test all endpoints');
    console.log('   4. ONLY THEN remove redundant fields (albumArt, artistName)\n');

    console.log('🔙 ROLLBACK PLAN:');
    console.log('   - Old fields still exist in scrobbles');
    console.log('   - Can delete new collections: tracks, albums, artists');
    console.log('   - Revert code changes');
    console.log('   - App will work exactly as before\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runHybridMigration();
