import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl, Linking, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getUserScrobbles, Scrobble, getAlbumDetails } from '../services/api';
import { useNavigation } from '@react-navigation/native';

type TabType = 'tracks' | 'albums';
type AlbumFilterType = 'all' | '100%' | '50%+' | '<50%';

interface CompletedAlbum {
  albumName: string;
  artistName: string;
  albumArt: string;
  albumId?: string;
  totalTracks: number;
  listenedTracks: number;
  completionPercent: number;
  totalPlays: number;
  lastPlayed: string;
}

const HistoryScreen = () => {
  const { user, accessToken } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('tracks');
  const [albumFilter, setAlbumFilter] = useState<AlbumFilterType>('all');
  const [scrobbles, setScrobbles] = useState<Scrobble[]>([]);
  const [allAlbums, setAllAlbums] = useState<CompletedAlbum[]>([]);
  const [filteredAlbums, setFilteredAlbums] = useState<CompletedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      if (user?.id) {
        const scrobblesData = await getUserScrobbles(user.id, 500); // Get more for album analysis
        setScrobbles(scrobblesData || []);
        
        // Calculate album completion with real total tracks from Spotify
        const albumMap = new Map<string, {
          tracks: Set<string>;
          plays: number;
          albumArt: string;
          artistName: string;
          lastPlayed: string;
          albumId?: string;
        }>();

        scrobblesData.forEach((scrobble) => {
          if (scrobble.albumName) {
            const key = scrobble.albumName;
            if (!albumMap.has(key)) {
              albumMap.set(key, {
                tracks: new Set(),
                plays: 0,
                albumArt: scrobble.albumArt || '',
                artistName: scrobble.artistName,
                lastPlayed: scrobble.playedAt,
                albumId: scrobble.albumId,
              });
            }
            const album = albumMap.get(key)!;
            
              // Update albumId if this scrobble has one and we don't have one yet
              if (scrobble.albumId && !album.albumId) {
                album.albumId = scrobble.albumId;
              }
            
              album.tracks.add(scrobble.spotifyId);
            album.plays++;
            if (new Date(scrobble.playedAt) > new Date(album.lastPlayed)) {
              album.lastPlayed = scrobble.playedAt;
            }
            // Use the first albumId we find
            if (!album.albumId && scrobble.albumId) {
              album.albumId = scrobble.albumId;
            }
          }
        });

        // Fetch album total tracks and calculate completion
        const completed: CompletedAlbum[] = [];
        
        // Process albums in batches to avoid overwhelming the API
        const albumEntries = Array.from(albumMap.entries());
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < albumEntries.length; i += BATCH_SIZE) {
          const batch = albumEntries.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async ([albumName, data]) => {
            let totalTracks = data.tracks.size; // Default fallback
            
            console.log('[HistoryScreen] Processing album:', albumName, {
              albumId: data.albumId,
              listenedTracks: data.tracks.size,
              defaultTotal: totalTracks,
            });
            
            // Try to get real total tracks from Spotify API
            if (data.albumId && accessToken) {
              try {
                const albumDetails = await getAlbumDetails(accessToken, data.albumId);
                totalTracks = albumDetails.total_tracks || albumDetails.tracks?.total || totalTracks;
                console.log('[HistoryScreen] Got Spotify details for', albumName, ':', totalTracks, 'tracks');
              } catch (error) {
                console.log('[HistoryScreen] Failed to fetch album details for', albumName, ':', error);
                // Silently use fallback on error
              }
            }

            const listenedTracks = data.tracks.size;
            const completionPercent = totalTracks > 0 ? Math.round((listenedTracks / totalTracks) * 100) : 0;

            console.log('[HistoryScreen] Completion for', albumName, ':', {
              listenedTracks,
              totalTracks,
              completionPercent,
              passes: totalTracks >= 5 && completionPercent >= 40,
            });

            // STRICT FILTER: Only albums/mixtapes with 5+ total tracks
            // AND user listened to 40%+ tracks (min 2 tracks for 5-track album)
            if (totalTracks >= 5 && completionPercent >= 40) {
              return {
                albumName,
                artistName: data.artistName,
                albumArt: data.albumArt,
                albumId: data.albumId,
                totalTracks,
                listenedTracks,
                completionPercent,
                totalPlays: data.plays,
                lastPlayed: data.lastPlayed,
              };
            }
            return null;
          });
          
          // Wait for this batch to complete
          const batchResults = await Promise.all(batchPromises);
          const validResults = batchResults.filter(item => item !== null) as CompletedAlbum[];
          completed.push(...validResults);
          
          // Small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < albumEntries.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Sort by completion: 100% first, then 50%+, then <50%, each group sorted by last played
        completed.sort((a, b) => {
          // First priority: completion tier
          const aTier = a.completionPercent === 100 ? 3 : a.completionPercent >= 50 ? 2 : 1;
          const bTier = b.completionPercent === 100 ? 3 : b.completionPercent >= 50 ? 2 : 1;
          
          if (aTier !== bTier) {
            return bTier - aTier; // Higher tier first
          }
          
          // Within same tier, sort by last played (recent first)
          return new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime();
        });

        setAllAlbums(completed);
        setFilteredAlbums(completed); // Initially show all
      }
    } catch (error) {
      console.error('Error loading history:', error);
      setScrobbles([]);
      setAllAlbums([]);
      setFilteredAlbums([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyAlbumFilter = (filter: AlbumFilterType) => {
    setAlbumFilter(filter);
    
    if (filter === 'all') {
      setFilteredAlbums(allAlbums);
    } else if (filter === '100%') {
      setFilteredAlbums(allAlbums.filter(a => a.completionPercent === 100));
    } else if (filter === '50%+') {
      setFilteredAlbums(allAlbums.filter(a => a.completionPercent >= 50 && a.completionPercent < 100));
    } else if (filter === '<50%') {
      setFilteredAlbums(allAlbums.filter(a => a.completionPercent < 50));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleRate = (scrobble: Scrobble) => {
    const track = {
      id: scrobble.spotifyId,
      name: scrobble.trackName,
      artists: scrobble.artistName.split(', ').map((name) => ({ name })),
      album: {
        name: scrobble.albumName ?? '',
        images: scrobble.albumArt ? [{ url: scrobble.albumArt }] : [],
      },
    };

    (navigation as any).navigate('AddReview', { itemType: 'track', track });
  };

  const openSpotifyTrack = async (trackId: string) => {
    if (!trackId) {
      Alert.alert('Error', 'No Spotify ID available for this track');
      return;
    }
    const spotifyUrl = `spotify:track:${trackId}`;
    const webUrl = `https://open.spotify.com/track/${trackId}`;

    try {
      const supported = await Linking.canOpenURL(spotifyUrl);
      if (supported) {
        await Linking.openURL(spotifyUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening Spotify:', error);
      Alert.alert('Error', 'Could not open Spotify');
    }
  };

  const handleViewAlbum = async (scrobble: Scrobble) => {
    if (!scrobble.albumName) return;
    
    // Navigate to Search tab and trigger search for the album
    (navigation as any).navigate('Search');
    
    // Give it a moment to navigate, then we can implement auto-search
    // For now, user can manually search for the album
  };

  const handleAlbumClick = async (album: CompletedAlbum) => {
    // Navigate to the new AlbumDetail screen with progress data
    // We need to fetch the listened track IDs for progress visualization
    const listenedTrackIds = scrobbles
      .filter(s => s.albumName === album.albumName && s.artistName === album.artistName)
      .map(s => s.spotifyId);

    (navigation as any).navigate('AlbumDetail', {
      albumId: album.albumId,
      albumName: album.albumName,
      artistName: album.artistName,
      albumArt: album.albumArt,
      listenedTracks: album.listenedTracks,
      totalTracks: album.totalTracks,
      completionPercent: album.completionPercent,
      listenedTrackIds: Array.from(new Set(listenedTrackIds)), // Remove duplicates
    });
  };

  const renderScrobble = ({ item }: { item: Scrobble }) => (
    <View style={styles.scrobbleCard}>
      {item.albumArt && (
        <TouchableOpacity onPress={() => handleViewAlbum(item)}>
          <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
        </TouchableOpacity>
      )}
      <View style={styles.scrobbleInfo}>
        <Text style={styles.trackName} numberOfLines={1}>
          {item.trackName}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artistName}
        </Text>
        {item.albumName && (
          <TouchableOpacity onPress={() => handleViewAlbum(item)}>
            <Text style={styles.albumNameLink} numberOfLines={1}>
              📀 {item.albumName}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.playedAt}>
          {new Date(item.playedAt).toLocaleString()}
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.spotifyButton} 
          onPress={() => openSpotifyTrack(item.spotifyId)}
        >
          <Text style={styles.spotifyButtonText}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rateButton} onPress={() => handleRate(item)}>
          <Text style={styles.rateButtonText}>Rate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompletedAlbum = ({ item }: { item: CompletedAlbum }) => (
    <TouchableOpacity 
      style={styles.albumCard}
      onPress={() => handleAlbumClick(item)}
      activeOpacity={0.7}
    >
      {item.albumArt && (
        <Image source={{ uri: item.albumArt }} style={styles.completedAlbumArt} />
      )}
      <View style={styles.albumInfo}>
        <View style={styles.albumHeader}>
          <View style={[
            styles.completedBadge,
            item.completionPercent === 100 ? styles.badge100 :
            item.completionPercent >= 50 ? styles.badge50Plus :
            styles.badgeLess50
          ]}>
            <Text style={styles.completedBadgeText}>
              {item.completionPercent === 100 ? '✓ 100%' : `${item.completionPercent}%`}
            </Text>
          </View>
        </View>
        <Text style={styles.albumTitle} numberOfLines={1}>
          {item.albumName}
        </Text>
        <Text style={styles.albumArtist} numberOfLines={1}>
          {item.artistName}
        </Text>
        <View style={styles.albumStats}>
          <Text style={styles.albumStat}>
            🎵 {item.listenedTracks}/{item.totalTracks} tracks • 🔁 {item.totalPlays} plays
          </Text>
        </View>
        <Text style={styles.albumDate}>
          {new Date(item.lastPlayed).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Listening History</Text>
        <Text style={styles.subtitle}>
          {scrobbles.length} tracks • {allAlbums.length} albums
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tracks' && styles.activeTab]}
          onPress={() => setActiveTab('tracks')}
        >
          <Text style={[styles.tabText, activeTab === 'tracks' && styles.activeTabText]}>
            Tracks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'albums' && styles.activeTab]}
          onPress={() => setActiveTab('albums')}
        >
          <Text style={[styles.tabText, activeTab === 'albums' && styles.activeTabText]}>
            Albums
          </Text>
        </TouchableOpacity>
      </View>

      {/* Album Filter Buttons (only show when Albums tab is active) */}
      {activeTab === 'albums' && (
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, albumFilter === 'all' && styles.activeFilterButton]}
            onPress={() => applyAlbumFilter('all')}
          >
            <Text style={[styles.filterButtonText, albumFilter === 'all' && styles.activeFilterButtonText]}>
              All ({allAlbums.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, albumFilter === '100%' && styles.activeFilterButton]}
            onPress={() => applyAlbumFilter('100%')}
          >
            <Text style={[styles.filterButtonText, albumFilter === '100%' && styles.activeFilterButtonText]}>
              100% ({allAlbums.filter(a => a.completionPercent === 100).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, albumFilter === '50%+' && styles.activeFilterButton]}
            onPress={() => applyAlbumFilter('50%+')}
          >
            <Text style={[styles.filterButtonText, albumFilter === '50%+' && styles.activeFilterButtonText]}>
              50%+ ({allAlbums.filter(a => a.completionPercent >= 50 && a.completionPercent < 100).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, albumFilter === '<50%' && styles.activeFilterButton]}
            onPress={() => applyAlbumFilter('<50%')}
          >
            <Text style={[styles.filterButtonText, albumFilter === '<50%' && styles.activeFilterButtonText]}>
              {'<50%'} ({allAlbums.filter(a => a.completionPercent < 50).length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'tracks' ? (
        <FlatList
          data={scrobbles.slice(0, 100)}
          renderItem={renderScrobble}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tracks yet</Text>
              <Text style={styles.emptySubtext}>
                Start listening to music and it will appear here
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredAlbums}
          renderItem={renderCompletedAlbum}
          keyExtractor={(item) => item.albumName + item.lastPlayed}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No completed albums yet</Text>
              <Text style={styles.emptySubtext}>
                Listen to 3+ tracks from an album to see it here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 15,
    borderBottomWidth: 3,
    borderBottomColor: '#1DB954',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#B3B3B3',
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
  },
  scrobbleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  scrobbleInfo: {
    flex: 1,
  },
  trackName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  artistName: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 3,
  },
  albumName: {
    color: '#808080',
    fontSize: 13,
    marginBottom: 4,
  },
  albumNameLink: {
    color: '#1DB954',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  playedAt: {
    color: '#666666',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  rateButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#B3B3B3',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1DB954',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#B3B3B3',
  },
  activeTabText: {
    color: '#1DB954',
  },
  albumCard: {
    flexDirection: 'row',
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  completedAlbumArt: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 15,
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completedBadge: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badge100: {
    backgroundColor: '#1DB954', // Green for 100%
  },
  badge50Plus: {
    backgroundColor: '#FFA500', // Orange for 50-99%
  },
  badgeLess50: {
    backgroundColor: '#808080', // Gray for <50%
  },
  completedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  albumTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  albumArtist: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 8,
  },
  albumStats: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 6,
  },
  albumStat: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '600',
  },
  albumDate: {
    color: '#666666',
    fontSize: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#1DB954',
    borderColor: '#1DB954',
  },
  filterButtonText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
});

export default HistoryScreen;
