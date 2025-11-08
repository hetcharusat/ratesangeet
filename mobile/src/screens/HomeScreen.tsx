import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl, ScrollView, Dimensions, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getUserReviews, getUserStats, getListeningStats, Review, ListeningStats } from '../services/api';
import { useScrobble } from '../context/ScrobbleContext';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import type { StackNavigationProp } from '@react-navigation/stack';
import { retryWithBackoff } from '../utils/async';
import Colors from '../theme/colors';

type RootStackParamList = {
  MainTabs: undefined;
  AddReview: { track?: any; album?: any };
  ReviewDetail: { review: Review };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Skeleton loading component
const SkeletonBox = () => {
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.skeletonBox, { opacity }]} />
  );
};

const HomeScreen = () => {
  const { user, logout, accessToken } = useAuth();
  const { currentTrack, lastScrobble, isPolling } = useScrobble();
  const navigation = useNavigation<NavigationProp>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ totalReviews: 0 });
  const [listeningStats, setListeningStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[HomeScreen] Starting to load data for user:', user?.id);
      if (user?.id) {
        // Add timeout wrapper for each call (10 seconds max)
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
          ]);
        };

        console.log('[HomeScreen] Fetching all data...');
        const [reviewsData, statsData, listeningStatsData] = await Promise.all([
          withTimeout(retryWithBackoff(() => getUserReviews(user.id))),
          withTimeout(retryWithBackoff(() => getUserStats(user.id))),
          withTimeout(retryWithBackoff(() => getListeningStats(user.id, accessToken || undefined))).catch(err => {
            console.error('[HomeScreen] Listening stats failed:', err);
            return null;
          }),
        ]);
        
        console.log('[HomeScreen] Data fetched:', {
          reviews: reviewsData?.length || 0,
          stats: statsData,
          listeningStats: listeningStatsData
        });
        
        setReviews(reviewsData || []);
        setStats({ totalReviews: statsData?.totalReviews || 0 });
        setListeningStats(listeningStatsData || null);
        console.log('[HomeScreen] Data set successfully, loading=false');
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error);
      // Set default values on error
      setReviews([]);
      setStats({ totalReviews: 0 });
      setListeningStats(null);
    } finally {
      console.log('[HomeScreen] Setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRateNowPlaying = () => {
    const track = currentTrack ?? (lastScrobble ? {
      id: lastScrobble.spotifyId,
      name: lastScrobble.trackName,
      artists: lastScrobble.artistName.split(', ').map((name) => ({ name })),
      album: {
        name: lastScrobble.albumName ?? '',
        images: lastScrobble.albumArt ? [{ url: lastScrobble.albumArt }] : [],
      },
    } : null);

    if (track) {
      (navigation as any).navigate('AddReview', { itemType: 'track', track });
    }
  };

  const renderReview = ({ item }: { item: Review }) => (
    <TouchableOpacity 
      style={styles.reviewCard}
      onPress={() => navigation.navigate('ReviewDetail', { review: item })}
    >
      {item.albumArt && (
        <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
      )}
      <View style={styles.reviewInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.itemName || 'Unknown Track'}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artistName || 'Unknown Artist'}
        </Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>⭐ {item.rating || 0}/5</Text>
          <Text style={styles.date}>
            {item.listeningDate ? new Date(item.listeningDate).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
        {item.reviewText && (
          <Text style={styles.reviewText} numberOfLines={2}>
            {item.reviewText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <ScrollView style={styles.container} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
      }>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards with Skeleton Loading */}
      {loading ? (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardLeft]}>
            <View style={[styles.skeletonBox, { height: 40, width: 60 }]} />
            <View style={[styles.skeletonTextContainer, { height: 16, width: 70 }]} />
          </View>
          <View style={[styles.statCard, styles.statCardRight]}>
            <View style={[styles.skeletonBox, { height: 40, width: 60 }]} />
            <View style={[styles.skeletonTextContainer, { height: 16, width: 70 }]} />
          </View>
          <View style={[styles.statCard, styles.statCardLeft]}>
            <View style={[styles.skeletonBox, { height: 40, width: 60 }]} />
            <View style={[styles.skeletonTextContainer, { height: 16, width: 70 }]} />
          </View>
          <View style={[styles.statCard, styles.statCardRight]}>
            <View style={[styles.skeletonBox, { height: 40, width: 60 }]} />
            <View style={[styles.skeletonTextContainer, { height: 16, width: 70 }]} />
          </View>
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardLeft]}>
            <Text style={styles.statValue}>{stats.totalReviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          {listeningStats && (
            <>
              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statValue}>{listeningStats.totalMinutes}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={[styles.statCard, styles.statCardLeft]}>
                <Text style={styles.statValue}>{listeningStats.totalScrobbles}</Text>
                <Text style={styles.statLabel}>Tracks</Text>
              </View>
              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statValue}>
                  {listeningStats.uniqueArtistsCount || listeningStats.topArtists?.length || 0}
                </Text>
                <Text style={styles.statLabel}>Artists</Text>
              </View>
            </>
          )}
        </View>
      )}

      {(currentTrack || lastScrobble) && (
        <View style={styles.nowPlayingCard}>
          <View style={styles.nowPlayingHeader}>
            <Text style={styles.nowPlayingTitle}>{currentTrack ? 'Now Playing' : 'Last Scrobble'}</Text>
            {isPolling && <Text style={styles.scrobbleStatus}>Scrobbling…</Text>}
          </View>
          <View style={styles.nowPlayingContent}>
            {((currentTrack && currentTrack.album?.images?.[0]?.url) || lastScrobble?.albumArt) && (
              <Image
                source={{ uri: currentTrack?.album?.images?.[0]?.url ?? lastScrobble?.albumArt ?? '' }}
                style={styles.nowPlayingArt}
              />
            )}
            <View style={styles.nowPlayingInfo}>
              <Text style={styles.nowPlayingName} numberOfLines={1}>
                {currentTrack?.name ?? lastScrobble?.trackName ?? 'Unknown Track'}
              </Text>
              <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                {currentTrack
                  ? currentTrack.artists.map((a) => a.name).join(', ')
                  : lastScrobble?.artistName ?? 'Unknown Artist'}
              </Text>
              {lastScrobble && !currentTrack && (
                <Text style={styles.scrobbleTime}>
                  {new Date(lastScrobble.playedAt).toLocaleString()}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.rateButton} onPress={handleRateNowPlaying}>
              <Text style={styles.rateButtonText}>Rate</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {listeningStats && listeningStats.topAlbums.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} numberOfLines={1}>Top Albums</Text>
          <BarChart
            data={{
              labels: listeningStats.topAlbums.map((album) => 
                album.name.length > 15 ? album.name.substring(0, 15) + '...' : album.name
              ),
              datasets: [{
                data: listeningStats.topAlbums.map((album) => album.count),
              }],
            }}
            width={Dimensions.get('window').width - 40}
            height={220}
            yAxisLabel=""
            yAxisSuffix=" plays"
            chartConfig={{
              backgroundColor: '#1F1F1F',
              backgroundGradientFrom: '#1F1F1F',
              backgroundGradientTo: '#282828',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(29, 185, 84, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForLabels: {
                fontSize: 10,
              },
            }}
            style={styles.chart}
            fromZero
            showBarTops={false}
            showValuesOnTopOfBars
          />
          <View style={styles.albumsList}>
            {listeningStats.topAlbums.map((album, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.albumItem}
                onPress={() => {
                  // Navigate to search or open in Spotify if we had album ID
                }}
                activeOpacity={0.7}
              >
                {album.albumArt && (
                  <Image source={{ uri: album.albumArt }} style={styles.albumItemArt} />
                )}
                <View style={styles.albumItemInfo}>
                  <Text style={styles.albumItemName} numberOfLines={1}>
                    {album.name}
                  </Text>
                  <Text style={styles.albumItemArtist} numberOfLines={1}>
                    {album.artist}
                  </Text>
                  <Text style={styles.albumItemMeta} numberOfLines={1}>
                    {album.count} scrobbles
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {listeningStats && listeningStats.topArtists && listeningStats.topArtists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} numberOfLines={1}>Top Artists</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {(listeningStats.topArtists || []).map((a, idx) => (
              <View key={idx} style={[styles.artistPill, { backgroundColor: ['#1DB954','#FF6B6B','#4ECDC4','#FFD93D','#A78BFA'][idx] || '#1DB954' }]}>
                <Text style={styles.artistEmoji}>🎤</Text>
                <Text style={styles.artistNameText} numberOfLines={1}>{a.artist}</Text>
                <Text style={styles.artistCount}>{a.count}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {listeningStats && listeningStats.topGenres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} numberOfLines={1}>Top Genres</Text>
          <View style={styles.genreTagsContainer}>
            {listeningStats.topGenres.slice(0, 5).map((genre, index) => (
              <View 
                key={index} 
                style={[styles.genreTag, { 
                  backgroundColor: ['#1DB954', '#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA'][index] || '#1DB954' 
                }]}
              >
                <Text style={styles.genreTagText}>{genre.genre}</Text>
                <Text style={styles.genreTagCount}>{genre.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} numberOfLines={1}>Your Reviews</Text>
      </View>

      <FlatList
        data={reviews}
        renderItem={renderReview}
        scrollEnabled={false}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>
              Start tracking your music by adding reviews
            </Text>
          </View>
        }
      />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    width: '48%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardLeft: {
    marginRight: '4%',
  },
  statCardRight: {
    marginRight: 0,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  skeletonBox: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.skeleton,
    borderRadius: 12,
  },
  skeletonTextContainer: {
    width: '100%',
    height: 20,
    backgroundColor: Colors.skeleton,
    borderRadius: 6,
    marginTop: 8,
  },
  sectionHeader: {
    padding: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 1,
    flexWrap: 'nowrap',
    includeFontPadding: false,
  },
  nowPlayingCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 16,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nowPlayingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrobbleStatus: {
    color: '#1DB954',
    fontSize: 12,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowPlayingArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 14,
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  nowPlayingArtist: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  scrobbleTime: {
    marginTop: 6,
    color: '#808080',
    fontSize: 12,
  },
  rateButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  scrobbleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  scrobbleArt: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  scrobbleInfo: {
    flex: 1,
  },
  scrobbleTrack: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  scrobbleArtist: {
    color: '#B3B3B3',
    fontSize: 13,
    marginBottom: 3,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  reviewCard: {
    flexDirection: 'row',
    backgroundColor: '#282828',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 5,
    marginRight: 15,
  },
  reviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
    flexShrink: 1,
  },
  artistName: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 8,
    flexShrink: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  rating: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#B3B3B3',
  },
  reviewText: {
    fontSize: 13,
    color: '#B3B3B3',
    marginTop: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
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
  chart: {
    marginVertical: 10,
    borderRadius: 16,
  },
  genreTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  genreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  genreTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  genreTagCount: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  albumsList: {
    marginTop: 10,
  },
  artistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    maxWidth: 220,
  },
  artistEmoji: { fontSize: 16, marginRight: 6 },
  artistNameText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  artistCount: { color: '#FFFFFF', fontSize: 12, marginLeft: 8, opacity: 0.9 },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  albumItemArt: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  albumItemInfo: {
    flex: 1,
  },
  albumItemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  albumItemArtist: {
    color: '#B3B3B3',
    fontSize: 13,
    marginBottom: 3,
  },
  albumItemMeta: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  albumItemCount: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
