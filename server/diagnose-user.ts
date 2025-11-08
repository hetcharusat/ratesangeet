// Diagnostic script to check for data issues in scrobbles
// Run with: npm run dev (in server folder), then use this to diagnose

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotiireate';

async function diagnoseUserData(userId: string) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');

    const scrobbles = await Scrobble.find({ userId });
    console.log(`\n📊 Found ${scrobbles.length} scrobbles for user ${userId}\n`);

    // Check for missing fields
    let missingSpotifyId = 0;
    let missingAlbumName = 0;
    let missingPlayedAt = 0;
    let invalidDates = 0;
    let problematicScrobbles: any[] = [];

    scrobbles.forEach((scrobble, index) => {
      const issues: string[] = [];

      if (!scrobble.spotifyId) {
        missingSpotifyId++;
        issues.push('No Spotify ID');
      }

      if (!scrobble.albumName) {
        missingAlbumName++;
        issues.push('No album name');
      }

      if (!scrobble.playedAt) {
        missingPlayedAt++;
        issues.push('No playedAt date');
      } else {
        try {
          const date = new Date(scrobble.playedAt);
          if (isNaN(date.getTime())) {
            invalidDates++;
            issues.push(`Invalid date: ${scrobble.playedAt}`);
          }
        } catch (error) {
          invalidDates++;
          issues.push(`Date parsing error: ${scrobble.playedAt}`);
        }
      }

      if (issues.length > 0) {
        problematicScrobbles.push({
          index,
          trackName: scrobble.trackName,
          albumName: scrobble.albumName,
          issues: issues.join(', '),
        });
      }
    });

    console.log('🔍 Data Quality Report:');
    console.log(`   ❌ Missing Spotify ID: ${missingSpotifyId}`);
    console.log(`   ❌ Missing Album Name: ${missingAlbumName}`);
    console.log(`   ❌ Missing playedAt: ${missingPlayedAt}`);
    console.log(`   ❌ Invalid Dates: ${invalidDates}`);
    console.log(`   ✅ Clean scrobbles: ${scrobbles.length - problematicScrobbles.length}\n`);

    if (problematicScrobbles.length > 0) {
      console.log('⚠️  Problematic Scrobbles (first 10):');
      problematicScrobbles.slice(0, 10).forEach((s) => {
        console.log(`   [${s.index}] "${s.trackName}" - ${s.issues}`);
      });
    }

    // Check album grouping
    console.log('\n📀 Album Grouping Test:');
    const albumMap = new Map();
    scrobbles.forEach((scrobble) => {
      if (scrobble.albumName && scrobble.spotifyId) {
        if (!albumMap.has(scrobble.albumName)) {
          albumMap.set(scrobble.albumName, {
            tracks: new Set(),
            plays: 0,
            days: new Set(),
          });
        }
        const album = albumMap.get(scrobble.albumName);
        album.tracks.add(scrobble.spotifyId);
        album.plays++;
        
        if (scrobble.playedAt) {
          try {
            const date = new Date(scrobble.playedAt).toISOString().split('T')[0];
            album.days.add(date);
          } catch (error) {
            console.log(`   ⚠️  Date error for "${scrobble.albumName}"`);
          }
        }
      }
    });

    console.log(`   Found ${albumMap.size} unique albums`);
    const albumsArray = Array.from(albumMap.entries())
      .map(([name, data]) => ({
        name,
        tracks: data.tracks.size,
        plays: data.plays,
        days: data.days.size,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    console.log('   Top 5 albums:');
    albumsArray.forEach((album, i) => {
      console.log(`   ${i + 1}. "${album.name}"`);
      console.log(`      - ${album.tracks} unique tracks`);
      console.log(`      - ${album.plays} total plays`);
      console.log(`      - ${album.days} unique days`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Diagnosis complete');
  } catch (error) {
    console.error('❌ Diagnosis error:', error);
    await mongoose.disconnect();
  }
}

// Get userId from command line argument
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: ts-node diagnose-user.ts <userId>');
  console.log('Example: ts-node diagnose-user.ts 690515e140de1ed193906fd1');
  process.exit(1);
}

diagnoseUserData(userId);
