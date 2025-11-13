# V2 Server-Assisted Scrobbling: Architecture Comparison

## Old Approach (Client-Side Detection)

### Mobile Complexity
```typescript
// 447 lines of complex polling logic
- ULTRA-SMART pattern-based algorithm
- Calculate 40% threshold on device
- Track lastScrobbleKey for dedup
- Schedule next check based on progress
- Handle pause detection
- 6 different polling patterns
- isPlayingRef, lastScrobbleKeyRef, nextCheckTimeoutRef
- Complex app state handling
```

**Problems:**
- 🔴 High mobile complexity (hard to debug)
- 🔴 Battery drain from complex calculations
- 🔴 Inconsistent logic between clients
- 🔴 Hard to update (need app release)
- 🔴 Dedup logic on client (can fail)

---

## New Approach (Server-Assisted)

### Mobile Complexity
```typescript
// 150 lines of dead-simple polling
useEffect(() => {
  const interval = setInterval(async () => {
    const playback = await getCurrentPlayback();
    if (playback?.isPlaying) {
      await sendSnapshot(playback);
    }
  }, 30000); // Every 30 seconds
  
  return () => clearInterval(interval);
}, [accessToken]);
```

**Benefits:**
- ✅ **Zero client logic** - Just poll & send
- ✅ **Battery friendly** - Simple 30s interval
- ✅ **Server does everything** - 40%, dedup, replay guard, album logic
- ✅ **Easy to update** - No app release needed
- ✅ **Consistent** - Same logic for all clients

---

## API Comparison

### Old: POST /api/music/scrobble
```typescript
// Client must:
1. Check if track is playing
2. Calculate 40% threshold
3. Deduplicate locally
4. Send individual scrobble

// Server:
- Just saves the scrobble
- Trusts client calculation
```

### New: POST /api/scrobble/v2/snapshot
```typescript
// Client sends:
{
  spotifyId, trackName, artistName,
  durationMs, progressMs, timestamp,
  isPlaying, device
}

// Server calculates:
1. isScrobbled = (progressMs/durationMs >= 0.4) || (progressMs >= 30000)
2. playedAtRounded10s = floor((timestamp - progressMs) / 10000) * 10000
3. Dedup: Check if (userId, spotifyId, playedAtRounded10s) exists
4. Update TrackStats (15min replay guard)
5. Update AlbumStats (4-track min, 70% completion)
6. Return: { action, message, stats }
```

---

## Deduplication Logic

### How playedAtRounded10s Works

**Problem:** Mobile polls every 30s, progressMs advances each poll.
- Poll 1: progressMs = 30s
- Poll 2: progressMs = 60s
- Poll 3: progressMs = 90s

If we use `timestamp` directly, each poll creates new scrobble!

**Solution:** Calculate when track STARTED playing:
```typescript
const trackStartTime = timestamp - progressMs;
// Poll 1: timestamp=T, progressMs=30s → startTime = T-30s
// Poll 2: timestamp=T+30s, progressMs=60s → startTime = T+30s-60s = T-30s ✅ SAME!
// Poll 3: timestamp=T+60s, progressMs=90s → startTime = T+60s-90s = T-30s ✅ SAME!
```

Then round to 10s window to handle small timing variations:
```typescript
const roundedStartMs = Math.floor(trackStartTime / 10000) * 10000;
const playedAtRounded10s = new Date(roundedStartMs);
```

**Result:** All polls of same track session dedupe to same key!

---

## Performance Comparison

### Battery Impact
| Approach | Polls/Hour | CPU/Poll | Total CPU |
|----------|------------|----------|-----------|
| **Old (Smart)** | 60-120 | High (pattern calc) | 🔴 High |
| **New (Simple)** | 120 | Low (HTTP only) | ✅ Low |

### Network Impact
| Approach | Requests/Hour | Payload Size | Dedup Logic |
|----------|---------------|--------------|-------------|
| **Old** | 1-5 (only when scrobbling) | ~2KB | Client |
| **New** | 120 (every 30s) | ~0.5KB | Server |

### Code Maintenance
| Aspect | Old | New |
|--------|-----|-----|
| **Mobile code** | 447 lines | 150 lines |
| **Logic updates** | App release | Server deploy |
| **Consistency** | Per-client | Centralized |
| **Debugging** | Hard (distributed) | Easy (server logs) |

---

## Migration Path

### Phase 1: Parallel Testing (Current)
- Keep old ScrobbleContext working
- Add ScrobbleContextV2 alongside
- Test in dev with both

### Phase 2: Gradual Rollout
- Feature flag: `USE_V2_SCROBBLING`
- Beta testers use V2
- Compare scrobble counts

### Phase 3: Full Migration
- Switch default to V2
- Deprecate old POST /scrobble
- Remove old context (save 297 lines!)

---

## Testing Results

### Scenario 1: Single Track (3 polls)
```
Poll 1 (30s, 16%): ✅ Scrobbled (30s fallback)
Poll 2 (60s, 33%): ✅ Duplicate (deduplicated)
Poll 3 (90s, 50%): ✅ Duplicate (deduplicated)
Result: 1 scrobble in DB, TrackStats playCount=1
```

### Scenario 2: Track Skip (1 poll)
```
Poll 1 (10s, 5%): ✅ too-early (< 40% and < 30s)
Result: 1 scrobble in DB with isScrobbled=false
```

### Scenario 3: Duplicate Prevention
```
Send 1 (90s, 50%): ✅ Scrobbled
Send 2 (92s, 51%): ✅ Duplicate (within 10s window)
Result: 1 scrobble in DB, TrackStats playCount=1
```

---

## Recommendation

✅ **Use V2 Server-Assisted Approach**

**Why:**
1. **Simplicity** - 150 lines vs 447 lines
2. **Reliability** - Centralized logic, easy debugging
3. **Maintainability** - Update server without app release
4. **Consistency** - Same behavior for all clients
5. **Testability** - Server tests cover all scenarios

**Trade-off:**
- More server requests (120/hr vs 1-5/hr)
- But: Smaller payloads, better deduplication, easier to optimize

**Next Steps:**
1. Deploy V2 endpoint to production ✅
2. Update mobile to use ScrobbleContextV2
3. A/B test with 10% of users
4. Monitor: scrobble accuracy, duplicate rate, battery impact
5. Full migration after validation
