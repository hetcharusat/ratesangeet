import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Appbar, Text, useTheme, ActivityIndicator, Button, Divider, IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getV2Album, getV2AlbumScrobbles, computeAlbumProgress, V2Scrobble } from '../services/api';
import AlbumProgress from '../components/ui/AlbumProgress';
import RSButton from '../components/ui/RSButton';
import ReviewModal from '../components/modals/ReviewModal';
import SkeletonLine from '../components/ui/SkeletonLine';

interface RouteParams { albumId?: string; albumName?: string; }
interface AlbumMeta { id?: string; name?: string; artistName?: string; albumArt?: string; totalTracks?: number; }
interface AlbumTrack { spotifyId?: string; trackName: string; artistName: string; durationMs?: number; playedAt?: string; playCount?: number; }

// NOTE: fetchAlbumStats legacy removed; progress derived from scrobbles only for V2 minimal client

export default function AlbumDetailV2({ route, navigation }: any) {
  const { albumId, albumName }: RouteParams = route.params || {};
  const { user, accessToken } = useAuth();
  const theme = useTheme();

  const [meta, setMeta] = useState<AlbumMeta | null>(null);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [completionPct, setCompletionPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uniqueTrackIds, setUniqueTrackIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const computeCompletion = useCallback((uniqueCount: number, total?: number) => {
    if (!total || total < 4) return 0;
    return Math.min(100, (uniqueCount / total) * 100);
  }, []);

  const load = useCallback(async () => {
    if (!albumId && !albumName) return;
    setLoading(true);
    setError(null);
    
    try {
      // Parallel fetch with 10s timeout
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const [album, scrobbles] = await Promise.race([
        Promise.all([
          albumId ? getV2Album(albumId) : Promise.resolve(null),
          getV2AlbumScrobbles(albumId || albumName || ''),
        ]),
        timeout
      ]) as any;

      // Derive meta
      const firstScrobble = (scrobbles as V2Scrobble[])[0];
      const merged: AlbumMeta = {
        id: album?.id || albumId,
        name: album?.name || albumName || firstScrobble?.albumName,
        artistName: album?.artistName || firstScrobble?.artistName,
        albumArt: (album as any)?.imageSmall || firstScrobble?.albumArt,
        totalTracks: (album as any)?.totalTracks, // V2 album includes totalTracks
      };
      setMeta(merged);

      // Build track list from scrobbles (latest play per track)
      const byTrack: Record<string, AlbumTrack> = {};
      (scrobbles as V2Scrobble[]).forEach(s => {
        const key = s.spotifyId || `${s.trackName}|${s.artistName}`;
        if (!byTrack[key]) {
          byTrack[key] = {
            spotifyId: s.spotifyId,
            trackName: s.trackName,
            artistName: s.artistName,
            durationMs: s.durationMs,
            playedAt: s.playedAt,
            playCount: 1,
          };
        } else {
          byTrack[key].playCount = (byTrack[key].playCount || 0) + 1;
          // keep most recent playedAt
          if (new Date(s.playedAt) > new Date(byTrack[key].playedAt || 0)) {
            byTrack[key].playedAt = s.playedAt;
          }
        }
      });
      const trackArr = Object.values(byTrack).sort((a,b) => (a.trackName.localeCompare(b.trackName)));
      setTracks(trackArr);

      const uniqueIds = new Set(trackArr.map(t => t.spotifyId || t.trackName));
      setUniqueTrackIds(uniqueIds);
      const progress = computeAlbumProgress(scrobbles as V2Scrobble[], merged.totalTracks);
      setCompletionPct(progress.percent);
    } catch (err: any) {
      console.error('Album load failed:', err);
      setError(err.message || 'Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [albumId, albumName, accessToken, user?.id, computeCompletion]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const renderItem = ({ item }: { item: AlbumTrack }) => (
    <View style={styles.trackCard}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.trackName}</Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>
          {item.artistName}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        <Text variant="labelLarge" style={{ fontWeight: '600' }}>{item.playCount}×</Text>
        <Text variant="labelSmall" style={{ opacity: 0.5 }}>plays</Text>
      </View>
    </View>
  );


  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header mode="center-aligned" statusBarHeight={0} elevated={false} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={meta?.name || 'Album'} subtitle={meta?.artistName} titleStyle={{ fontWeight: '600' }} />
        <IconButton icon="refresh" onPress={load} />
      </Appbar.Header>
      
      {loading && (
        <View style={{ padding: 16 }}>
          <SkeletonLine height={200} style={{ borderRadius: 12, marginBottom: 16 }} />
          <SkeletonLine height={80} style={{ borderRadius: 12, marginBottom: 12 }} />
          <SkeletonLine height={60} style={{ borderRadius: 12, marginBottom: 12 }} />
          <SkeletonLine height={60} style={{ borderRadius: 12 }} />
        </View>
      )}
      
      {!loading && error && (
        <View style={styles.empty}>
          <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>⚠️</Text>
          <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>Error loading album</Text>
          <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center', marginBottom: 16 }}>
            {error}
          </Text>
          <Button mode="contained" onPress={load}>Try Again</Button>
        </View>
      )}
      
      {!loading && meta && (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.spotifyId || t.trackName}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {meta.albumArt && (
                <View style={styles.coverContainer}>
                  <Image source={{ uri: meta.albumArt }} style={styles.cover} />
                </View>
              )}
              <Text variant="titleLarge" style={styles.title}>{meta.name}</Text>
              {meta.artistName && <Text variant="titleMedium" style={styles.artist}>{meta.artistName}</Text>}
              
              <View style={styles.progressCard}>
                <AlbumProgress percent={completionPct} uniqueCount={uniqueTrackIds.size} totalTracks={meta.totalTracks} />
              </View>
              
              <Button 
                mode="contained" 
                onPress={() => setReviewOpen(true)} 
                style={{ marginTop: 16, borderRadius: 12, minHeight: 48 }}
              >
                Rate / Review
              </Button>
              
              <Text variant="titleLarge" style={{ marginTop: 24, marginBottom: 12, fontWeight: '600' }}>
                Tracks ({tracks.length})
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80, gap: 8 }}
        />
      )}
      <ReviewModal
        visible={reviewOpen}
        onDismiss={() => setReviewOpen(false)}
        itemType="album"
        spotifyId={meta?.id || ''}
        itemName={meta?.name || albumName || 'Unknown Album'}
        artistName={meta?.artistName || 'Unknown Artist'}
        albumArt={meta?.albumArt}
        onSuccess={() => { onRefresh(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16 },
  coverContainer: { 
    alignItems: 'center', 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cover: { width: 200, height: 200, borderRadius: 16 },
  title: { textAlign: 'center', fontWeight: '600' },
  artist: { textAlign: 'center', opacity: 0.8, marginTop: 4 },
  progressCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    minHeight: 48,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
