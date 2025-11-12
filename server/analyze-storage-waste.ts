import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeStorageWaste() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;

    // Get scrobbles
    const scrobbles = await db.collection('scrobbles').find().toArray();
    console.log(`📊 Analyzing ${scrobbles.length} scrobbles...\n`);

    // Calculate duplicate data
    const uniqueTracks = new Set(scrobbles.map(s => s.spotifyId)).size;
    const uniqueAlbums = new Set(scrobbles.map(s => s.albumId)).size;
    const uniqueArtists = new Set(scrobbles.map(s => s.artistName)).size;

    // Calculate field sizes
    let totalTrackNameBytes = 0;
    let totalAlbumNameBytes = 0;
    let totalArtistNameBytes = 0;
    let totalAlbumArtBytes = 0;

    scrobbles.forEach(s => {
      totalTrackNameBytes += Buffer.byteLength(s.trackName || '', 'utf8');
      totalAlbumNameBytes += Buffer.byteLength(s.albumName || '', 'utf8');
      totalArtistNameBytes += Buffer.byteLength(s.artistName || '', 'utf8');
      totalAlbumArtBytes += Buffer.byteLength(s.albumArt || '', 'utf8');
    });

    // Calculate what normalized would save
    const trackNames = new Map<string, string>();
    const albumNames = new Map<string, string>();
    const artistNames = new Set<string>();
    const albumArts = new Map<string, string>();

    scrobbles.forEach(s => {
      if (s.spotifyId && s.trackName) trackNames.set(s.spotifyId, s.trackName);
      if (s.albumId && s.albumName) albumNames.set(s.albumId, s.albumName);
      if (s.artistName) artistNames.add(s.artistName);
      if (s.albumId && s.albumArt) albumArts.set(s.albumId, s.albumArt);
    });

    let normalizedTrackBytes = 0;
    let normalizedAlbumBytes = 0;
    let normalizedArtistBytes = 0;
    let normalizedAlbumArtBytes = 0;

    trackNames.forEach(name => normalizedTrackBytes += Buffer.byteLength(name, 'utf8'));
    albumNames.forEach(name => normalizedAlbumBytes += Buffer.byteLength(name, 'utf8'));
    artistNames.forEach(name => normalizedArtistBytes += Buffer.byteLength(name, 'utf8'));
    albumArts.forEach(url => normalizedAlbumArtBytes += Buffer.byteLength(url, 'utf8'));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 DENORMALIZED (Current) vs 🔗 NORMALIZED (Foreign Keys)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total Scrobbles: ${scrobbles.length}`);
    console.log(`Unique Tracks: ${uniqueTracks}`);
    console.log(`Unique Albums: ${uniqueAlbums}`);
    console.log(`Unique Artists: ${uniqueArtists}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TRACK NAMES:');
    console.log(`  Denormalized: ${(totalTrackNameBytes / 1024).toFixed(2)} KB (stored ${scrobbles.length}x)`);
    console.log(`  Normalized:   ${(normalizedTrackBytes / 1024).toFixed(2)} KB (stored ${uniqueTracks}x)`);
    console.log(`  💾 Savings:   ${((1 - normalizedTrackBytes / totalTrackNameBytes) * 100).toFixed(1)}%\n`);

    console.log('ALBUM NAMES:');
    console.log(`  Denormalized: ${(totalAlbumNameBytes / 1024).toFixed(2)} KB`);
    console.log(`  Normalized:   ${(normalizedAlbumBytes / 1024).toFixed(2)} KB`);
    console.log(`  💾 Savings:   ${((1 - normalizedAlbumBytes / totalAlbumNameBytes) * 100).toFixed(1)}%\n`);

    console.log('ARTIST NAMES:');
    console.log(`  Denormalized: ${(totalArtistNameBytes / 1024).toFixed(2)} KB`);
    console.log(`  Normalized:   ${(normalizedArtistBytes / 1024).toFixed(2)} KB`);
    console.log(`  💾 Savings:   ${((1 - normalizedArtistBytes / totalArtistNameBytes) * 100).toFixed(1)}%\n`);

    console.log('ALBUM ART URLs:');
    console.log(`  Denormalized: ${(totalAlbumArtBytes / 1024).toFixed(2)} KB`);
    console.log(`  Normalized:   ${(normalizedAlbumArtBytes / 1024).toFixed(2)} KB`);
    console.log(`  💾 Savings:   ${((1 - normalizedAlbumArtBytes / totalAlbumArtBytes) * 100).toFixed(1)}% ⚠️ BIGGEST!\n`);

    const totalDenormalized = totalTrackNameBytes + totalAlbumNameBytes + totalArtistNameBytes + totalAlbumArtBytes;
    const totalNormalized = normalizedTrackBytes + normalizedAlbumBytes + normalizedArtistBytes + normalizedAlbumArtBytes;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOTAL (just text fields):');
    console.log(`  📦 Denormalized: ${(totalDenormalized / 1024).toFixed(2)} KB`);
    console.log(`  🔗 Normalized:   ${(totalNormalized / 1024).toFixed(2)} KB`);
    console.log(`  💾 Total Savings: ${((1 - totalNormalized / totalDenormalized) * 100).toFixed(1)}%`);
    console.log(`  💰 Saved: ${((totalDenormalized - totalNormalized) / 1024).toFixed(2)} KB\n`);

    // Calculate with 10,000 scrobbles
    const ratio = scrobbles.length > 0 ? 10000 / scrobbles.length : 0;
    const projected10kDenorm = totalDenormalized * ratio;
    const projected10kNorm = totalNormalized + (normalizedTrackBytes * 10); // Some new tracks

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PROJECTED WITH 10,000 SCROBBLES:');
    console.log(`  📦 Denormalized: ${(projected10kDenorm / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  🔗 Normalized:   ${(projected10kNorm / 1024).toFixed(2)} KB`);
    console.log(`  💾 Savings:      ${((1 - projected10kNorm / projected10kDenorm) * 100).toFixed(1)}%\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeStorageWaste();
