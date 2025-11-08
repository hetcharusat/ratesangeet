import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThreadedReviewCard } from '../components/ThreadedReviewCard';
import { useAuth } from '../context/AuthContext';
import {
  getPublicReviews,
  getReviewComments,
  reactToReview,
  addReviewComment,
  Comment,
  Review,
} from '../services/api';
import Colors from '../theme/colors';

const ReviewFeedScreen = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      // Fetch all public reviews (Letterboxd-style feed)
      const data = await getPublicReviews(50, 0);
      setReviews(data);
      console.log('[ReviewFeed] Loaded', data.length, 'public reviews');
    } catch (error) {
      console.error('Failed to load public reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
  };

  const loadComments = async (reviewId: string) => {
    try {
      const comments = await getReviewComments(reviewId);
      setCommentsMap(prev => ({ ...prev, [reviewId]: comments }));
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleReact = async (reviewId: string, reactionType: string) => {
    try {
      if (!user?.id) return;
      const updatedReview = await reactToReview(reviewId, user.id, reactionType);
      
      // Update review in list
      setReviews(prev =>
        prev.map(r => (r._id === reviewId ? { ...r, ...updatedReview } : r))
      );
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  const handleComment = async (reviewId: string, text: string, parentId?: string) => {
    try {
      if (!user?.id) return;
      await addReviewComment(reviewId, user.id, text, parentId);
      
      // Reload comments to show new one
      await loadComments(reviewId);
    } catch (error) {
      console.error('Failed to comment:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (reviews.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No public reviews yet</Text>
          <Text style={styles.emptySubtext}>Be the first to share your music taste!</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ThreadedReviewCard
            review={item}
            currentUserId={user?.id}
            comments={commentsMap[item._id] || []}
            onReact={handleReact}
            onComment={handleComment}
            onLoadComments={loadComments}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});

export default ReviewFeedScreen;
