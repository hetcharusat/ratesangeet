import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { getPublicReviews, Review } from '../services/api';
import { useNavigation } from '@react-navigation/native';

const ExploreScreen = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const data = await getPublicReviews(50, 0);
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading public reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const renderReview = ({ item }: { item: Review }) => {
    const user = typeof item.userId === 'string' ? undefined : item.userId;
    const displayName = user?.displayName || 'Anonymous';
    const initial = displayName ? displayName[0]?.toUpperCase() : '?';
    const profileUri = user?.profileImage;

    return (
      <View style={styles.reviewCard}>
        <View style={styles.header}>
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initial || '?'}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
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
            {item.itemName || 'Unknown Track'}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.artistName || 'Unknown Artist'}
          </Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {item.rating || 0}/10</Text>
          </View>
        </View>
      </View>

        {item.reviewText && (
          <Text style={styles.reviewText} numberOfLines={3}>
            {item.reviewText}
          </Text>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.likeButton}>
            <Text style={styles.likeText}>❤️ {item.likes || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Discover what others are listening to</Text>
      </View>

      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to share your music taste!
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  headerBar: {
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    marginTop: 5,
  },
  listContainer: {
    padding: 15,
  },
  reviewCard: {
    backgroundColor: '#282828',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  date: {
    fontSize: 12,
    color: '#B3B3B3',
    marginTop: 2,
  },
  content: {
    flexDirection: 'row',
    marginBottom: 10,
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
  },
  artistName: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  rating: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '600',
  },
  reviewText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeText: {
    fontSize: 14,
    color: '#B3B3B3',
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
});

export default ExploreScreen;
