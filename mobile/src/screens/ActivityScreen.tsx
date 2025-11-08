import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFriendsFeed, getPublicReviews, reactToReview, Review } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import Colors from '../theme/colors';

const ActivityScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showingPublic, setShowingPublic] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!user?.id) {
      // Not logged in - show public reviews
      try {
        const publicData = await getPublicReviews(50, 0);
        setReviews(publicData || []);
        setShowingPublic(true);
      } catch (error) {
        console.error('Error loading public reviews:', error);
        setReviews([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    
    try {
      // Try to load friends feed first
      const friendsData = await getFriendsFeed(user.id, 50, 0);
      if (friendsData && friendsData.length > 0) {
        setReviews(friendsData);
        setShowingPublic(false);
      } else {
        // No friends activity - fall back to public reviews
        const publicData = await getPublicReviews(50, 0);
        setReviews(publicData || []);
        setShowingPublic(true);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setReviews([]);
      setShowingPublic(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const renderReview = ({ item }: { item: Review }) => {
    const u = typeof item.userId === 'string' ? undefined : item.userId;
    const name = u?.displayName || 'Anonymous';
    const initial = name ? name[0]?.toUpperCase() : '?';
    const profileUri = u?.profileImage;
    return (
      <View style={styles.reviewCard}>
        <View style={styles.header}>
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.date}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {item.albumArt && (
            <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
          )}
          <View style={styles.reviewInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.itemName || 'Unknown'}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {item.artistName || 'Unknown Artist'}
            </Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.rating}>⭐ {item.rating || 0}/5</Text>
            </View>
          </View>
        </View>

        {item.reviewText ? (
          <Text style={styles.reviewText} numberOfLines={3}>{item.reviewText}</Text>
        ) : null}

        {/* Reactions bar */}
        <View style={styles.reactionsRow}>
          {(
            [
              { key: 'like', emoji: '👍' },
              { key: 'love', emoji: '❤️' },
              { key: 'fire', emoji: '🔥' },
              { key: 'sad', emoji: '😢' },
            ] as const
          ).map(({ key, emoji }) => {
            const count = item.reactionsCount?.[key] || 0;
            const active = item.userReaction === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.reactChip, active && styles.reactChipActive]}
                disabled={!user?.id}
                onPress={async () => {
                  if (!user?.id) return;
                  try {
                    const nextType = active ? null : key;
                    const res = await reactToReview(item._id, user.id, nextType);
                    setReviews((prev) =>
                      prev.map((r) =>
                        r._id === item._id
                          ? {
                              ...r,
                              reactionsCount: res.reactionsCount,
                              userReaction: res.userReaction,
                              likes: res.likes,
                            }
                          : r
                      )
                    );
                  } catch (e) {
                    console.error('Reaction failed', e);
                  }
                }}
              >
                <Text style={styles.reactEmoji}>{emoji}</Text>
                <Text style={styles.reactCount}>{count}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Quick Review button */}
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => {
              const payload =
                item.itemType === 'track'
                  ? {
                      itemType: 'track' as const,
                      track: {
                        id: item.spotifyId,
                        name: item.itemName,
                        artists: [{ name: item.artistName }],
                        album: { name: '', images: item.albumArt ? [{ url: item.albumArt }] : [] },
                      },
                    }
                  : {
                      itemType: 'album' as const,
                      album: {
                        id: item.spotifyId,
                        name: item.itemName,
                        images: item.albumArt ? [{ url: item.albumArt }] : [],
                        artists: [{ name: item.artistName }],
                      },
                    };
              navigation.navigate('AddReview', payload);
            }}
          >
            <Text style={styles.reviewBtnText}>Review it</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const Empty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No reviews yet</Text>
      <Text style={styles.emptySubtext}>
        {user?.id 
          ? 'Follow people from the Search tab to see their reviews' 
          : 'Sign in to see personalized activity'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>
            {!user?.id 
              ? 'Public reviews from the community' 
              : showingPublic 
                ? 'Discover new music from the community' 
                : 'Recent reviews from people you follow'}
          </Text>
        </View>
      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={!loading ? <Empty /> : null}
      />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  headerBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors.surface },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 5 },
  listContainer: { padding: 15 },
  reviewCard: { backgroundColor: Colors.surface, borderRadius: 10, padding: 15, marginBottom: 15 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  avatarPlaceholder: { backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  date: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  content: { flexDirection: 'row', marginBottom: 10 },
  albumArt: { width: 80, height: 80, borderRadius: 5, marginRight: 15 },
  reviewInfo: { flex: 1, justifyContent: 'center' },
  itemName: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 5 },
  artistName: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  ratingContainer: { flexDirection: 'row' },
  rating: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  reviewText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginTop: 10 },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  reactChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.placeholder, marginRight: 8, marginTop: 6 },
  reactChipActive: { backgroundColor: Colors.primaryAlpha, borderWidth: 1, borderColor: Colors.primary },
  reactEmoji: { fontSize: 16, marginRight: 6 },
  reactCount: { color: Colors.textSecondary, fontSize: 12 },
  reviewBtn: { marginLeft: 'auto', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginTop: 6 },
  reviewBtnText: { color: Colors.black, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, color: Colors.textPrimary, marginBottom: 10 },
  emptySubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});

export default ActivityScreen;
