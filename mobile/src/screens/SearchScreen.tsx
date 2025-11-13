import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Appbar, Searchbar, SegmentedButtons, Text, useTheme, Avatar } from 'react-native-paper';
import { searchMusic, searchUsersOptimized } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RSButton from '../components/ui/RSButton';
import SkeletonLine from '../components/ui/SkeletonLine';

type SearchTab = 'tracks' | 'albums' | 'users';

export default function SearchV2Screen({ navigation }: any) {
  const { accessToken } = useAuth();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('tracks');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = useCallback(async () => {
    if (!debouncedQuery.trim() || !accessToken) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      if (tab === 'users') {
        const data = await searchUsersOptimized(debouncedQuery, 1, 50);
        setResults(data.results || []);
      } else {
        const data = await searchMusic(accessToken || '', debouncedQuery, tab);
        setResults(tab === 'tracks' ? (data.tracks?.items || []) : (data.albums?.items || []));
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    }
    setLoading(false);
  }, [debouncedQuery, tab, accessToken]);

  useEffect(() => { performSearch(); }, [performSearch]);

  const renderTrack = ({ item }: any) => (
      <View style={styles.resultCard}>
        {item.album?.images?.[0]?.url && (
          <Avatar.Image size={56} source={{ uri: item.album.images[0].url }} style={{ borderRadius: 8 }} />
        )}
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.name}</Text>
          <Text variant="bodyMedium" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>
            {item.artists?.map((a: any) => a.name).join(', ')}
          </Text>
        </View>
      </View>
  );

  const renderAlbum = ({ item }: any) => (
      <Pressable onPress={() => navigation.navigate('AlbumDetail', { albumId: item.id, albumName: item.name })}>
        <View style={styles.resultCard}>
          {item.images?.[0]?.url && (
            <Avatar.Image size={56} source={{ uri: item.images[0].url }} style={{ borderRadius: 8 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text variant="bodyMedium" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>
              {item.artists?.map((a: any) => a.name).join(', ')}
            </Text>
          </View>
        </View>
      </Pressable>
  );

  const renderUser = ({ item }: any) => (
      <Pressable onPress={() => navigation.navigate('Profile', { userId: item._id })}>
        <View style={styles.resultCard}>
          <Avatar.Text size={56} label={(item.displayName || item.username || 'U').charAt(0).toUpperCase()} />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" numberOfLines={1} style={{ fontWeight: '600' }}>{item.displayName}</Text>
            <Text variant="bodyMedium" numberOfLines={1} style={{ opacity: 0.7, marginTop: 4 }}>
              @{item.username || 'user'}
            </Text>
          </View>
          <RSButton mode="outlined" compact style={{ minHeight: 48 }}>Follow</RSButton>
        </View>
      </Pressable>
  );

  const renderItem = tab === 'tracks' ? renderTrack : tab === 'albums' ? renderAlbum : renderUser;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header mode="center-aligned" style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.Content title="Search" titleStyle={{ fontWeight: '600' }} />
      </Appbar.Header>

      <View style={styles.searchBar}>
        <Searchbar
          placeholder="Search tracks, albums, users..."
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as SearchTab)}
        buttons={[
          { value: 'tracks', label: 'Tracks' },
          { value: 'albums', label: 'Albums' },
          { value: 'users', label: 'Users' },
        ]}
        style={styles.tabs}
      />

      {loading && (
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine height={72} style={{ borderRadius: 12 }} />
        </View>
      )}

      {!loading && results.length === 0 && debouncedQuery.trim() && (
        <View style={styles.empty}>
          <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>😔</Text>
          <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>No results</Text>
          <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center' }}>
            Try a different search term
          </Text>
        </View>
      )}

      {!loading && !debouncedQuery.trim() && (
        <View style={styles.empty}>
          <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>🔍</Text>
          <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>Search music & friends</Text>
          <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center' }}>
            Find tracks, albums, and users
          </Text>
        </View>
      )}

      {!loading && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item, idx) => item.id || item._id || `${tab}-${idx}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { paddingHorizontal: 16, paddingVertical: 8 },
  tabs: { marginHorizontal: 16, marginBottom: 12 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
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
