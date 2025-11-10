import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getUserReviews, getUserStats, getListeningStats, Review, ListeningStats } from '../services/api';
import { useScrobble } from '../context/ScrobbleContext';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import type { StackNavigationProp } from '@react-navigation/stack';
import { retryWithBackoff } from '../utils/async';
import {
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Text,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';

type RootStackParamList = {
  MainTabs: undefined;
  AddReview: { track?: any; album?: any };
  ReviewDetail: { review: Review };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const { user, logout, accessToken } = useAuth();
  const { currentTrack, lastScrobble, isPolling } = useScrobble();
  const navigation = useNavigation<NavigationProp>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ totalReviews: 0 });
  const [listeningStats, setListeningStats] = useState<ListeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (opts?: { force?: boolean }) => {
    try {
      if (user?.id) {
        const [reviewsData, statsData, listeningStatsData] = await Promise.all([
          retryWithBackoff(() => getUserReviews(user.id)),
          retryWithBackoff(() => getUserStats(user.id)),
          retryWithBackoff(() => getListeningStats(user.id, accessToken || undefined, { force: opts?.force })).catch(() => null),
        ]);
        
        setReviews(reviewsData || []);
        setStats({ totalReviews: statsData?.totalReviews || 0 });
        setListeningStats(listeningStatsData || null);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData({ force: true });
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
    <List.Item
      title={item.itemName || 'Unknown Track'}
      description={item.artistName || 'Unknown Artist'}
      left={props => <Avatar.Image {...props} source={{ uri: item.albumArt }} />}
      right={() => <Text>⭐ {item.rating || 0}/5</Text>}
      onPress={() => navigation.navigate('ReviewDetail', { review: item })}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <List.Item
          title={`Welcome back, ${user?.displayName || 'User'}`}
          titleStyle={{ fontWeight: 'bold' }}
          right={() => <Button onPress={logout}>Logout</Button>}
        />

        {loading ? (
          <ActivityIndicator animating={true} style={{ marginTop: 16 }} />
        ) : (
          <View style={styles.statsContainer}>
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="headlineMedium">{stats.totalReviews || 0}</Text>
                <Text>Reviews</Text>
              </Card.Content>
            </Card>
            {listeningStats && (
              <>
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium">{listeningStats.totalMinutes}</Text>
                    <Text>Minutes</Text>
                  </Card.Content>
                </Card>
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium">{listeningStats.totalScrobbles}</Text>
                    <Text>Tracks</Text>
                  </Card.Content>
                </Card>
                <Card style={styles.statCard}>
                  <Card.Content>
                    <Text variant="headlineMedium">{listeningStats.uniqueArtistsCount || listeningStats.topArtists?.length || 0}</Text>
                    <Text>Artists</Text>
                  </Card.Content>
                </Card>
              </>
            )}
          </View>
        )}

        {(currentTrack || lastScrobble) && (
          <Card style={{ margin: 16 }}>
            <Card.Title
              title={currentTrack ? 'Now Playing' : 'Last Scrobble'}
              right={() => isPolling && <ActivityIndicator animating={true} />}
            />
            <Card.Content>
              <List.Item
                title={currentTrack?.name ?? lastScrobble?.trackName ?? 'Unknown Track'}
                description={currentTrack ? currentTrack.artists.map((a) => a.name).join(', ') : lastScrobble?.artistName ?? 'Unknown Artist'}
                left={props => <Avatar.Image {...props} source={{ uri: currentTrack?.album?.images?.[0]?.url ?? lastScrobble?.albumArt ?? '' }} />}
                right={() => <Button onPress={handleRateNowPlaying}>Rate</Button>}
              />
            </Card.Content>
          </Card>
        )}

        {/* Charts and other sections would be refactored similarly */}

        <List.Section title="Your Reviews">
          {reviews.length === 0 && !loading ? (
            <Text style={{ textAlign: 'center', margin: 16 }}>No reviews yet</Text>
          ) : (
            <FlatList
              data={reviews}
              renderItem={renderReview}
              scrollEnabled={false}
              keyExtractor={(item) => item._id}
            />
          )}
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 8,
  },
  statCard: {
    width: '48%',
    marginBottom: 8,
  },
});

export default HomeScreen;
