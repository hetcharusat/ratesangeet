/**
 * Test skip detection algorithm with various scenarios
 * Run with: npx ts-node test-skip-detection.ts
 */

const SCROBBLE_THRESHOLD = 0.4;
const GRACE_MARGIN_MS = 5000;
const PAUSE_DETECTION_MULTIPLIER = 1.5;
const MAX_RECENT_TRACK_AGE_MS = 120000;

interface TestTrack {
  track: {
    id: string;
    name: string;
    duration_ms: number;
  };
  played_at: string;
}

function filterSkippedTracks(items: TestTrack[]): TestTrack[] {
  if (items.length === 0) {
    return items;
  }

  const filtered: TestTrack[] = [];
  const nowMs = Date.now();

  const sorted = [...items].sort((a, b) =>
    new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!current?.track || !current?.played_at) continue;

    const currentStartMs = new Date(current.played_at).getTime();
    const currentDuration = current.track.duration_ms || 0;
    const scrobbleThreshold = currentDuration * SCROBBLE_THRESHOLD;

    // First track: assume listened
    if (i === 0) {
      filtered.push(current);
      console.log(`  ✅ First track (assume listened): ${current.track.name}`);
      continue;
    }

    // Last track: compare with current time
    if (!next) {
      const timeSinceStartMs = nowMs - currentStartMs;

      if (timeSinceStartMs >= MAX_RECENT_TRACK_AGE_MS || 
          timeSinceStartMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
        filtered.push(current);
        console.log(`  ✅ Last track (threshold reached): ${current.track.name} (${Math.floor(timeSinceStartMs / 1000)}s ago)`);
      } else {
        console.log(`  ⏭️  Last track (too recent): ${current.track.name} (${Math.floor(timeSinceStartMs / 1000)}s ago)`);
      }
      continue;
    }

    // Normal case: compare with next track
    const nextStartMs = new Date(next.played_at).getTime();
    const actualPlaybackMs = nextStartMs - currentStartMs;

    // Pause detection
    if (actualPlaybackMs > currentDuration * PAUSE_DETECTION_MULTIPLIER) {
      filtered.push(current);
      const percent = Math.floor((actualPlaybackMs / currentDuration) * 100);
      console.log(`  ✅ Full listen (pause detected): ${current.track.name} (gap: ${Math.floor(actualPlaybackMs / 1000)}s, duration: ${Math.floor(currentDuration / 1000)}s)`);
      continue;
    }

    // Grace margin check
    if (actualPlaybackMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
      filtered.push(current);
      const percent = Math.floor((actualPlaybackMs / currentDuration) * 100);
      console.log(`  ✅ Scrobble: ${current.track.name} (played ${Math.floor(actualPlaybackMs / 1000)}s / ${Math.floor(currentDuration / 1000)}s = ${percent}%)`);
    } else {
      const percent = Math.floor((actualPlaybackMs / currentDuration) * 100);
      console.log(`  ⏭️  Skip: ${current.track.name} (played ${Math.floor(actualPlaybackMs / 1000)}s / ${Math.floor(currentDuration / 1000)}s = ${percent}%, need ${Math.floor(SCROBBLE_THRESHOLD * 100)}%)`);
    }
  }

  return filtered;
}

console.log('\n🧪 TEST 1: Instant Skips (< 40%)');
console.log('═══════════════════════════════════════');
const test1: TestTrack[] = [
  {
    track: { id: '1', name: 'Track 1 (3min)', duration_ms: 180000 },
    played_at: new Date(Date.now() - 600000).toISOString(), // 10 min ago
  },
  {
    track: { id: '2', name: 'Track 2 (SKIP - 5s)', duration_ms: 180000 },
    played_at: new Date(Date.now() - 595000).toISOString(), // 9:55 ago (5s played)
  },
  {
    track: { id: '3', name: 'Track 3 (SKIP - 10s)', duration_ms: 180000 },
    played_at: new Date(Date.now() - 590000).toISOString(), // 9:50 ago (10s played)
  },
  {
    track: { id: '4', name: 'Track 4 (FULL)', duration_ms: 180000 },
    played_at: new Date(Date.now() - 580000).toISOString(), // 9:40 ago (full 3min)
  },
];
const result1 = filterSkippedTracks(test1);
console.log(`\n📊 Result: ${result1.length}/${test1.length} tracks scrobbled`);
console.log(`Expected: 2 tracks (Track 1 as first, Track 4 as full listen)\n`);

console.log('\n🧪 TEST 2: Replayed Track (Same Song Twice)');
console.log('═══════════════════════════════════════');
const test2: TestTrack[] = [
  {
    track: { id: '1', name: 'Bohemian Rhapsody (1st play)', duration_ms: 355000 },
    played_at: new Date(Date.now() - 720000).toISOString(), // 12 min ago
  },
  {
    track: { id: '1', name: 'Bohemian Rhapsody (2nd play - FULL)', duration_ms: 355000 },
    played_at: new Date(Date.now() - 365000).toISOString(), // 6:05 ago (full play)
  },
  {
    track: { id: '2', name: 'Next Song', duration_ms: 200000 },
    played_at: new Date(Date.now() - 10000).toISOString(), // 10s ago
  },
];
const result2 = filterSkippedTracks(test2);
console.log(`\n📊 Result: ${result2.length}/${test2.length} tracks scrobbled`);
console.log(`Expected: 3 tracks (both Bohemian Rhapsody plays + Next Song)\n`);

console.log('\n🧪 TEST 3: Long Pause Between Tracks');
console.log('═══════════════════════════════════════');
const test3: TestTrack[] = [
  {
    track: { id: '1', name: 'Track Before Break', duration_ms: 200000 },
    played_at: new Date(Date.now() - 900000).toISOString(), // 15 min ago
  },
  {
    track: { id: '2', name: 'Track After 10min Break', duration_ms: 200000 },
    played_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago (10min gap!)
  },
];
const result3 = filterSkippedTracks(test3);
console.log(`\n📊 Result: ${result3.length}/${test3.length} tracks scrobbled`);
console.log(`Expected: 2 tracks (pause detected for Track Before Break)\n`);

console.log('\n🧪 TEST 4: 40% Threshold Edge Cases');
console.log('═══════════════════════════════════════');
const test4: TestTrack[] = [
  {
    track: { id: '1', name: 'Track 1 (baseline)', duration_ms: 200000 },
    played_at: new Date(Date.now() - 500000).toISOString(),
  },
  {
    track: { id: '2', name: 'Track 2 (35% - SKIP)', duration_ms: 200000 },
    played_at: new Date(Date.now() - 300000).toISOString(), // 70s played (35%)
  },
  {
    track: { id: '3', name: 'Track 3 (38% + grace - PASS)', duration_ms: 200000 },
    played_at: new Date(Date.now() - 230000).toISOString(), // 76s played (38% + 5s grace)
  },
  {
    track: { id: '4', name: 'Track 4 (45% - PASS)', duration_ms: 200000 },
    played_at: new Date(Date.now() - 140000).toISOString(), // 90s played (45%)
  },
];
const result4 = filterSkippedTracks(test4);
console.log(`\n📊 Result: ${result4.length}/${test4.length} tracks scrobbled`);
console.log(`Expected: 3 tracks (Track 1 as first, Track 3 with grace margin, Track 4 above threshold)\n`);

console.log('\n🧪 TEST 5: Recent Track (Too New)');
console.log('═══════════════════════════════════════');
const test5: TestTrack[] = [
  {
    track: { id: '1', name: 'Old Track', duration_ms: 200000 },
    played_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
  },
  {
    track: { id: '2', name: 'Currently Playing (just started)', duration_ms: 300000 },
    played_at: new Date(Date.now() - 3000).toISOString(), // 3s ago (too recent!)
  },
];
const result5 = filterSkippedTracks(test5);
console.log(`\n📊 Result: ${result5.length}/${test5.length} tracks scrobbled`);
console.log(`Expected: 1 track (Currently Playing is too recent, wait for next sync)\n`);

console.log('\n═══════════════════════════════════════');
console.log('✅ All skip detection tests completed!');
console.log('═══════════════════════════════════════\n');
