import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { updateReview, deleteReview, Review, getReviewComments, addReviewComment, ReviewComment, deleteReviewComment, getAlbumDetails, Track } from '../services/api';
import Colors from '../theme/colors';
import StarRating from 'react-native-star-rating-widget';

interface ReviewDetailScreenProps {
  route: any;
  navigation: any;
}

const ReviewDetailScreen = ({ route, navigation }: ReviewDetailScreenProps) => {
  const { user, accessToken } = useAuth();
  const { review } = route.params;
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [reviewText, setReviewText] = useState(review.reviewText || '');
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // Album credits state
  const [albumDetails, setAlbumDetails] = useState<any | null>(null);
  const [albumLoading, setAlbumLoading] = useState<boolean>(false);
  const [albumError, setAlbumError] = useState<string | null>(null);

  const isOwner = user?.id === (typeof review.userId === 'string' ? review.userId : review.userId._id);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setCommentsLoading(true);
        const list = await getReviewComments(review._id);
        if (active) setComments(list || []);
      } catch {
        if (active) setComments([]);
      } finally {
        if (active) setCommentsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [review._id]);

  // Load album details to show credits when this review is for an album
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (review.itemType !== 'album' || !review.spotifyId) return;
      try {
        setAlbumLoading(true);
        setAlbumError(null);
        if (!accessToken) return;
        const details = await getAlbumDetails(accessToken, review.spotifyId);
        if (mounted) setAlbumDetails(details);
      } catch (e) {
        if (mounted) setAlbumError('Unable to load album details');
      } finally {
        if (mounted) setAlbumLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [review.itemType, review.spotifyId]);

  const handleSave = async () => {
    if (!isOwner) return;

    try {
      setSaving(true);
      await updateReview(review._id, {
        rating,
        reviewText: reviewText.trim() || undefined,
      });
      Alert.alert('Success', 'Review updated!');
      setIsEditing(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error updating review:', error);
      Alert.alert('Error', 'Failed to update review');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!isOwner) return;

    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReview(review._id);
              Alert.alert('Success', 'Review deleted');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting review:', error);
              Alert.alert('Error', 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        <StarRating
          rating={rating}
          onChange={isEditing ? setRating : undefined}
          starSize={isEditing ? 44 : 36}
          color={Colors.primary}
          starStyle={{ marginHorizontal: 2 }}
          enableHalfStar={true}
          enableSwiping={false}
        />
        {!isEditing && (
          <Text style={styles.ratingValue}>{rating.toFixed(1)} / 5.0</Text>
        )}
      </View>
    );
  };

  const getUpdatedDate = () => {
    if (review.updatedAt && review.updatedAt !== review.createdAt) {
      return `Edited on ${new Date(review.updatedAt).toLocaleDateString()}`;
    }
    return null;
  };

  const handlePostComment = async () => {
    if (!user?.id) return;
    const text = newComment.trim();
    if (!text) return;
    try {
      setPosting(true);
      const created = await addReviewComment(review._id, user.id, text);
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (e) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (c: ReviewComment) => {
    const authorId = typeof c.userId === 'string' ? c.userId : c.userId._id;
    if (!user?.id || user.id !== authorId) return;
    try {
      await deleteReviewComment(c._id, user.id);
      setComments((prev) => prev.filter((x) => x._id !== c._id));
    } catch {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  // Credits helpers (mirror AddReviewScreen)
  const albumSource = albumDetails ?? null;
  const primaryArtists: Array<{ name: string; id?: string }> = (review.itemType === 'album'
    ? (albumSource?.artists ?? []).map((a: any) => ({ name: a.name, id: a.id }))
    : []);

  const featuredArtists: Array<{ name: string; count: number; id?: string }> = (() => {
    if (review.itemType !== 'album') return [];
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

  const openArtist = (name: string, artistId?: string) => {
    navigation.navigate('Artist', artistId ? { artistId, q: name } : { q: name });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {review.albumArt && (
          <Image source={{ uri: review.albumArt }} style={styles.albumArt} />
        )}

        <Text style={styles.itemName}>{review.itemName}</Text>
        <Text style={styles.artistName}>{review.artistName}</Text>
        <Text style={styles.itemType}>{review.itemType === 'album' ? '💿 Album' : '🎵 Track'}</Text>

        {renderStars()}

        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Listened on:</Text>
          <Text style={styles.date}>
            {review.listeningDate ? new Date(review.listeningDate).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
        {getUpdatedDate() && (
          <Text style={styles.editedLabel}>{getUpdatedDate()}</Text>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Review:</Text>
          {isEditing ? (
            <TextInput
              style={styles.reviewInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Write your review..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={6}
            />
          ) : (
            <Text style={styles.reviewText}>
              {review.reviewText || 'No review text'}
            </Text>
          )}
        </View>

        {/* Credits for album reviews */}
        {review.itemType === 'album' && (
          <View style={styles.creditsSection}>
            <Text style={styles.creditsTitle}>CREDITS</Text>
            {albumLoading && <Text style={styles.creditsLoading}>Loading credits…</Text>}
            {albumError && <Text style={styles.creditsError}>{albumError}</Text>}

            {!albumLoading && !albumError && (
              <>
                {primaryArtists.length > 0 && (
                  <View style={styles.creditsBlock}>
                    <Text style={styles.creditsLabel}>Artists</Text>
                    <View style={styles.creditsChips}>
                      {primaryArtists.map((artist) => (
                        <TouchableOpacity key={`artist-${artist.name}`} style={styles.chip} onPress={() => openArtist(artist.name, artist.id)}>
                          <Text style={styles.chipText}>{artist.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {featuredArtists.length > 0 && (
                  <View style={styles.creditsBlock}>
                    <Text style={styles.creditsLabel}>Featured</Text>
                    <View style={styles.creditsChips}>
                      {featuredArtists.map((artist) => (
                        <TouchableOpacity key={`feat-${artist.name}`} style={styles.chip} onPress={() => openArtist(artist.name, artist.id)}>
                          <Text style={styles.chipText}>{artist.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={styles.creditsNote}>
                  Composer credits aren’t exposed by the Spotify API. We list primary and featured artists based on album and track credits.
                </Text>
              </>
            )}
          </View>
        )}

        {isOwner && (
          <View style={styles.buttonContainer}>
            {!isEditing ? (
              <>
                <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                  <Text style={styles.editButtonText}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : '✓ Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditing(false);
                    setRating(review.rating);
                    setReviewText(review.reviewText || '');
                  }}
                >
                  <Text style={styles.cancelButtonText}>✕ Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Comments */}
        <View style={{ width: '100%', marginTop: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Comments</Text>
          {commentsLoading ? (
            <ActivityIndicator color="#1DB954" />
          ) : comments.length === 0 ? (
            <Text style={{ color: '#B3B3B3' }}>No comments yet</Text>
          ) : (
            comments.map((c) => {
              const author = typeof c.userId === 'string' ? null : c.userId;
              return (
                <View key={c._id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{author?.displayName?.[0]?.toUpperCase() || 'U'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={styles.commentAuthor}>{author?.displayName || 'User'}</Text>
                      {!!author?.username && <Text style={styles.commentHandle}> @{author.username}</Text>}
                      <Text style={styles.commentDot}> · </Text>
                      <Text style={styles.commentTime}>{new Date(c.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                  {user?.id && (typeof c.userId !== 'string' ? c.userId._id === user.id : c.userId === user.id) && (
                    <TouchableOpacity onPress={() => handleDeleteComment(c)}>
                      <Text style={styles.commentDelete}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          {/* New comment input */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Write a comment..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity style={styles.commentSend} onPress={handlePostComment} disabled={posting || !newComment.trim()}>
              <Text style={styles.commentSendText}>{posting ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  itemName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 18,
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 8,
  },
  itemType: {
    fontSize: 14,
    color: '#1DB954',
    marginBottom: 20,
  },
  starsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 14,
    color: '#B3B3B3',
    marginRight: 8,
  },
  date: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  editedLabel: {
    fontSize: 12,
    color: '#808080',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  reviewSection: {
    width: '100%',
    marginBottom: 30,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 15,
    color: '#B3B3B3',
    lineHeight: 22,
  },
  reviewInput: {
    backgroundColor: '#282828',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#232323',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: { color: '#fff', fontWeight: '700' },
  commentAuthor: { color: '#fff', fontWeight: '700' },
  commentHandle: { color: '#B3B3B3' },
  commentDot: { color: '#555' },
  commentTime: { color: '#777', fontSize: 12 },
  commentText: { color: '#ddd' },
  commentDelete: { color: '#FF6666', marginLeft: 8 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#282828',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40,
    maxHeight: 100,
  },
  commentSend: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  commentSendText: { color: '#000', fontWeight: '700' },

  // Credits styles (mirrors AddReviewScreen)
  creditsSection: {
    width: '100%',
    marginBottom: 16,
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
  creditsLoading: { color: Colors.textSecondary, fontSize: 12 },
  creditsError: { color: Colors.error, fontSize: 12 },
});

export default ReviewDetailScreen;
