import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  SectionList,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { searchMusic, searchUsers, Track } from '../services/api';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Album {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  album_type: string;
}

type FilterType = 'all' | 'albums' | 'tracks' | 'artists' | 'users';

interface Artist {
  id: string;
  name: string;
  images?: { url: string }[];
}

interface AppUser {
  _id: string;
  displayName: string;
  email?: string;
  profileImage?: string;
  username?: string;
}

const SearchScreen = () => {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [query, setQuery] = useState('');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // Support opening with an initial query (from credits chips etc.)
  useEffect(() => {
    const params = (route?.params || {}) as { initialQuery?: string; initialFilter?: FilterType };
    if (params.initialQuery) {
      setQuery(params.initialQuery);
      if (params.initialFilter) setFilter(params.initialFilter);
      // Trigger search shortly after state updates
      const t = setTimeout(() => handleSearch(), 50);
      return () => clearTimeout(t);
    }
  }, [route?.params]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAlbums([]);
      setTracks([]);
    }
  }, [query]);

  const handleSearch = async () => {
    if (!accessToken || !query.trim()) return;

    setLoading(true);
    try {
      const wantAlbums = filter === 'all' || filter === 'albums';
      const wantTracks = filter === 'all' || filter === 'tracks';
      const wantArtists = filter === 'all' || filter === 'artists';
      const wantUsers = filter === 'users';

      const types = [
        wantAlbums ? 'album' : null,
        wantTracks ? 'track' : null,
        wantArtists ? 'artist' : null,
      ].filter(Boolean).join(',') || 'track,album';

      const data = await searchMusic(accessToken, query, types);
      const albumItems: Album[] = wantAlbums ? (data?.albums?.items || []) : [];
      const trackItems: Track[] = wantTracks ? (data?.tracks?.items || []) : [];
      const artistItems: Artist[] = wantArtists ? (data?.artists?.items || []) : [];
      setArtists(artistItems);
      setUsers([]);
      if (wantUsers) {
        try {
          const res = await searchUsers(query, 20);
          setUsers(res || []);
        } catch (e) {
          setUsers([]);
        }
      }
      setAlbums(albumItems);
      setTracks(trackItems);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAlbum = ({ item }: { item: Album }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() =>
        navigation.navigate(
          'AddReview' as never,
          { itemType: 'album', album: { id: item.id, name: item.name, images: item.images, artists: item.artists } } as never
        )
      }
    >
      <Image
        source={{ uri: item.images?.[0]?.url || '' }}
        style={styles.albumArt}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.badge}>{item.album_type?.toUpperCase() || 'ALBUM'}</Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name || 'Unknown Album'}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
        </Text>
      </View>
      <Text style={styles.addButton}>+</Text>
    </TouchableOpacity>
  );

  const renderTrack = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() =>
        navigation.navigate(
          'AddReview' as never,
          { itemType: 'track', track: item } as never
        )
      }
    >
      <Image
        source={{ uri: item.album?.images?.[0]?.url || '' }}
        style={styles.albumArt}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.badge}>TRACK</Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name || 'Unknown Track'}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'}
        </Text>
        <Text style={styles.albumName} numberOfLines={1}>
          {item.album?.name || 'Unknown Album'}
        </Text>
      </View>
      <Text style={styles.addButton}>+</Text>
    </TouchableOpacity>
  );

  const renderArtist = ({ item }: { item: Artist }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => navigation.navigate('Artist' as never, { artistId: item.id, q: item.name } as never)}
    >
      {item.images?.[0]?.url ? (
        <Image source={{ uri: item.images[0].url }} style={[styles.albumArt, { borderRadius: 30 }]} />
      ) : (
        <View style={[styles.albumArt, { borderRadius: 30, backgroundColor: '#3E3E3E', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.badge}>ARTIST</Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <Text style={styles.addButton}>→</Text>
    </TouchableOpacity>
  );

  const renderUser = ({ item }: { item: AppUser }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => navigation.navigate('Profile' as never, { userId: item._id } as never)}
    >
      {item.profileImage ? (
        <Image source={{ uri: item.profileImage }} style={[styles.albumArt, { borderRadius: 30 }]} />
      ) : (
        <View style={[styles.albumArt, { borderRadius: 30, backgroundColor: '#3E3E3E', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{item.displayName?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.badge}>USER</Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.displayName}
        </Text>
        {!!item.username && (
          <Text style={styles.artistName} numberOfLines={1}>@{item.username}</Text>
        )}
      </View>
      <Text style={styles.addButton}>→</Text>
    </TouchableOpacity>
  );

  const sections = [
    ...((filter === 'all' || filter === 'albums') && albums.length > 0
      ? [{ title: 'Albums', data: albums, renderItem: renderAlbum }]
      : []),
    ...((filter === 'all' || filter === 'tracks') && tracks.length > 0
      ? [{ title: 'Tracks', data: tracks, renderItem: renderTrack }]
      : []),
    ...((filter === 'all' || filter === 'artists') && artists.length > 0
      ? [{ title: 'Artists', data: artists, renderItem: renderArtist }]
      : []),
    ...(filter === 'users' && users.length > 0
      ? [{ title: 'Users', data: users, renderItem: renderUser }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tracks, albums, artists, or users"
          placeholderTextColor="#B3B3B3"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {(['all','albums','tracks','artists','users'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'albums' ? 'Albums' : f === 'tracks' ? 'Tracks' : f === 'artists' ? 'Artists' : 'Users'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      )}

      {!loading && query.trim().length >= 2 && sections.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      )}
      {!loading && query.trim().length < 2 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        </View>
      )}

      {!loading && (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: any, index) => item.id + index}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContainer}
          stickySectionHeadersEnabled={false}
        />
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#191414',
  },
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#282828',
  },
  searchInput: {
    backgroundColor: '#3E3E3E',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 25,
    fontSize: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  filterChip: {
    backgroundColor: '#3E3E3E',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1DB954',
  },
  filterChipText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    backgroundColor: '#191414',
    padding: 15,
    paddingBottom: 10,
  },
  sectionTitle: {
    color: '#1DB954',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemCard: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#282828',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  badge: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  artistName: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 2,
  },
  albumName: {
    color: '#666',
    fontSize: 12,
  },
  addButton: {
    color: '#1DB954',
    fontSize: 30,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
});

export default SearchScreen;
