import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { createReview, getAlbumDetails, Track } from '../services/api';
import Colors from '../theme/colors';
import StarRating from 'react-native-star-rating-widget';

interface AddReviewScreenProps {
  route: any;
  navigation: any;
}

interface SpotifyImage {
  url: string;
}

interface AlbumSummary {
  id: string;
  name: string;
  images?: SpotifyImage[];
  artists?: { name: string; id?: string }[];
}

interface AlbumTrack {
  id: string;
  name: string;
  artists?: { name: string; id?: string }[];
  album?: {
    name: string;
    images?: SpotifyImage[];
  };
  duration_ms?: number;
  track_number?: number;
}

interface AlbumDetails extends AlbumSummary {
  tracks?: {
    items?: AlbumTrack[];
  };
}

type RouteParams =
  | { itemType: 'track'; track: Track }
  | { itemType: 'album'; album: AlbumSummary };

const AddReviewScreen = ({ route, navigation }: AddReviewScreenProps) => {
  const params = route.params as RouteParams;
  const itemType = params.itemType;
  const trackParam = itemType === 'track' ? params.track : null;
  const albumParam = itemType === 'album' ? params.album : null;
  const { user, accessToken } = useAuth();

  const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
  const [albumLoading, setAlbumLoading] = useState(itemType === 'album');
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isPublic, setIsPublic] = useState(true); // Public by default (like Letterboxd)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (itemType !== 'album' || !accessToken || !albumParam?.id) {
      return;
    }

    const fetchAlbumDetails = async () => {
      try {
        setAlbumLoading(true);
        setAlbumError(null);
        const details = await getAlbumDetails(accessToken, albumParam.id);
        setAlbumDetails(details);
      } catch (error) {
        console.error('Error fetching album details:', error);
        setAlbumError('Unable to load album details.');
      } finally {
        setAlbumLoading(false);
      }
    };

    fetchAlbumDetails();
  }, [accessToken, itemType, albumParam?.id]);

  useEffect(() => {
    setRating(0);
    setReviewText('');
  }, [itemType, trackParam?.id, albumParam?.id]);

  const albumSource = albumDetails ?? albumParam ?? null;

  const extractArtistNames = (artists?: { name: string }[]) =>
    artists?.map((artist) => artist.name).join(', ') ?? '';

  const coverArt = itemType === 'track'
    ? trackParam?.album?.images?.[0]?.url ?? ''
    : albumSource?.images?.[0]?.url ?? '';

  const primaryTitle = itemType === 'track'
    ? trackParam?.name ?? ''
    : albumSource?.name ?? '';

  const primarySubtitle = itemType === 'track'
    ? extractArtistNames(trackParam?.artists)
    : extractArtistNames(albumSource?.artists);

  const secondaryLine = itemType === 'track'
    ? trackParam?.album?.name ?? ''
    : undefined;

  // Derived credits for album: primary artists + featured contributors (from track artists)
  const primaryArtists: Array<{ name: string; id?: string }> = (itemType === 'album'
    ? (albumSource?.artists ?? []).map((a) => ({ name: a.name, id: a.id }))
    : []);

  const featuredArtists: Array<{ name: string; count: number; id?: string }> = (() => {
    if (itemType !== 'album') return [];
    const counts: Record<string, { count: number; id?: string }> = {};
    const tracks = albumDetails?.tracks?.items ?? [];
    const primaryNames = primaryArtists.map(a => a.name);
    for (const t of tracks) {
      for (const a of (t.artists ?? [])) {
        const name = a.name;
        if (!primaryNames.includes(name)) {
          if (!counts[name]) {
            counts[name] = { count: 0, id: a.id };
          }
          counts[name].count += 1;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([name, { count, id }]) => ({ name, count, id }));
  })();

  const handleOpenDiscovery = (name: string, artistId?: string) => {
    // Navigate to Artist profile screen with ID if available, fallback to name query
    navigation.navigate('Artist', artistId ? { artistId, q: name } : { q: name });
  };

  const handleSave = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before saving.');
      return;
    }

    if (itemType === 'track') {
      if (!trackParam) {
        Alert.alert('Missing Data', 'Track details are missing.');
        return;
      }

      try {
        setSaving(true);
        await createReview({
          userId: user?.id,
          itemType: 'track',
          spotifyId: trackParam.id,
          itemName: trackParam.name,
          artistName: extractArtistNames(trackParam.artists),
          albumArt: trackParam.album?.images?.[0]?.url,
          rating,
          reviewText: reviewText.trim() || undefined,
          isPublic,
        });

        Alert.alert('Success', 'Review saved successfully!');
        navigation.goBack();
      } catch (error) {
        console.error('Error saving review:', error);
        Alert.alert('Error', 'Failed to save review. Please try again.');
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!albumSource) {
      Alert.alert('Album Not Ready', 'Album details are still loading.');
      return;
    }

    try {
      setSaving(true);
      await createReview({
        userId: user?.id,
        itemType: 'album',
        spotifyId: albumSource.id,
        itemName: albumSource.name,
        artistName: extractArtistNames(albumSource.artists),
        albumArt: albumSource.images?.[0]?.url,
        rating,
        reviewText: reviewText.trim() || undefined,
        isPublic,
      });

      Alert.alert('Success', 'Review saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving review:', error);
      Alert.alert('Error', 'Failed to save review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toTrackPayload = (trackItem: AlbumTrack): Track => ({
    id: trackItem.id,
    name: trackItem.name,
    artists: (trackItem.artists ?? []).map((artist) => ({ name: artist.name })),
    album: {
      name: albumSource?.name ?? '',
      images: albumSource?.images ?? [],
    },
    duration_ms: trackItem.duration_ms,
  });

  const handleRateTrack = (trackItem: AlbumTrack) => {
    if (!albumSource) {
      return;
    }

    navigation.push('AddReview', {
      itemType: 'track',
      track: toTrackPayload(trackItem),
    });
  };

  const renderStars = () => {
    return (
      <StarRating
        rating={rating}
        onChange={setRating}
        starSize={48}
        color={Colors.primary}
        starStyle={{ marginHorizontal: 2 }}
        enableHalfStar={true}
        enableSwiping={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Image source={{ uri: coverArt }} style={styles.albumArt} />
          <Text style={styles.title} numberOfLines={2}>{primaryTitle}</Text>
          {!!primarySubtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{primarySubtitle}</Text>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.ratingSection}>
            {renderStars()}
          </View>

          <TextInput
            style={styles.reviewInput}
            placeholder="Add a review..."
            placeholderTextColor="#999"
            value={reviewText}
            onChangeText={setReviewText}
            multiline
          />

          <TouchableOpacity
            style={[styles.saveBtn, (saving || rating === 0) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || rating === 0}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {rating === 0 ? 'Rate to submit' : 'Submit'}
              </Text>
            )}
          </TouchableOpacity>
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
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  albumArt: {
    width: 150,
    height: 150,
    marginBottom: 15,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  reviewInput: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddReviewScreen;
