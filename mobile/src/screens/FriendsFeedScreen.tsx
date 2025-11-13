import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { getFriendsFeed } from '../services/api';
import { useAuth } from '../context/AuthContext';
// Keep implementation simple and native-styled
// import { FriendReviewCard } from '../components/ui';
// import CommentThread from '../components/layout/CommentThread';
import SkeletonLine from '../components/ui/SkeletonLine';

export default function FriendsFeedScreen({ navigation }: any) {
  const { user, accessToken } = useAuth();
  const theme = useTheme();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getFriendsFeed(user.id, 50, 0);
      setFeed(data);
    } catch (err) {
      console.error('Failed to load feed:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const onRefresh = () => { setRefreshing(true); loadFeed(); };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text variant="titleSmall" numberOfLines={1} style={{ fontWeight: '600' }}>
          {item.userId?.displayName || item.username || 'Anonymous'}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.7, marginTop: 2 }}>
          {item.itemName}
        </Text>
        {item.reviewText ? (
          <Text variant="bodyMedium" numberOfLines={3} style={{ marginTop: 8 }}>
            {item.reviewText}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        <Text variant="titleLarge" style={{ fontWeight: '700' }}>{item.rating?.toFixed?.(1) || item.rating || '-'}</Text>
        <Text variant="labelSmall" style={{ opacity: 0.6 }}>rating</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.Content title="Friends Feed" />
        </Appbar.Header>
        <View style={{ padding: 16 }}>
          {[...Array(3)].map((_, i) => (
            <View key={i} style={{ marginBottom: 16 }}>
              <SkeletonLine width="100%" height={200} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.Content title="Friends Feed" />
      </Appbar.Header>

      {feed.length === 0 && (
        <View style={styles.empty}>
          <Text variant="bodyLarge" style={{ opacity: 0.6, textAlign: 'center', paddingHorizontal: 32 }}>
            No activity yet. Follow friends to see their reviews!
          </Text>
        </View>
      )}

      <FlatList
        data={feed}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    minHeight: 48,
  },
});
