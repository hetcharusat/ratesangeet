import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, useTheme, Text, Avatar } from 'react-native-paper';
import { getDiscoveryData, DiscoveryPayload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SkeletonLine from '../components/ui/SkeletonLine';

export default function DiscoveryV2Screen({ navigation }: any) {
  const { accessToken } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<DiscoveryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiscovery = useCallback(async () => {
    try {
      const result = await getDiscoveryData(accessToken || undefined);
      setData(result);
    } catch (err) {
      console.error('Failed to load discovery:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, [accessToken]);

  useEffect(() => { loadDiscovery(); }, [loadDiscovery]);

  const onRefresh = () => { setRefreshing(true); loadDiscovery(); };

  if (loading) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Appbar.Header>
          <Appbar.Content title="Discover" />
        </Appbar.Header>
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Appbar.Header>
        <Appbar.Content title="Discover" />
      </Appbar.Header>

      <View style={{ padding: 16, gap: 16 }}>
        {data?.newReleases?.albums?.length ? (
          <View>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 8 }}>New releases</Text>
            <View style={{ gap: 8 }}>
              {data.newReleases.albums.slice(0, 6).map((item: any) => (
                <View key={item.albumId} style={styles.card}>
                  {item.albumArt ? <Avatar.Image size={56} source={{ uri: item.albumArt }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.albumName}</Text>
                    <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>{item.artistName}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data?.recommendations?.tracks?.length ? (
          <View>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 8 }}>Recommended for you</Text>
            <View style={{ gap: 8 }}>
              {data.recommendations.tracks.slice(0, 8).map((item: any) => (
                <View key={item.trackId} style={styles.card}>
                  {item.albumArt ? <Avatar.Image size={56} source={{ uri: item.albumArt }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.trackName}</Text>
                    <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>{item.artistName}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {data?.featuredPlaylists?.playlists?.length ? (
          <View>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 8 }}>Featured playlists</Text>
            <View style={{ gap: 8 }}>
              {data.featuredPlaylists.playlists.slice(0, 6).map((item: any) => (
                <View key={item.playlistId} style={styles.card}>
                  {item.coverArt ? <Avatar.Image size={56} source={{ uri: item.coverArt }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.playlistName}</Text>
                    <Text variant="bodySmall" numberOfLines={2} style={{ opacity: 0.7, marginTop: 4 }}>{item.description || 'Playlist'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!data && (
          <View style={styles.empty}> 
            <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>🧭</Text>
            <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>Nothing to discover yet</Text>
            <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center' }}>Start listening on Spotify and check back.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    minHeight: 48,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
});
