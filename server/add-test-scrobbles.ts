import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Scrobble from './src/models/Scrobble.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spotiireate';
const USER_ID = '68f76ebaaeea6e3e5f62416d'; // H's user ID

// Test albums with different completion levels
const testAlbums = [
  {
    // Album 1: 40% completion (4 out of 10 tracks)
    albumId: '2guirTSEqLizK7j9i1MTTZ',
    albumName: 'Rumours',
    artistName: 'Fleetwood Mac',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273e52a59a28efa4773dd2bfe1b',
    totalTracks: 10,
    tracks: [
      { id: '0c6xIDDpzE81m2q797ordA', name: 'Dreams', durationMs: 257000 },
      { id: '5bnEkPg19lrhBwzYm0NLIw', name: 'Don\'t Stop', durationMs: 193000 },
      { id: '1JSTJqkT5qHq8MDJnJbRE1', name: 'Go Your Own Way', durationMs: 218000 },
      { id: '0ofbAMOTZKyTnqHjhct3T0', name: 'The Chain', durationMs: 270000 },
    ]
  },
  {
    // Album 2: 45% completion (5 out of 11 tracks)
    albumId: '1Rv9WRKyYhFaGbuYDaQunN',
    albumName: 'Hotel California',
    artistName: 'Eagles',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b273b5d4b4ed9d78c8f1fc2f48e2',
    totalTracks: 11,
    tracks: [
      { id: '40riOy7x9W7GXjyGp4pjAv', name: 'Hotel California', durationMs: 391000 },
      { id: '6kWT7i5CLz3W5IvDQcJBiV', name: 'New Kid in Town', durationMs: 304000 },
      { id: '1lCRw5FEZ1gPDNPzy1K4zW', name: 'Life in the Fast Lane', durationMs: 286000 },
      { id: '2nLtzopw4rPReszdYBJU6h', name: 'Wasted Time', durationMs: 297000 },
      { id: '5b4vFCNm2sWxXA4WHOBJeR', name: 'Victim of Love', durationMs: 251000 },
    ]
  },
  {
    // Album 3: 42% completion (5 out of 12 tracks)
    albumId: '3pLdWdkj83EYfDN6H2N8MR',
    albumName: 'Thriller',
    artistName: 'Michael Jackson',
    albumArt: 'https://i.scdn.co/image/ab67616d0000b2735755e0f9cddbf32684a21c12',
    totalTracks: 12,
    tracks: [
      { id: '3S2R0EVwBSAVMd5UMgKTL0', name: 'Thriller', durationMs: 357000 },
      { id: '5ChkMS8OtdzJeqyybCc9R5', name: 'Beat It', durationMs: 258000 },
      { id: '6XkjpgcEqYaL1B2IsjTNkc', name: 'Billie Jean', durationMs: 294000 },
      { id: '1EzrEOXmMH3G43AXT1y7pA', name: 'Wanna Be Startin\' Somethin\'', durationMs: 363000 },
      { id: '0Iq2RmtfqV4281v6c67Cfb', name: 'Human Nature', durationMs: 246000 },
    ]
  }
];

async function addTestScrobbles() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get current time
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    let totalAdded = 0;

    for (const album of testAlbums) {
      console.log(`\n📀 Adding scrobbles for: ${album.albumName} by ${album.artistName}`);
      
      for (let i = 0; i < album.tracks.length; i++) {
        const track = album.tracks[i];
        
        // Create 2-3 plays per track over the last 7 days
        const playsCount = Math.floor(Math.random() * 2) + 2; // 2-3 plays
        
        for (let j = 0; j < playsCount; j++) {
          const daysAgo = Math.floor(Math.random() * 7); // Random day in last week
          const playedAt = new Date(now - (daysAgo * oneDayMs) - (Math.random() * oneDayMs));
          
          const scrobble = new Scrobble({
            userId: USER_ID,
            spotifyId: track.id,
            trackName: track.name,
            artistName: album.artistName,
            albumId: album.albumId,
            albumName: album.albumName,
            albumArt: album.albumArt,
            durationMs: track.durationMs,
            playedAt,
            source: 'spotify',
          });

          await scrobble.save();
          totalAdded++;
        }
      }
      
      console.log(`✅ Added ${album.tracks.length} tracks from ${album.albumName}`);
      console.log(`   Completion: ${Math.round((album.tracks.length / album.totalTracks) * 100)}%`);
    }

    console.log(`\n🎉 Successfully added ${totalAdded} test scrobbles!`);
    console.log(`\n📊 Test Albums Summary:`);
    console.log(`   1. Rumours - Fleetwood Mac (40% - 4/10 tracks)`);
    console.log(`   2. Hotel California - Eagles (45% - 5/11 tracks)`);
    console.log(`   3. Thriller - Michael Jackson (42% - 5/12 tracks)`);
    console.log(`\n✨ These albums should now appear in the "Previously Listened Albums" section!`);
    
  } catch (error) {
    console.error('❌ Error adding test scrobbles:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

addTestScrobbles();
