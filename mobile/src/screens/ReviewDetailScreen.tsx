
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { getReviewDetails } from '../services/api';
import Colors from '../theme/colors';

type RouteParams = { reviewId: string };

const ReviewDetailScreen = () => {
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const { reviewId } = route.params;

  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const reviewDetails = await getReviewDetails(reviewId);
        setReview(reviewDetails);
      } catch (err) {
        setError('Failed to load review.');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [reviewId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
      </SafeAreaView>
    );
  }

  if (error || !review) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error || 'Review not found.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Image source={{ uri: review.albumArt }} style={styles.albumArt} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{review.itemName}</Text>
            <Text style={styles.artist}>{review.artistName}</Text>
            <Text style={styles.rating}>{'⭐'.repeat(review.rating)}</Text>
          </View>
        </View>

        <View style={styles.reviewBody}>
          <View style={styles.userInfo}>
            <Image source={{ uri: review.user.profileImage }} style={styles.profileImage} />
            <Text style={styles.username}>{review.user.displayName}</Text>
          </View>
          <Text style={styles.reviewText}>{review.reviewText}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  albumArt: {
    width: 100,
    height: 100,
    marginRight: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  artist: {
    color: '#999',
    fontSize: 16,
    marginTop: 5,
  },
  rating: {
    fontSize: 20,
    marginTop: 10,
  },
  reviewBody: {
    padding: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ReviewDetailScreen;
