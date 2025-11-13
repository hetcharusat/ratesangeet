import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { Track } from '../services/api';
import spotifyApi from '../services/spotifyApi';
import api from '../services/api';
import config from '../config';
import { initArchiveTable, runArchiveJob, getArchiveStats } from '../storage/archiveJob';

interface ScrobbleContextValue {
  currentTrack: Track | null;
  isPolling: boolean;
}

const ScrobbleContext = createContext<ScrobbleContextValue | undefined>(undefined);

interface ScrobbleProviderProps {
  children: ReactNode;
}

/**
 * 🚀 ULTRA-SIMPLE V2 SCROBBLE CONTEXT
 * 
 * Mobile complexity: ZERO!
 * 
 * All we do:
 * 1. Poll Spotify every 30 seconds
 * 2. Send raw snapshot to server
 * 3. Server calculates EVERYTHING (40%, dedup, replay guard, album logic)
 * 
 * No complex state, no thresholds, no dedup logic.
 * Just poll & send. That's it!
 */

const POLL_INTERVAL = 30000; // 30 seconds

export const ScrobbleProvider = ({ children }: ScrobbleProviderProps) => {
  const { accessToken, user } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSnapshotRef = useRef<number>(0);

  /**
   * Simple function: Get current playback from Spotify
   */
  const getCurrentPlayback = async () => {
    if (!accessToken) return null;

    try {
      const response = await spotifyApi.get('/me/player/currently-playing');

      if (response.status === 204 || !response.data?.item) {
        return null;
      }

      const { item, is_playing, progress_ms, timestamp } = response.data;

      return {
        track: {
          id: item.id,
          name: item.name,
          artists: item.artists,
          album: item.album,
          duration_ms: item.duration_ms,
        },
        isPlaying: is_playing,
        progressMs: progress_ms || 0,
        timestamp: timestamp || Date.now(),
      };
    } catch (error) {
      console.error('[SCROBBLE V2] Failed to get playback:', error);
      return null;
    }
  };

  /**
   * Simple function: Send snapshot to server
   * Server does ALL the logic!
   */
  const sendSnapshot = async (playback: any) => {
    if (!user?.id || !accessToken) return;

    try {
      const snapshot = {
        spotifyId: playback.track.id,
        trackName: playback.track.name,
        artistName: playback.track.artists.map((a: any) => a.name).join(', '),
        albumId: playback.track.album?.id,
        albumName: playback.track.album?.name,
        albumArt: playback.track.album?.images?.[0]?.url,
        durationMs: playback.track.duration_ms,
        progressMs: playback.progressMs,
        timestamp: playback.timestamp,
        isPlaying: playback.isPlaying,
        device: 'mobile',
      };

      const response = await api.post(
        `/scrobble/v2/snapshot`,
        {
          accessToken,
          snapshot,
        },
        { timeout: 10000 }
      );

      const { action, message, stats } = response.data;

      if (action === 'scrobbled') {
        console.log('[SCROBBLE V2] ✅', playback.track.name, stats);
      } else if (action === 'too-early') {
        console.log('[SCROBBLE V2] ⏱️', message);
      } else if (action === 'duplicate') {
        console.log('[SCROBBLE V2] 🔄', message);
      }
    } catch (error) {
      console.error('[SCROBBLE V2] Failed to send snapshot:', error);
    }
  };

  /**
   * Super simple polling: Every 30s, get playback & send to server
   */
  const pollAndSend = async () => {
    const now = Date.now();
    
    // Prevent double-polling if previous call is still running
    if (now - lastSnapshotRef.current < 25000) {
      return;
    }
    lastSnapshotRef.current = now;

    setIsPolling(true);
    const playback = await getCurrentPlayback();
    setIsPolling(false);

    if (playback?.track) {
      setCurrentTrack(playback.track);
      
      // Only send if actually playing
      if (playback.isPlaying) {
        await sendSnapshot(playback);
      }
    } else {
      setCurrentTrack(null);
    }
  };

  /**
   * Start/stop polling based on auth state
   */
  useEffect(() => {
    if (!accessToken || !user?.id) {
      // No auth, stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling every 30 seconds
    pollAndSend(); // Initial call
    intervalRef.current = setInterval(pollAndSend, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [accessToken, user?.id]);

  /**
   * Resume polling when app comes to foreground
   * Also trigger archive job (max once per 24h) - skip on web
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && accessToken && user?.id) {
        // App came to foreground, check immediately
        pollAndSend();
        
        // Trigger archive job (will self-limit to once per 24h) - skip on web
        if (Platform.OS !== 'web') {
          runArchiveJob(user.id, accessToken).then((result) => {
            if (result.ok && result.saved > 0) {
              console.log(`[V2] Archive job: ${result.saved} scrobbles archived`);
            }
          }).catch((err) => {
            console.warn('[V2] Archive job failed:', err.message);
          });
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [accessToken, user?.id]);
  
  /**
   * Initialize archive table on mount (skip on web - SQLite not supported)
   */
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[V2] Archive skipped: SQLite not supported on web');
      return;
    }
    
    try {
      initArchiveTable();
      const stats = getArchiveStats();
      console.log('[V2] Archive ready:', stats.totalArchived, 'scrobbles archived');
    } catch (err) {
      console.warn('[V2] Archive init failed:', err);
    }
  }, []);

  return (
    <ScrobbleContext.Provider value={{ currentTrack, isPolling }}>
      {children}
    </ScrobbleContext.Provider>
  );
};

export const useScrobble = () => {
  const context = useContext(ScrobbleContext);
  if (!context) {
    throw new Error('useScrobble must be used within ScrobbleProviderV2');
  }
  return context;
};
