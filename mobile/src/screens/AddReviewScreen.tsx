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
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Album art header */}
        <View style={styles.header}>
          <Image source={{ uri: coverArt }} style={styles.albumArt} blurRadius={40} />
          <View style={styles.headerOverlay} />
          <Image source={{ uri: coverArt }} style={styles.albumArtFront} />
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>{primaryTitle}</Text>
          {!!primarySubtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{primarySubtitle}</Text>
          )}
          {!!secondaryLine && (
            <Text style={styles.tertiaryText} numberOfLines={1}>{secondaryLine}</Text>
          )}

          {/* Rating section - Letterboxd style */}
          <View style={styles.ratingCard}>
            <Text style={styles.ratingLabel}>RATED</Text>
            {renderStars()}
            {rating > 0 && (
              <Text style={styles.ratingText}>{rating.toFixed(1)} / 5.0</Text>
            )}
          </View>

          {/* Credits section (album only) */}
          {itemType === 'album' && (
            <View style={styles.creditsSection}>
              <Text style={styles.creditsTitle}>CREDITS</Text>

              {/* Primary Artists */}
              {primaryArtists.length > 0 && (
                <View style={styles.creditsBlock}>
                  <Text style={styles.creditsLabel}>Artists</Text>
                  <View style={styles.creditsChips}>
                    {primaryArtists.map((artist) => (
                      <TouchableOpacity
                        key={`artist-${artist.name}`}
                        style={styles.chip}
                        onPress={() => handleOpenDiscovery(artist.name, artist.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipText}>{artist.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Featured (from track artists not in album artists) */}
              {featuredArtists.length > 0 && (
                <View style={styles.creditsBlock}>
                  <Text style={styles.creditsLabel}>Featured</Text>
                  <View style={styles.creditsChips}>
                    {featuredArtists.map((artist) => (
                      <TouchableOpacity
                        key={`feat-${artist.name}`}
                        style={styles.chip}
                        onPress={() => handleOpenDiscovery(artist.name, artist.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipText}>{artist.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Note on composers */}
              <Text style={styles.creditsNote}>
                Composer credits aren’t exposed by the Spotify API. We list primary and featured artists based on album and track credits.
              </Text>
            </View>
          )}

          {/* Review text */}
          <View style={styles.reviewInputSection}>
            <TextInput
              style={styles.reviewInput}
              placeholder={`Write your review... What did you think about this ${itemType}?`}
              placeholderTextColor={Colors.textTertiary}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Privacy toggle - minimal style */}
          <View style={styles.privacyRow}>
            <TouchableOpacity
              style={[styles.privacyBtn, isPublic && styles.privacyBtnActive]}
              onPress={() => setIsPublic(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.privacyBtnText, isPublic && styles.privacyBtnTextActive]}>
                🌍 Public
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.privacyBtn, !isPublic && styles.privacyBtnActive]}
              onPress={() => setIsPublic(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.privacyBtnText, !isPublic && styles.privacyBtnTextActive]}>
                🔒 Private
              </Text>
            </TouchableOpacity>
          </View>

          {/* Album tracks (if rating an album) */}
          {itemType === 'album' && !albumLoading && !albumError && albumDetails?.tracks?.items && (
            <View style={styles.tracksSection}>
              <Text style={styles.tracksSectionTitle}>TRACKS</Text>
              {albumDetails.tracks.items.map((trackItem, index) => (
                <TouchableOpacity
                  key={trackItem.id}
                  style={styles.trackItem}
                  onPress={() => handleRateTrack(trackItem)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.trackNum}>{trackItem.track_number}</Text>
                  <View style={styles.trackTextContainer}>
                    <Text style={styles.trackName} numberOfLines={1}>{trackItem.name}</Text>
                    <Text style={styles.trackArtists} numberOfLines={1}>
                      {extractArtistNames(trackItem.artists)}
                    </Text>
                  </View>
                  <Text style={styles.trackRateBtn}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, (saving || rating === 0) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || rating === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <Text style={styles.saveBtnText}>
                {rating === 0 ? 'Select a rating' : 'Save Review'}
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
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    position: 'relative',
    width: '100%',
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArt: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    opacity: 0.7,
  },
  albumArtFront: {
    width: 180,
    height: 180,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  tertiaryText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 32,
  },
  // Rating card (Letterboxd-style with RATED label)
  ratingCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 12,
  },
  // Review input
  reviewInputSection: {
    marginBottom: 20,
  },
  reviewInput: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    padding: 16,
    borderRadius: 10,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    lineHeight: 22,
  },
  // Privacy toggle - minimal horizontal buttons
  privacyRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  privacyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  privacyBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  privacyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  privacyBtnTextActive: {
    color: Colors.primary,
  },
  // Tracks section
  tracksSection: {
    marginBottom: 24,
  },
  tracksSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  // Credits styles
  creditsSection: {
    marginBottom: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  creditsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  creditsBlock: {
    marginBottom: 10,
  },
  creditsLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  creditsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  creditsNote: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.textTertiary,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackNum: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginRight: 12,
  },
  trackTextContainer: {
    flex: 1,
  },
  trackName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  trackArtists: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  trackRateBtn: {
    fontSize: 18,
    color: Colors.textTertiary,
    marginLeft: 8,
  },
  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
});

export default AddReviewScreen;
