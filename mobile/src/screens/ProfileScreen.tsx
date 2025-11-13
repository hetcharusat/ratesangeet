import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Appbar, Avatar, Text, useTheme } from 'react-native-paper';
import { getUserProfile, getUserStats, getUserReviews } from '../services/api';
import { useAuth } from '../context/AuthContext';
// Removed complex layout components in favor of simple MD3 cards
// import GridContainer from '../components/layout/GridContainer';
// import StatCard from '../components/ui/StatCard';
// import { Section } from '../components/layout';
// import RSCard from '../components/ui/RSCard';
import RSButton from '../components/ui/RSButton';
import RatingStars from '../components/ui/RatingStars';
import SkeletonLine from '../components/ui/SkeletonLine';

export default function ProfileV2Screen({ route, navigation }: any) {
  const { user: currentUser } = useAuth();
  const theme = useTheme();
  const userId = route?.params?.userId || currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const [profileData, statsData, reviewsData] = await Promise.all([
        getUserProfile(userId),
        getUserStats(userId),
        getUserReviews(userId),
      ]);
      setProfile(profileData);
      setStats(statsData);
      
      // Handle both array and wrapped response
      const reviewsArray = Array.isArray(reviewsData) 
        ? reviewsData 
        : (reviewsData?.data || reviewsData?.reviews || []);
      setReviews(reviewsArray.slice(0, 10));
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onRefresh = () => { setRefreshing(true); loadProfile(); };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Profile" />
        </Appbar.Header>
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonLine width="100%" height={120} style={{ borderRadius: 12 }} />
          <SkeletonLine width="100%" height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine width="100%" height={72} style={{ borderRadius: 12 }} />
          <SkeletonLine width="100%" height={72} style={{ borderRadius: 12 }} />
        </View>
      </View>
    );
  }

  const totalMinutes = stats?.totalMinutes || 0;
  const totalHours = Math.floor(totalMinutes / 60);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Appbar.Header>
        {!isOwnProfile && <Appbar.BackAction onPress={() => navigation.goBack()} />}
        <Appbar.Content title={isOwnProfile ? 'Your Profile' : profile?.displayName || 'Profile'} />
        {isOwnProfile && <Appbar.Action icon="cog" onPress={() => navigation.navigate('Settings')} />}
      </Appbar.Header>

      <View style={styles.header}>
        {profile?.profileImage ? (
          <Avatar.Image size={80} source={{ uri: profile.profileImage }} />
        ) : (
          <Avatar.Text size={80} label={(profile?.displayName || profile?.username || 'U').charAt(0).toUpperCase()} />
        )}
        <Text variant="headlineSmall" style={{ fontWeight: '600', marginTop: 12 }}>
          {profile?.displayName || 'User'}
        </Text>
        <Text variant="bodyMedium" style={{ opacity: 0.7 }}>@{profile?.username || 'username'}</Text>

        {profile?.bio && (
          <Text variant="bodyMedium" style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
            {profile.bio}
          </Text>
        )}

        <View style={styles.followRow}>
          <View style={styles.followItem}>
            <Text variant="labelLarge" style={{ fontWeight: '600' }}>{profile?.followersCount || 0}</Text>
            <Text variant="bodySmall" style={{ opacity: 0.7 }}>Followers</Text>
          </View>
          <View style={styles.followItem}>
            <Text variant="labelLarge" style={{ fontWeight: '600' }}>{profile?.followingCount || 0}</Text>
            <Text variant="bodySmall" style={{ opacity: 0.7 }}>Following</Text>
          </View>
          <View style={styles.followItem}>
            <Text variant="labelLarge" style={{ fontWeight: '600' }}>{reviews.length}</Text>
            <Text variant="bodySmall" style={{ opacity: 0.7 }}>Reviews</Text>
          </View>
        </View>

        {!isOwnProfile && (
          <RSButton mode="contained" style={{ marginTop: 16 }}>Follow</RSButton>
        )}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text variant="labelMedium" style={{ opacity: 0.7, marginBottom: 4 }}>Total Scrobbles</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700' }}>{(stats?.totalScrobbles || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="labelMedium" style={{ opacity: 0.7, marginBottom: 4 }}>Listening Time</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700' }}>{totalHours}h</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="labelMedium" style={{ opacity: 0.7, marginBottom: 4 }}>Unique Artists</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700' }}>{(stats?.uniqueArtistsCount || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="labelMedium" style={{ opacity: 0.7, marginBottom: 4 }}>Avg Rating</Text>
            <Text variant="displaySmall" style={{ fontWeight: '700' }}>{(stats?.averageRating || 0).toFixed(1)}</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {reviews.length > 0 ? (
          <>
            <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>Recent Reviews</Text>
            <View style={{ gap: 8 }}>
              {reviews.map((review) => (
                <View key={review._id} style={styles.reviewCard}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" numberOfLines={1} style={{ fontWeight: '600' }}>{review.itemName}</Text>
                    <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.7, marginTop: 2 }}>{review.artistName}</Text>
                    {review.reviewText ? (
                      <Text variant="bodyMedium" numberOfLines={3} style={{ marginTop: 8 }}>{review.reviewText}</Text>
                    ) : null}
                  </View>
                  <RatingStars value={review.rating} readOnly size={16} />
                </View>
              ))}
            </View>
            <RSButton mode="outlined" style={{ marginTop: 12 }} onPress={() => {}}>View All Reviews</RSButton>
          </>
        ) : (
          <View style={styles.empty}> 
            <Text variant="displaySmall" style={{ fontSize: 48, marginBottom: 8 }}>📝</Text>
            <Text variant="titleLarge" style={{ fontWeight: '600', marginBottom: 8 }}>No reviews yet</Text>
            <Text variant="bodyMedium" style={{ opacity: 0.6, textAlign: 'center' }}>Rate an album to see it here.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', padding: 24 },
  followRow: { flexDirection: 'row', marginTop: 16, gap: 32 },
  followItem: { alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12 },
  reviewCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 },
});
