import React, { useState, useCallback, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Appbar, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getV2RecentScrobbles, V2Scrobble } from '../services/api';
import { getArchiveStats } from '../storage/archiveJob';
import RSCard from '../components/ui/RSCard';
import SkeletonLine from '../components/ui/SkeletonLine';

export default function HistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const theme = useTheme();
  const [scrobbles, setScrobbles] = useState<V2Scrobble[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [archiveCount, setArchiveCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cloud = await getV2RecentScrobbles(200);
      setScrobbles(cloud);
      // Get archive count if available
      try {
        const stats = getArchiveStats();
        setArchiveCount(stats.totalArchived);
      } catch {}
    } catch (err) {
      console.warn('Failed to load history:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: V2Scrobble }) => (
    <View style={styles.scrobbleCard}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>
          {item.trackName}
        </Text>
        <Text variant="bodyMedium" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>
          {item.artistName}
        </Text>
        <Text variant="labelSmall" style={{ opacity: 0.5, marginTop: 4 }}>
          {new Date(item.playedAt).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="center-aligned" style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Content 
          title="History" 
          titleStyle={{ fontWeight: '600' }}
        />
      </Appbar.Header>
      
      {loading && (
        <View style={{ padding: 16 }}>
          <SkeletonLine height={80} style={{ marginBottom: 12, borderRadius: 12 }} />
          <SkeletonLine height={80} style={{ marginBottom: 12, borderRadius: 12 }} />
          <SkeletonLine height={80} style={{ marginBottom: 12, borderRadius: 12 }} />
        </View>
      )}
      
      {!loading && (
        <FlatList
          data={scrobbles}
          keyExtractor={(item, idx) => `${item.spotifyId}-${item.playedAt}-${idx}`}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>🎵</Text>
              <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>
                No scrobbles yet
              </Text>
              <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center' }}>
                Start listening to music on Spotify{'\n'}and your history will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrobbleCard: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
});
