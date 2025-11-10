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

  const allResults = [...albums, ...tracks, ...artists, ...users];

  const renderItem = ({ item }: { item: Album | Track | Artist | AppUser }) => {
    let imageUri = '';
    if ('images' in item && item.images && item.images.length > 0) {
      imageUri = item.images[0].url;
    } else if ('album' in item && item.album.images && item.album.images.length > 0) {
      imageUri = item.album.images[0].url;
    }

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => {
          if ('album_type' in item) {
            navigation.navigate('AddReview', { itemType: 'album', album: { id: item.id, name: item.name, images: item.images, artists: item.artists } });
          } else if ('type' in item && item.type === 'track') {
            navigation.navigate('AddReview', { itemType: 'track', track: item });
          } else if ('type' in item && item.type === 'artist') {
            navigation.navigate('Artist', { artistId: item.id, q: item.name });
          } else if ('_id' in item) {
            navigation.navigate('Profile', { userId: item._id });
          }
        }}
      >
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.itemImage} /> : <View style={styles.itemImage} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
          </View>
        )}

        {!loading && query.trim().length >= 2 && allResults.length === 0 && (
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
            sections={[{ data: allResults }]}
            renderItem={renderItem}
            keyExtractor={(item: any) => item.id}
            numColumns={3}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  searchInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 10,
  },
  itemContainer: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 5,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
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
    color: '#999',
    fontSize: 16,
  },
});

export default SearchScreen;
