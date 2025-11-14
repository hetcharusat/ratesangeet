import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Image, RefreshControl, TouchableOpacity, Animated } from 'react-native';
import { Appbar, Text, useTheme, Card, IconButton, FAB } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { getListeningStats, getCurrentlyPlaying } from '../services/api';
import SkeletonLine from '../components/ui/SkeletonLine';
import NowPlayingCard from '../components/NowPlayingCard';

type StatsSummary = {
  totalMinutes?: number;
  totalScrobbles?: number;
  uniqueArtistsCount?: number;
  totalReviews?: number;
};

type CurrentTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms?: number;
};

type PlayingState = {
  track: CurrentTrack | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
};

export default function HomeScreen({ navigation }: any) {
  const { user, accessToken } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsSummary>({});
  const [playingState, setPlayingState] = useState<PlayingState>({
    track: null,
    isPlaying: false,
    progressMs: 0,
    durationMs: 0,
  });
  const scrollY = new Animated.Value(0);

  const fetchData = async () => {
    if (!user?.id || !accessToken) {
      console.log('[HOME] Missing user or token, skipping data fetch');
      setLoading(false);
      return;
    }
    
    try {
      // Fetch stats
      const statsRes = await getListeningStats(user.id, accessToken);
      setStats({
        totalScrobbles: statsRes.totalScrobbles || 0,
        totalMinutes: statsRes.totalMinutes || 0,
        uniqueArtistsCount: statsRes.uniqueArtistsCount || 0,
        totalReviews: 0, // Will be fetched from reviews API later
      });

      // Fetch currently playing with progress
      try {
        const nowPlaying = await getCurrentlyPlaying(accessToken);
        if (nowPlaying.isPlaying && nowPlaying.track) {
          setPlayingState({
            track: nowPlaying.track,
            isPlaying: true,
            progressMs: nowPlaying.progressMs || 0,
            durationMs: nowPlaying.track.duration_ms || 0,
          });
        } else {
          setPlayingState({
            track: null,
            isPlaying: false,
            progressMs: 0,
            durationMs: 0,
          });
        }
      } catch (err) {
        console.log('[HOME] Not playing anything currently');
        setPlayingState({
          track: null,
          isPlaying: false,
          progressMs: 0,
          durationMs: 0,
        });
      }
    } catch (error) {
      console.error('[HOME] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  // Smart polling for currently playing track (pattern-based)
  useEffect(() => {
    if (!accessToken) return;

    let timeoutId: NodeJS.Timeout;

    const smartPoll = async () => {
      try {
        const nowPlaying = await getCurrentlyPlaying(accessToken);
        
        if (nowPlaying.isPlaying && nowPlaying.track) {
          const trackChanged = nowPlaying.track.id !== playingState.track?.id;
          
          setPlayingState({
            track: nowPlaying.track,
            isPlaying: true,
            progressMs: nowPlaying.progressMs || 0,
            durationMs: nowPlaying.track.duration_ms || 0,
          });

          // Calculate smart next check interval
          const progressMs = nowPlaying.progressMs || 0;
          const durationMs = nowPlaying.track.duration_ms || 180000;
          const timeLeftMs = durationMs - progressMs;
          const scrobblePointMs = durationMs * 0.5;
          
          let nextCheckMs;
          
          if (trackChanged || progressMs < 5000) {
            // New track or just started - check at 5s mark
            nextCheckMs = Math.max(5000 - progressMs, 5000);
          } else if (progressMs < 15000) {
            // Early skip window - check at 15s
            nextCheckMs = Math.max(15000 - progressMs, 5000);
          } else if (progressMs < scrobblePointMs) {
            // Before scrobble point - check at 50% mark
            nextCheckMs = Math.max(scrobblePointMs - progressMs, 5000);
          } else if (timeLeftMs > 6000) {
            // After scrobble, not near end - check at 60% mark or end
            const sixtyPercentMs = durationMs * 0.6;
            if (progressMs < sixtyPercentMs) {
              nextCheckMs = Math.max(sixtyPercentMs - progressMs, 5000);
            } else {
              nextCheckMs = Math.max(timeLeftMs - 3000, 5000);
            }
          } else {
            // Near end - check before track ends
            nextCheckMs = Math.max(timeLeftMs - 1000, 2000);
          }
          
          // Safety caps: min 5s, max 30s
          nextCheckMs = Math.max(5000, Math.min(30000, nextCheckMs));
          
          console.log(`[HOME] Next check in ${Math.round(nextCheckMs / 1000)}s`);
          timeoutId = setTimeout(smartPoll, nextCheckMs);
        } else {
          // Not playing - check every 30s
          setPlayingState({
            track: null,
            isPlaying: false,
            progressMs: 0,
            durationMs: 0,
          });
          timeoutId = setTimeout(smartPoll, 30000);
        }
      } catch (err) {
        console.log('[HOME] Polling error:', err);
        // Retry in 30s on error
        timeoutId = setTimeout(smartPoll, 30000);
      }
    };

    smartPoll();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [accessToken]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Custom App Bar */}
      <Appbar.Header elevated mode="center-aligned" style={{ backgroundColor: theme.colors.surface }}>
        <View style={styles.appbarContent}>
          <View style={styles.appbarLeft}>
            <Image
              source={{ uri: user?.profileImage || 'https://ui-avatars.com/api/?name=' + (user?.displayName || 'User') }}
              style={styles.avatar}
            />
          </View>
          <Text variant="titleLarge" style={styles.appbarTitle}>
            Hi, {user?.displayName?.split(' ')[0] || 'User'}
          </Text>
          <View style={{ width: 48 }} />
        </View>
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Grid - 2x2 */}
        {loading ? (
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonLine key={i} width="48%" height={100} style={{ borderRadius: 16 }} />
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <Text variant="bodyLarge" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                Scrobbles
              </Text>
              <Text variant="displayMedium" style={[styles.statValue, { color: theme.colors.onSurface }]}>
                {formatNumber(stats.totalScrobbles)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => navigation.navigate('Discovery')}
              activeOpacity={0.7}
            >
              <Text variant="bodyLarge" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                Artists
              </Text>
              <Text variant="displayMedium" style={[styles.statValue, { color: theme.colors.onSurface }]}>
                {formatNumber(stats.uniqueArtistsCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Text variant="bodyLarge" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                Reviews
              </Text>
              <Text variant="displayMedium" style={[styles.statValue, { color: theme.colors.onSurface }]}>
                {formatNumber(stats.totalReviews)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: theme.colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <Text variant="bodyLarge" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                Time
              </Text>
              <Text variant="displayMedium" style={[styles.statValue, { color: theme.colors.onSurface }]}>
                {formatTime(stats.totalMinutes)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Currently Playing - Full width, aligned with stats grid */}
        {playingState.track && (
          <View style={{ paddingHorizontal: 0 }}>
            <NowPlayingCard
              track={playingState.track}
              progressMs={playingState.progressMs}
              durationMs={playingState.durationMs}
              isPlaying={playingState.isPlaying}
              onRate={() => {
                // Navigate to rate/review screen
                navigation.navigate('AddReview', {
                  trackId: playingState.track?.id,
                  trackName: playingState.track?.name,
                  artistName: playingState.track?.artists.map(a => a.name).join(', '),
                });
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Animated FAB for Search */}
      <FAB
        icon="magnify"
        style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
        color={theme.colors.onPrimaryContainer}
        onPress={() => navigation.navigate('Search')}
        animated
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 4,
  },
  appbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appbarTitle: {
    fontWeight: '700',
    fontSize: 20,
    flex: 1,
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    aspectRatio: 1,
    padding: 16,
    borderRadius: 16,
    justifyContent: 'space-between',
    elevation: 0,
  },
  statLabel: {
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'left',
  },
  statValue: {
    fontWeight: '700',
    fontSize: 36,
    textAlign: 'left',
    fontFamily: 'System', // Apple San Francisco on iOS
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
