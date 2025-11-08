import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import {
  CurrentlyPlayingResponse,
  getCurrentlyPlaying,
  refreshAccessToken,
  scrobbleCurrentTrack,
  syncRecentPlays,
  Scrobble,
  Track,
} from '../services/api';
import { initLocalDb, saveScrobbles as saveLocalScrobbles, getAlbumAggregatesSince, getLastAlbumStatsPush, setLastAlbumStatsPush, getTrackAggregatesSince } from '../storage/sqlite';
import { getUserScrobbles, upsertAlbumStatsBatch, upsertTrackStatsBatch } from '../services/api';

interface ScrobbleContextValue {
  currentTrack: Track | null;
  lastScrobble: Scrobble | null;
  isPolling: boolean;
  triggerScrobble: () => Promise<void>;
}

const ScrobbleContext = createContext<ScrobbleContextValue | undefined>(undefined);

interface ScrobbleProviderProps {
  children: ReactNode;
}

// 🧠 ULTRA-SMART PATTERN-BASED POLLING ALGORITHM
// Based on user behavior patterns:
// - Instant skip (0-5s): User hates song → check early
// - Early skip (10-20s): User dislikes song → check at skip window
// - Mid skip (60%+): User moderately likes → check after scrobble
// - Full listen: User loves song → check at natural end only

const SCROBBLE_THRESHOLD = 0.4;          // Scrobble at 40% of track (track counts as "listened", NOT "completed")
const INSTANT_SKIP_WINDOW = 5000;        // Check at 5s (catch instant skips)
const EARLY_SKIP_WINDOW = 15000;         // Check at 15s (catch "not good" skips)
const MODERATE_SKIP_POINT = 0.6;         // Check at 60% (moderate like skips)
const TRACK_END_BUFFER = 3000;           // Check 3s before end
const IDLE_INTERVAL = 120000;            // Check every 2min when paused (backup only)
const MAX_POLL_INTERVAL = 45000;         // Max 45s between checks (safety)
const MIN_POLL_INTERVAL = 3000;          // Min 3s (rate limit safety)

// Deduplication: Track last scrobbled track ID to avoid duplicate scrobbles
// Use only spotifyId (not timestamp) to prevent same track from scrobbling twice in same session
const getPlaybackKey = (playback: CurrentlyPlayingResponse) => {
  if (!playback.track) {
    return null;
  }
  // Simple key: just the track ID
  // This prevents duplicate scrobbles within the same listening session
  return playback.track.id;
};

export const ScrobbleProvider = ({ children }: ScrobbleProviderProps) => {
  const { accessToken, refreshToken, user, setAuth } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [lastScrobble, setLastScrobble] = useState<Scrobble | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const tokenRef = useRef<string | null>(accessToken);
  const refreshTokenRef = useRef<string | null>(refreshToken);
  const lastScrobbleKeyRef = useRef<string | null>(null);
  const nextCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const pollPlaybackRef = useRef<(() => Promise<void>) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastVisibilityCheckRef = useRef<number>(0); // Track last check time for web

  // Listen for app state changes (foreground/background)
  // Mobile: Only trigger on background → active (not lock → active)
  // Web: Debounce visibility changes to avoid duplicate requests
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      // WEB PLATFORM: Debounce visibility changes
      // Tab visibility fires frequently, we only want to check if enough time has passed
      if (Platform.OS === 'web') {
        if (nextAppState === 'active') {
          const now = Date.now();
          const timeSinceLastCheck = now - lastVisibilityCheckRef.current;
          
          // Only check if:
          // 1. Music was playing before
          // 2. It's been at least 30 seconds since last check (prevents spam)
          if (isPlayingRef.current && timeSinceLastCheck > 30000) {
            console.log('[SCROBBLE] 🌐 Web tab visible after 30s+ - checking for changes');
            lastVisibilityCheckRef.current = now;
            if (pollPlaybackRef.current) {
              pollPlaybackRef.current();
            }
          } else {
            console.log(`[SCROBBLE] 🌐 Web tab visible but skipping (last check ${Math.floor(timeSinceLastCheck/1000)}s ago)`);
          }
        } else {
          console.log('[SCROBBLE] 🌐 Web tab hidden - regular polling continues');
        }
        return;
      }
      
      // MOBILE PLATFORM: Only trigger on background → active
      // This avoids duplicate checks when just locking/unlocking screen
      if (previousState === 'background' && nextAppState === 'active') {
        console.log('[SCROBBLE] 📱 App returned from background - checking for track changes');
        if (pollPlaybackRef.current && isPlayingRef.current) {
          // Only check if music was playing before backgrounding
          pollPlaybackRef.current();
        }
      } else if (previousState !== 'background' && nextAppState === 'active') {
        console.log('[SCROBBLE] 🔓 Screen unlocked (but app was active) - skipping redundant check');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    tokenRef.current = accessToken;
    refreshTokenRef.current = refreshToken;

    if (!accessToken || !user?.id) {
      setCurrentTrack(null);
      setLastScrobble(null);
      lastScrobbleKeyRef.current = null;
      return;
    }

    const timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const scheduleNextCheck = (delayMs: number) => {
      if (nextCheckTimeoutRef.current) {
        clearTimeout(nextCheckTimeoutRef.current);
      }
      nextCheckTimeoutRef.current = setTimeout(() => {
        if (!cancelled) {
          pollPlayback();
        }
      }, delayMs);
    };

    const pollPlayback = async () => {
      if (!tokenRef.current || !user?.id || cancelled) {
        return;
      }

      try {
        setIsPolling(true);
        const playback = await performWithRefresh(tokenRef.current, (token) =>
          getCurrentlyPlaying(token)
        );

      if (!playback || !playback.track) {
        setCurrentTrack(null);
        isPlayingRef.current = false;
        // Nothing playing, check again in 2 minutes (backup)
        scheduleNextCheck(IDLE_INTERVAL);
        console.log('[SCROBBLE] 🔇 No playback detected, next check in 2min');
        return;
      }

      setCurrentTrack(playback.track);

      if (!playback.isPlaying) {
        isPlayingRef.current = false;
        // Paused, check again in 2 minutes (backup)
        scheduleNextCheck(IDLE_INTERVAL);
        console.log('[SCROBBLE] ⏸️  Paused, next check in 2min');
        return;
      }

      isPlayingRef.current = true;
      const progressMs = playback.progressMs ?? 0;
      const trackDurationMs = playback.track.duration_ms ?? 0;
      const timeLeftMs = trackDurationMs - progressMs;
      const progressPercent = trackDurationMs > 0 ? progressMs / trackDurationMs : 0;
      
      // 🧠 ULTRA-SMART PATTERN-BASED ALGORITHM
      // Check at strategic moments based on skip behavior patterns
      
      const scrobblePointMs = trackDurationMs * SCROBBLE_THRESHOLD;
      const moderateSkipPointMs = trackDurationMs * MODERATE_SKIP_POINT;
      
      let nextCheckDelay: number;
      let reason: string;
      
      // Pattern 1: Just started (0-5s) - Catch instant "hate" skips
      if (progressMs < INSTANT_SKIP_WINDOW) {
        nextCheckDelay = INSTANT_SKIP_WINDOW - progressMs;
        reason = `😠 Instant skip window (check at 5s)`;
      }
      // Pattern 2: Early phase (5-15s) - Catch "not good" skips
      else if (progressMs < EARLY_SKIP_WINDOW) {
        nextCheckDelay = EARLY_SKIP_WINDOW - progressMs;
        reason = `😐 Early skip window (check at 15s)`;
      }
      // Pattern 3: Before scrobble (15s-40%) - Wait for scrobble point
      else if (progressMs < scrobblePointMs) {
        nextCheckDelay = scrobblePointMs - progressMs;
        reason = `⏱️  Waiting for scrobble at 40% (${Math.floor(scrobblePointMs/1000)}s)`;
      }
      // Pattern 4: After scrobble, before moderate skip (40%-60%) - Check at 60%
      else if (progressMs < moderateSkipPointMs) {
        nextCheckDelay = moderateSkipPointMs - progressMs;
        reason = `🤔 Moderate skip point (check at 60%)`;
      }
      // Pattern 5: Near end (last 6s) - Catch track change
      else if (timeLeftMs < TRACK_END_BUFFER * 2) {
        nextCheckDelay = Math.max(MIN_POLL_INTERVAL, timeLeftMs - TRACK_END_BUFFER);
        reason = `🏁 Track ending (catch next)`;
      }
      // Pattern 6: After moderate point, before end - Wait for natural end
      else {
        nextCheckDelay = Math.max(MIN_POLL_INTERVAL, timeLeftMs - TRACK_END_BUFFER);
        reason = `❤️  User likes song, waiting for natural end`;
      }
      
      // Apply safety caps
      nextCheckDelay = Math.max(MIN_POLL_INTERVAL, nextCheckDelay);
      nextCheckDelay = Math.min(MAX_POLL_INTERVAL, nextCheckDelay);
      
      const progressDisplay = `${Math.floor(progressMs/1000)}s/${Math.floor(trackDurationMs/1000)}s (${Math.floor(progressPercent*100)}%)`;
      console.log(`[SCROBBLE] 🎵 ${playback.track.name} | ${progressDisplay} | ${reason} | Next: ${Math.floor(nextCheckDelay/1000)}s`);
      
      // Only scrobble if track is played 40% or more (counts as "listened", NOT "completed")
      if (progressMs >= scrobblePointMs && trackDurationMs > 0) {
        const key = getPlaybackKey(playback);
        if (key && key !== lastScrobbleKeyRef.current) {
          const response = await performWithRefresh(tokenRef.current, (token) =>
            scrobbleCurrentTrack(token, user.id)
          );
          if (response?.scrobbled && response.scrobble) {
            lastScrobbleKeyRef.current = key;
            setLastScrobble(response.scrobble);
            console.log('[SCROBBLE] ✅ Scrobbled:', playback.track.name);
          }
        }
      }
      
      // Schedule next check (pattern-based timing)
      scheduleNextCheck(nextCheckDelay);      } catch (error: any) {
        console.error('Scrobble polling failed:', error);
        // On error, retry in 30s
        scheduleNextCheck(30000);
      } finally {
        setIsPolling(false);
      }
    };

    // Store pollPlayback in ref so AppState listener can access it
    pollPlaybackRef.current = pollPlayback;

    const startPolling = async () => {
      // Backfill scrobbles from Spotify recently played in case the app was closed
      performWithRefresh(tokenRef.current, async (token) => {
        try {
          // Ensure local DB ready
          initLocalDb();
          const syncRes = await syncRecentPlays(token, user!.id);
          // If server returns items (cloud scrobble disabled), persist them locally
          if (Array.isArray(syncRes.items) && syncRes.items.length) {
            saveLocalScrobbles(
              syncRes.items.map((it) => ({
                spotifyId: it.spotifyId,
                trackName: it.trackName,
                artistName: it.artistName,
                albumId: it.albumId,
                albumName: it.albumName,
                albumArt: it.albumArt,
                durationMs: it.durationMs,
                playedAt: new Date(it.playedAt).getTime(),
              }))
            );
          } else {
            // Fallback: pull from cloud if available
            const recent = await getUserScrobbles(user!.id, 200);
            const locals = recent.map((s) => ({
              spotifyId: s.spotifyId,
              trackName: s.trackName,
              artistName: s.artistName,
              albumId: undefined as string | undefined,
              albumName: s.albumName,
              albumArt: s.albumArt,
              durationMs: s.durationMs,
              playedAt: new Date(s.playedAt).getTime(),
            }));
            saveLocalScrobbles(locals);
          }

          // Push album summary deltas since last push
          const since = getLastAlbumStatsPush();
          const albumAggs = getAlbumAggregatesSince(since);
          if (albumAggs.length) {
            await upsertAlbumStatsBatch(user!.id, albumAggs.map((a) => ({
              albumId: a.albumId,
              albumName: a.albumName,
              artistName: a.artistName,
              albumArt: a.albumArt,
              deltaCount: a.count,
              lastPlayedAt: a.lastPlayedAt,
            })));
          }

          const trackAggs = getTrackAggregatesSince(since);
          if (trackAggs.length) {
            await upsertTrackStatsBatch(user!.id, trackAggs.map((t) => ({
              trackId: t.trackId,
              trackName: t.trackName,
              artistName: t.artistName,
              albumName: t.albumName,
              albumArt: t.albumArt,
              deltaCount: t.count,
              lastPlayedAt: t.lastPlayedAt,
            })));
          }

          setLastAlbumStatsPush(Date.now());
        } catch {}
      }).catch(() => {});
      
      // Start smart event-driven polling
      pollPlayback();
    };

    startPolling();

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
      if (nextCheckTimeoutRef.current) {
        clearTimeout(nextCheckTimeoutRef.current);
      }
    };
  }, [accessToken, user?.id]);

  const performWithRefresh = async <T,>(
    token: string | null,
    action: (token: string) => Promise<T>
  ): Promise<T> => {
    if (!token) {
      throw new Error('Missing access token');
    }

    try {
      return await action(token);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 && refreshTokenRef.current && user) {
        try {
          const refreshed = await refreshAccessToken(refreshTokenRef.current);
          if (refreshed?.accessToken) {
            const nextAuth = {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? refreshTokenRef.current,
              user,
            };
            await setAuth(nextAuth);
            tokenRef.current = refreshed.accessToken;
            if (refreshed.refreshToken) {
              refreshTokenRef.current = refreshed.refreshToken;
            }
            return await action(refreshed.accessToken);
          }
        } catch (refreshError) {
          console.error('Failed to refresh Spotify token:', refreshError);
        }
      }
      throw error;
    }
  };

  const triggerScrobble = async () => {
    if (!tokenRef.current || !user?.id) {
      return;
    }

    try {
      const response = await performWithRefresh(tokenRef.current, (token) =>
        scrobbleCurrentTrack(token, user.id)
      );
      if (response?.scrobbled && response.scrobble) {
        const playedAtSeconds = Math.floor(new Date(response.scrobble.playedAt).getTime() / 1000);
        const key = `${response.scrobble.spotifyId}-${playedAtSeconds}`;
        lastScrobbleKeyRef.current = key;
        setLastScrobble(response.scrobble);
        try {
          initLocalDb();
          saveLocalScrobbles([
            {
              spotifyId: response.scrobble.spotifyId,
              trackName: response.scrobble.trackName,
              artistName: response.scrobble.artistName,
              albumName: response.scrobble.albumName,
              albumArt: response.scrobble.albumArt,
              playedAt: new Date(response.scrobble.playedAt).getTime(),
              durationMs: response.scrobble.durationMs,
            },
          ]);
        } catch {}
      }
    } catch (error: any) {
      console.error('Manual scrobble failed:', error);
    }
  };

  return (
    <ScrobbleContext.Provider value={{ currentTrack, lastScrobble, isPolling, triggerScrobble }}>
      {children}
    </ScrobbleContext.Provider>
  );
};

export const useScrobble = () => {
  const context = useContext(ScrobbleContext);
  if (!context) {
    throw new Error('useScrobble must be used within a ScrobbleProvider');
  }
  return context;
};
