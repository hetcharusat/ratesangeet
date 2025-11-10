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

  const renderFavoriteItem = ({ item }: { item: { id: string; name: string; artist: string; image?: string } }) => (
    <TouchableOpacity onPress={() => handleItemPress('album', item)}>
      <Image source={{ uri: item.image || 'https://via.placeholder.com/150' }} style={styles.favItemImage} />
    </TouchableOpacity>
  );

  const renderReviewItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.reviewItemContainer} onPress={() => navigation.navigate('ReviewDetail' as any, { reviewId: item._id } as any)}>
      <Image source={{ uri: item.albumArt || 'https://via.placeholder.com/100' }} style={styles.reviewItemImage} />
      <View style={styles.reviewItemDetails}>
        <Text style={styles.reviewItemTitle}>{item.itemName}</Text>
        <Text style={styles.reviewItemArtist}>{item.artistName}</Text>
        <Text style={styles.reviewItemRating}>{'⭐'.repeat(item.rating)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />}
    >
      <View style={styles.header}>
        <Image
          source={{ uri: profile.profileImage || 'https://via.placeholder.com/100' }}
          style={styles.profileImage}
        />
        <View style={styles.statsContainer}>
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

      <View style={styles.profileInfo}>
        <Text style={styles.displayName}>{profile.displayName}</Text>
        {profile.bio && <Text style={styles.bioText}>{stripEmojis(profile.bio)}</Text>}
      </View>

      <View style={styles.actionButtons}>
        {isOwnProfile ? (
            <TouchableOpacity style={styles.button} onPress={() => setIsEditMode(true)}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleFollow}>
            <Text style={styles.buttonText}>{profile.isFollowing ? 'Unfollow' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favorite Albums</Text>
        <FlatList
          data={profile.favAlbums}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favorite Tracks</Text>
        <FlatList
          data={profile.favTracks}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        <FlatList
          data={activity?.recentReviews}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 20,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#999',
    fontSize: 14,
  },
  profileInfo: {
    paddingHorizontal: 15,
  },
  displayName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bioText: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
  },
  actionButtons: {
    padding: 15,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  favItemImage: {
    width: 120,
    height: 120,
    marginRight: 10,
  },
  reviewItemContainer: {
    width: 150,
    marginRight: 10,
  },
  reviewItemImage: {
    width: '100%',
    height: 150,
  },
  reviewItemDetails: {
    padding: 5,
  },
  reviewItemTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  reviewItemArtist: {
    color: '#999',
  },
  reviewItemRating: {
    color: '#fff',
  },
});

export default ProfileScreen;
