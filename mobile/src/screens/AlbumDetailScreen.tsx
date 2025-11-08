import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getAlbumDetails } from '../services/api';

type AlbumDetailRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;
type AlbumDetailNavigationProp = StackNavigationProp<RootStackParamList, 'AlbumDetail'>;

interface AlbumTrack {
  id: string;
  name: string;
  durationMs: number;
  trackNumber: number;
  listened?: boolean; // For progress tracking from History
}

interface AlbumDetailScreenProps {
  // Optional children for pluggable sections (rating, review form, etc.)
  children?: React.ReactNode;
}

const AlbumDetailScreen: React.FC<AlbumDetailScreenProps> = ({ children }) => {
  const route = useRoute<AlbumDetailRouteProp>();
  const navigation = useNavigation<AlbumDetailNavigationProp>();
  const { accessToken } = useAuth();

  const {
    albumId,
    albumName,
    artistName,
    albumArt,
    // Progress data (optional, from History screen)
    listenedTracks,
    totalTracks,
    completionPercent,
    // Listened track IDs for progress visualization
    listenedTrackIds,
  } = route.params;

  const [loading, setLoading] = useState(true);
  const [albumDetails, setAlbumDetails] = useState<any>(null);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);

  useEffect(() => {
    console.log('[AlbumDetail] Route params:', {
      albumId,
      albumName,
      artistName,
      hasAlbumArt: !!albumArt,
      listenedTracks,
      totalTracks,
      completionPercent,
      listenedTrackIdsCount: listenedTrackIds?.length || 0,
    });
    loadAlbumDetails();
  }, [albumId]);

  const loadAlbumDetails = async () => {
    try {
      // If we have albumId AND accessToken, fetch full details from Spotify
      if (albumId && accessToken) {
        try {
          console.log('[AlbumDetail] Fetching album details for:', albumId);
          const details = await getAlbumDetails(accessToken, albumId);
          setAlbumDetails(details);

          // Map tracks and mark which ones are listened
          const tracksData: AlbumTrack[] = (details.tracks?.items || []).map((track: any) => ({
            id: track.id,
            name: track.name,
            durationMs: track.duration_ms,
            trackNumber: track.track_number,
            listened: listenedTrackIds?.includes(track.id) || false,
          }));

          console.log('[AlbumDetail] Loaded tracks:', tracksData.length, 'listened:', tracksData.filter(t => t.listened).length);
          setTracks(tracksData);
        } catch (error) {
          console.error('[AlbumDetail] Error fetching album details, showing basic info only:', error);
          // Don't fail completely - we still have basic info from route params
        }
      } else {
        console.log('[AlbumDetail] No albumId or accessToken, showing basic info only');
      }
    } catch (error) {
      console.error('[AlbumDetail] Error loading album details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    const spotifyUrl = albumId 
      ? `spotify:album:${albumId}`
      : `spotify:search:${encodeURIComponent(`${albumName} ${artistName}`)}`;
    
    const webUrl = albumId
      ? `https://open.spotify.com/album/${albumId}`
      : `https://open.spotify.com/search/${encodeURIComponent(`${albumName} ${artistName}`)}`;

    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
    } else {
      Linking.openURL(spotifyUrl).catch(() => {
        Linking.openURL(webUrl);
      });
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading album details...</Text>
      </View>
    );
  }

  const releaseYear = albumDetails?.release_date?.split('-')[0] || '';
  const totalDuration = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const totalMinutes = Math.floor(totalDuration / 60000);
  
  // IMPORTANT: Use the progress data from route params (from History screen)
  // Do NOT recalculate from tracks, as that would show 100% completion incorrectly
  // The route params already have the correct listenedTracks/totalTracks based on 40% scrobble threshold
  const displayListenedCount = listenedTracks !== undefined ? listenedTracks : tracks.filter(t => t.listened).length;
  const displayTotalCount = totalTracks !== undefined ? totalTracks : tracks.length;
  const displayCompletionPercent = completionPercent !== undefined ? completionPercent : 
    (displayTotalCount > 0 ? Math.round((displayListenedCount / displayTotalCount) * 100) : 0);

  console.log('[AlbumDetail] Display values:', {
    displayListenedCount,
    displayTotalCount,
    displayCompletionPercent,
    tracksFromAPI: tracks.length,
    listenedFromParams: listenedTracks,
    totalFromParams: totalTracks,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Album Cover & Basic Info */}
      <View style={styles.header}>
        <Image 
          source={{ uri: albumArt || albumDetails?.images?.[0]?.url }} 
          style={styles.albumArt}
        />
        <Text style={styles.albumName}>{albumName}</Text>
        <Text style={styles.artistName}>{artistName}</Text>
        {releaseYear && (
          <Text style={styles.releaseYear}>{releaseYear}</Text>
        )}
      </View>

      {/* Progress Section (if coming from History) */}
      {listenedTracks !== undefined && totalTracks !== undefined && (
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Listening Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${displayCompletionPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {displayListenedCount} / {displayTotalCount} tracks ({displayCompletionPercent}%)
          </Text>
          {displayCompletionPercent === 100 && (
            <Text style={styles.completedBadge}>✓ Album Completed!</Text>
          )}
        </View>
      )}

      {/* Play Button */}
      <TouchableOpacity style={styles.playButton} onPress={handlePlay}>
        <Text style={styles.playButtonText}>
          {albumId ? '▶ Play on Spotify' : '🔍 Search on Spotify'}
        </Text>
      </TouchableOpacity>

      {/* Album Stats - Show if we have data from History OR Spotify API */}
      {(albumDetails || (listenedTracks !== undefined && totalTracks !== undefined)) && (
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{displayTotalCount}</Text>
            <Text style={styles.statLabel}>Tracks</Text>
          </View>
          {totalMinutes > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMinutes} min</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          )}
          {listenedTracks !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{displayCompletionPercent}%</Text>
              <Text style={styles.statLabel}>Complete</Text>
            </View>
          )}
        </View>
      )}

      {/* Track List */}
      {tracks.length > 0 && (
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>Tracks</Text>
          {tracks.map((track) => (
            <View 
              key={track.id} 
              style={[
                styles.trackItem,
                track.listened && styles.trackItemListened
              ]}
            >
              <View style={styles.trackInfo}>
                <Text style={styles.trackNumber}>{track.trackNumber}</Text>
                <Text style={[
                  styles.trackName,
                  track.listened && styles.trackNameListened
                ]}>
                  {track.name}
                  {track.listened && ' ✓'}
                </Text>
              </View>
              <Text style={styles.trackDuration}>{formatDuration(track.durationMs)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Rate This Album Button */}
      <View style={{ marginTop: 24, alignItems: 'center' }}>
        <TouchableOpacity
          style={{ backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 24 }}
          onPress={() => {
            navigation.navigate('AddReview', {
              itemType: 'album',
              album: {
                id: albumId || '',
                name: albumName,
                images: albumArt ? [{ url: albumArt }] : [],
                artists: artistName ? [{ name: artistName }] : [],
              }
            });
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Rate This Album</Text>
        </TouchableOpacity>
      </View>

      {/* Pluggable Content Section (Rating, Reviews, etc.) */}
      {children && (
        <View style={styles.pluggableSection}>
          {children}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  albumArt: {
    width: 240,
    height: 240,
    borderRadius: 8,
    marginBottom: 16,
  },
  albumName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  releaseYear: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  progressSection: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  completedBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'center',
    marginTop: 8,
  },
  playButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tracksSection: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  trackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  trackItemListened: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 6,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trackNumber: {
    fontSize: 14,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'center',
  },
  trackName: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: 12,
  },
  trackNameListened: {
    color: Colors.success,
    fontWeight: '500',
  },
  trackDuration: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  pluggableSection: {
    marginTop: 8,
  },
});

export default AlbumDetailScreen;
