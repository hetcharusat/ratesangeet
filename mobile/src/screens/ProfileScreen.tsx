import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getUserActivity,
  getMutualFollowers,
  getFollowers,
  getFollowing,
  updateUserProfile,
  updateFavorites,
  searchMusic,
  UserActivity,
  MutualFollower,
} from '../services/api';
import { Colors } from '../theme/colors';
import { FavoritesSection } from '../components/FavoritesSection';
import { FavoritesPickerModal } from '../components/FavoritesPickerModal';

type RouteParams = { userId?: string };

interface ProfileData {
  _id: string;
  displayName: string;
  username?: string;
  profileImage?: string;
  bio?: string;
  instagramUsername?: string;
  twitterHandle?: string;
  location?: string;
  favAlbums?: Array<{ id: string; name: string; artist: string; image?: string }>;
  favTracks?: Array<{ id: string; name: string; artist: string; image?: string }>;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

const ProfileScreen = () => {
  const { user, accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const userIdParam = route.params?.userId;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [mutualFollowers, setMutualFollowers] = useState<MutualFollower[]>([]);
  const [mutualCount, setMutualCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMutualModal, setShowMutualModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState<Array<{ _id: string; displayName: string; username?: string; profileImage?: string }>>([]);
  const [followingList, setFollowingList] = useState<Array<{ _id: string; displayName: string; username?: string; profileImage?: string }>>([]);
  
  // Favorites edit modes (separate for albums and tracks)
  const [albumsEditMode, setAlbumsEditMode] = useState(false);
  const [tracksEditMode, setTracksEditMode] = useState(false);
  
  // Search modal for adding favorites
  const [pickerOpen, setPickerOpen] = useState<null | 'album' | 'track'>(null);
  const [savingFavorites, setSavingFavorites] = useState(false);

  // Edit form state
  const [editBio, setEditBio] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTwitter, setEditTwitter] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const resolvedUserId = userIdParam || user?.id;
  const isOwnProfile = !userIdParam || userIdParam === user?.id;

  // Reset userId param when tapping Profile tab while viewing another user
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (_e: any) => {
      if (userIdParam && userIdParam !== user?.id) {
        navigation.setParams({ userId: undefined });
      }
    });
    return unsubscribe;
  }, [navigation, userIdParam, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [resolvedUserId])
  );

  const loadProfile = async () => {
    if (!resolvedUserId) return;
    try {
      setLoading(true);
      const [profileData, activityData] = await Promise.all([
        getUserProfile(resolvedUserId, user?.id),
        getUserActivity(resolvedUserId, 5),
      ]);

      setProfile(profileData);
      setActivity(activityData);
      setEditBio(profileData.bio || '');
      setEditInstagram(profileData.instagramUsername || '');
      setEditTwitter(profileData.twitterHandle || '');
      setEditLocation(profileData.location || '');

      // Load mutual followers if viewing another profile
      if (!isOwnProfile && user?.id) {
        const mutualData = await getMutualFollowers(resolvedUserId, user.id);
        setMutualFollowers(mutualData.mutualFollowers);
        setMutualCount(mutualData.count);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Favorites handlers
  const handleAddFavorite = async (item: { id: string; name: string; artist: string; image?: string }) => {
    if (!user?.id || !profile || !pickerOpen) return;
    
    const favAlbums = profile.favAlbums || [];
    const favTracks = profile.favTracks || [];
    
    const nextAlbums = pickerOpen === 'album' 
      ? [...favAlbums.filter((x) => x.id !== item.id), item].slice(0, 4) 
      : favAlbums;
    const nextTracks = pickerOpen === 'track' 
      ? [...favTracks.filter((x) => x.id !== item.id), item].slice(0, 4) 
      : favTracks;
    
    try {
      setSavingFavorites(true);
      const res = await updateFavorites(user.id, nextAlbums, nextTracks);
      setProfile({ ...profile, favAlbums: res.favAlbums, favTracks: res.favTracks });
      setPickerOpen(null);
    } catch {
      // ignore
    } finally {
      setSavingFavorites(false);
    }
  };

  const handleRemoveFavorite = async (kind: 'album' | 'track', id: string) => {
    if (!user?.id || !profile) return;
    
    const favAlbums = profile.favAlbums || [];
    const favTracks = profile.favTracks || [];
    const nextAlbums = kind === 'album' ? favAlbums.filter((x) => x.id !== id) : favAlbums;
    const nextTracks = kind === 'track' ? favTracks.filter((x) => x.id !== id) : favTracks;
    
    try {
      setSavingFavorites(true);
      const res = await updateFavorites(user.id, nextAlbums, nextTracks);
      setProfile({ ...profile, favAlbums: res.favAlbums, favTracks: res.favTracks });
    } catch {
      // ignore
    } finally {
      setSavingFavorites(false);
    }
  };

  const handleSaveFavorites = (kind: 'album' | 'track') => {
    // Turn off edit mode after save
    if (kind === 'album') setAlbumsEditMode(false);
    else setTracksEditMode(false);
  };

  const handleItemPress = (kind: 'album' | 'track', item: { id: string; name: string; artist?: string; image?: string }) => {
    if (kind === 'album') {
      navigation.navigate('AlbumDetail' as any, { albumId: item.id } as any);
    } else {
      navigation.navigate('AddReview' as any, {
        itemType: 'track',
        track: {
          id: item.id,
          name: item.name,
          artists: [{ name: item.artist || 'Unknown Artist' }],
          album: { images: [{ url: item.image || '' }] },
        },
      } as any);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const openFollowersModal = async () => {
    if (!resolvedUserId) return;
    try {
      const res = await getFollowers(resolvedUserId, 100);
      setFollowersList(res.followers);
      setShowFollowersModal(true);
    } catch {
      // fallback to empty list
      setFollowersList([]);
      setShowFollowersModal(true);
    }
  };

  const openFollowingModal = async () => {
    if (!resolvedUserId) return;
    try {
      const res = await getFollowing(resolvedUserId, 100);
      setFollowingList(res.following);
      setShowFollowingModal(true);
    } catch {
      // fallback to empty list
      setFollowingList([]);
      setShowFollowingModal(true);
    }
  };

  const handleFollow = async () => {
    if (!user?.id || !profile) return;
    try {
      if (profile.isFollowing) {
        await unfollowUser(profile._id, user.id);
        setProfile({ ...profile, isFollowing: false, followersCount: profile.followersCount - 1 });
      } else {
        await followUser(profile._id, user.id);
        setProfile({ ...profile, isFollowing: true, followersCount: profile.followersCount + 1 });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const stripEmojis = (input: string) => {
    return input.replace(/[\p{Extended_Pictographic}\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/gu, '').trim();
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    try {
      setSaving(true);
      await updateUserProfile(user.id, {
        bio: stripEmojis(editBio.trim()),
        instagramUsername: editInstagram.trim(),
        twitterHandle: editTwitter.trim(),
        location: editLocation.trim(),
      });
      setProfile({
        ...profile!,
        bio: stripEmojis(editBio.trim()),
        instagramUsername: editInstagram.trim(),
        twitterHandle: editTwitter.trim(),
        location: editLocation.trim(),
      });
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <Image
          source={{ uri: profile.profileImage || 'https://via.placeholder.com/100' }}
          style={styles.profileImage}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          {profile.username && <Text style={styles.username}>@{profile.username}</Text>}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={openFollowersModal}>
              <Text style={styles.statNumber}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={openFollowingModal}>
              <Text style={styles.statNumber}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bio Section */}
      <View style={styles.bioSection}>
        {isEditMode ? (
          <TextInput
            style={styles.bioInput}
            value={editBio}
            onChangeText={setEditBio}
            placeholder="Tell us about yourself (200 chars max)"
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={200}
          />
        ) : (
          profile.bio && <Text style={styles.bioText}>{stripEmojis(profile.bio)}</Text>
        )}
      </View>

      {/* Social Links & Location */}
      {(isEditMode || profile.instagramUsername || profile.twitterHandle || profile.location) && (
        <View style={styles.socialSection}>
          {isEditMode ? (
            <>
              <TextInput
                style={styles.socialInput}
                value={editInstagram}
                onChangeText={setEditInstagram}
                placeholder="Instagram username"
                placeholderTextColor={Colors.textSecondary}
              />
              <TextInput
                style={styles.socialInput}
                value={editTwitter}
                onChangeText={setEditTwitter}
                placeholder="Twitter handle"
                placeholderTextColor={Colors.textSecondary}
              />
              <TextInput
                style={styles.socialInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Location"
                placeholderTextColor={Colors.textSecondary}
                maxLength={50}
              />
            </>
          ) : (
            <>
              {profile.instagramUsername && (
                <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${profile.instagramUsername}`)}>
                  <Text style={styles.socialLink}>📷 @{profile.instagramUsername}</Text>
                </TouchableOpacity>
              )}
              {profile.twitterHandle && (
                <TouchableOpacity onPress={() => Linking.openURL(`https://x.com/${profile.twitterHandle}`)}>
                  <Text style={styles.socialLink}>🐦 @{profile.twitterHandle}</Text>
                </TouchableOpacity>
              )}
              {profile.location && <Text style={styles.locationText}>📍 {profile.location}</Text>}
            </>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isOwnProfile ? (
          <>
            {isEditMode ? (
              <>
                <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveProfile} disabled={saving}>
                  <Text style={styles.buttonText}>{saving ? 'Saving...' : '💾 Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setIsEditMode(false);
                    setEditBio(profile.bio || '');
                    setEditInstagram(profile.instagramUsername || '');
                    setEditTwitter(profile.twitterHandle || '');
                    setEditLocation(profile.location || '');
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.button, styles.editButton]} onPress={() => setIsEditMode(true)}>
                <Text style={styles.buttonText}>✎ Edit Profile</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity style={[styles.button, profile.isFollowing ? styles.unfollowButton : styles.followButton]} onPress={handleFollow}>
            <Text style={styles.buttonText}>{profile.isFollowing ? 'Unfollow' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mutual Followers */}
      {!isOwnProfile && mutualCount > 0 && (
        <TouchableOpacity style={styles.mutualSection} onPress={() => setShowMutualModal(true)}>
          <View style={styles.mutualAvatars}>
            {mutualFollowers.slice(0, 3).map((follower, index) => (
              <Image
                key={follower._id}
                source={{ uri: follower.profileImage || 'https://via.placeholder.com/30' }}
                style={[styles.mutualAvatar, { marginLeft: index > 0 ? -10 : 0 }]}
              />
            ))}
          </View>
          <Text style={styles.mutualText}>
            Followed by {mutualFollowers.slice(0, 2).map(f => f.displayName).join(', ')}
            {mutualCount > 2 ? ` + ${mutualCount - 2} more` : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Favorites Section */}
      {isOwnProfile && (
        <>
          <FavoritesSection
            title="Favorite Albums"
            data={profile.favAlbums || []}
            isEditMode={albumsEditMode}
            onToggleEdit={() => setAlbumsEditMode(!albumsEditMode)}
            onRemove={(id) => handleRemoveFavorite('album', id)}
            onAdd={() => setPickerOpen('album')}
            onItemPress={(item) => handleItemPress('album', item)}
            onSave={() => handleSaveFavorites('album')}
            maxItems={4}
          />
          
          <FavoritesSection
            title="Favorite Tracks"
            data={profile.favTracks || []}
            isEditMode={tracksEditMode}
            onToggleEdit={() => setTracksEditMode(!tracksEditMode)}
            onRemove={(id) => handleRemoveFavorite('track', id)}
            onAdd={() => setPickerOpen('track')}
            onItemPress={(item) => handleItemPress('track', item)}
            onSave={() => handleSaveFavorites('track')}
            maxItems={4}
          />
        </>
      )}

      {/* Favorites for other profiles (non-editable) */}
      {!isOwnProfile && (
        <>
          <View style={styles.favoritesSection}>
            <Text style={styles.sectionTitle}>Favorite Albums</Text>
            {(profile.favAlbums?.length || 0) === 0 ? (
              <Text style={styles.emptyStateText}>No favorites yet</Text>
            ) : (
              <View style={styles.favoritesGrid}>
                {(profile.favAlbums || []).map((album) => (
                  <View key={album.id} style={styles.favoriteItem}>
                    <TouchableOpacity onPress={() => handleItemPress('album', album)}>
                      <Image source={{ uri: album.image || 'https://via.placeholder.com/150' }} style={styles.favoriteImage} />
                      <Text style={styles.favoriteTitle} numberOfLines={1}>{album.name}</Text>
                      <Text style={styles.favoriteArtist} numberOfLines={1}>{album.artist}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.favoritesSection}>
            <Text style={styles.sectionTitle}>Favorite Tracks</Text>
            {(profile.favTracks?.length || 0) === 0 ? (
              <Text style={styles.emptyStateText}>No favorites yet</Text>
            ) : (
              <View style={styles.favoritesGrid}>
                {(profile.favTracks || []).map((track) => (
                  <View key={track.id} style={styles.favoriteItem}>
                    <TouchableOpacity onPress={() => handleItemPress('track', track)}>
                      <Image source={{ uri: track.image || 'https://via.placeholder.com/150' }} style={styles.favoriteImage} />
                      <Text style={styles.favoriteTitle} numberOfLines={1}>{track.name}</Text>
                      <Text style={styles.favoriteArtist} numberOfLines={1}>{track.artist}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {/* Activity Section */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        {activity?.lastScrobble && (() => {
          const sc = activity.lastScrobble;
          if (!sc) return null;
          return (
            <View style={styles.lastScrobble}>
              <Text style={styles.activityLabel}>Last played</Text>
              <TouchableOpacity
                style={styles.scrobbleRow}
                onPress={() => navigation.navigate('Search' as any, { initialQuery: sc.trackName, initialFilter: 'tracks' } as any)}
              >
                <Image source={{ uri: sc.albumArt || 'https://via.placeholder.com/50' }} style={styles.scrobbleImage} />
                <View style={styles.scrobbleInfo}>
                  <Text style={styles.scrobbleTrack} numberOfLines={1}>{sc.trackName}</Text>
                  <Text style={styles.scrobbleArtist} numberOfLines={1}>{sc.artistName}</Text>
                  <Text style={styles.scrobbleTime}>{formatTimeAgo(sc.playedAt)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        {activity?.recentReviews && activity.recentReviews.length > 0 && (
          <View style={styles.recentReviews}>
            <Text style={styles.activityLabel}>Recent Reviews</Text>
            {activity.recentReviews.map((review) => (
              <TouchableOpacity
                key={review._id}
                style={styles.reviewItem}
                onPress={() => navigation.navigate('ReviewDetail' as any, { reviewId: review._id } as any)}
              >
                <Image source={{ uri: review.albumArt || 'https://via.placeholder.com/60' }} style={styles.reviewImage} />
                <View style={styles.reviewInfo}>
                  <Text style={styles.reviewTitle} numberOfLines={1}>
                    {review.itemName}
                  </Text>
                  <Text style={styles.reviewArtist} numberOfLines={1}>
                    {review.artistName}
                  </Text>
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewRating}>⭐ {review.rating}/5</Text>
                    <Text style={styles.reviewTime}>{formatTimeAgo(review.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Mutual Followers Modal */}
      <Modal visible={showMutualModal} transparent animationType="slide" onRequestClose={() => setShowMutualModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mutual Followers ({mutualCount})</Text>
              <TouchableOpacity onPress={() => setShowMutualModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={mutualFollowers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mutualItem}
                  onPress={() => {
                    setShowMutualModal(false);
                    navigation.navigate('Profile' as any, { userId: item._id } as any);
                  }}
                >
                  <Image source={{ uri: item.profileImage || 'https://via.placeholder.com/40' }} style={styles.mutualItemAvatar} />
                  <View>
                    <Text style={styles.mutualItemName}>{item.displayName}</Text>
                    {item.username && <Text style={styles.mutualItemUsername}>@{item.username}</Text>}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* Followers Modal */}
      <Modal visible={showFollowersModal} transparent animationType="slide" onRequestClose={() => setShowFollowersModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Followers ({profile.followersCount})</Text>
              <TouchableOpacity onPress={() => setShowFollowersModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={followersList}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mutualItem}
                  onPress={() => {
                    setShowFollowersModal(false);
                    navigation.navigate('Profile' as any, { userId: item._id } as any);
                  }}
                >
                  <Image source={{ uri: item.profileImage || 'https://via.placeholder.com/40' }} style={styles.mutualItemAvatar} />
                  <View>
                    <Text style={styles.mutualItemName}>{item.displayName}</Text>
                    {item.username && <Text style={styles.mutualItemUsername}>@{item.username}</Text>}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* Following Modal */}
      <Modal visible={showFollowingModal} transparent animationType="slide" onRequestClose={() => setShowFollowingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Following ({profile.followingCount})</Text>
              <TouchableOpacity onPress={() => setShowFollowingModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={followingList}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.mutualItem}
                  onPress={() => {
                    setShowFollowingModal(false);
                    navigation.navigate('Profile' as any, { userId: item._id } as any);
                  }}
                >
                  <Image source={{ uri: item.profileImage || 'https://via.placeholder.com/40' }} style={styles.mutualItemAvatar} />
                  <View>
                    <Text style={styles.mutualItemName}>{item.displayName}</Text>
                    {item.username && <Text style={styles.mutualItemUsername}>@{item.username}</Text>}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Picker Modal for adding favorites */}
      <FavoritesPickerModal
        visible={!!pickerOpen}
        type={pickerOpen || 'album'}
        accessToken={accessToken || ''}
        onClose={() => setPickerOpen(null)}
        onSelect={handleAddFavorite}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 90,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bioSection: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bioInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  socialSection: {
    marginBottom: 16,
  },
  socialLink: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  socialInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.success || Colors.primary,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
  },
  followButton: {
    backgroundColor: Colors.primary,
  },
  unfollowButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  mutualSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  mutualAvatars: {
    flexDirection: 'row',
    marginRight: 12,
  },
  mutualAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  mutualText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  favoritesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  favoriteItem: {
    width: '47%',
  },
  unselectedFavorite: {
    opacity: 0.35,
  },
  favoriteImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  favoriteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  favoriteArtist: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  activitySection: {
    marginBottom: 24,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  lastScrobble: {
    marginBottom: 20,
  },
  scrobbleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
  },
  scrobbleImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  scrobbleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  scrobbleTrack: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  scrobbleArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  scrobbleTime: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  recentReviews: {
    gap: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
  },
  reviewImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  reviewArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  reviewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewRating: {
    fontSize: 12,
    color: Colors.primary,
  },
  reviewTime: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallEditButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderRadius: 6,
  },
  smallCancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  smallEditButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  favoritesActionsRow: {
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  mutualItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  mutualItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  mutualItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  mutualItemUsername: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Search modal styles
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  resultsList: {
    maxHeight: '70%',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  resultArt: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  resultSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pickText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyHint: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  // Add/remove badge
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.error + 'CC',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  addTile: {
    backgroundColor: Colors.surface + '60',
    borderWidth: 2,
    borderColor: Colors.primary + '60',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  addTileText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default ProfileScreen;
