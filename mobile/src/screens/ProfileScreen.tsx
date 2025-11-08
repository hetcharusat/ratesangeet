import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput, FlatList, Modal, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { getUserProfile, followUser, unfollowUser, updateUsername, updateFavorites, searchMusic, getUserReviews, Review } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Colors from '../theme/colors';

interface ProfileScreenProps {
  route: any;
  navigation: any;
}

const ProfileScreen = ({ route, navigation }: ProfileScreenProps) => {
  const { user, accessToken, refreshToken, setAuth } = useAuth();
  const userIdParam = (route?.params && (route.params as any).userId) as string | undefined;
  const resolvedUserId = userIdParam || user?.id;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [editingUsername, setEditingUsername] = useState(false);
  const [pendingUsername, setPendingUsername] = useState('');
  const [pickerOpen, setPickerOpen] = useState<null | 'album' | 'track'>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSelf = !!user?.id && user?.id === resolvedUserId;

  const loadProfile = async () => {
    if (!resolvedUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getUserProfile(resolvedUserId, user?.id);
      setProfile(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [resolvedUserId]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!resolvedUserId) return;
      try {
        const r = await getUserReviews(resolvedUserId);
        setUserReviews(r || []);
      } catch {
        setUserReviews([]);
      }
    };
    loadReviews();
  }, [resolvedUserId]);

  // Search within modal for picking favorites
  useEffect(() => {
    let active = true;
    const run = async () => {
  if (!pickerOpen || !searchQuery || !accessToken) {
        setSearchResults([]);
        return;
      }
      try {
        setSearchLoading(true);
        const type = pickerOpen === 'album' ? 'album' : 'track';
  const data = await searchMusic(accessToken, searchQuery, type);
        const items = pickerOpen === 'album' ? (data.albums?.items || []) : (data.tracks?.items || []);
        if (active) setSearchResults(items);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    };
    const t = setTimeout(run, 350);
    return () => { active = false; clearTimeout(t); };
  }, [pickerOpen, searchQuery, accessToken]);

  const handleFollowToggle = async () => {
    if (!user?.id || isSelf) return;
    try {
      setUpdating(true);
      const targetId = resolvedUserId as string;
      if (profile?.isFollowing) {
        const res = await unfollowUser(targetId, user.id);
        setProfile({ ...profile, isFollowing: false, followersCount: res.followersCount });
      } else {
        const res = await followUser(targetId, user.id);
        setProfile({ ...profile, isFollowing: true, followersCount: res.followersCount });
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleUsernameSave = async () => {
    if (!isSelf || !resolvedUserId) return;
    const val = pendingUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(val)) {
      Alert.alert('Invalid username', 'Use 3-20 chars: a-z, 0-9, _');
      return;
    }
    try {
      setUpdating(true);
      const res = await updateUsername(resolvedUserId, val);
      setProfile({ ...profile, username: res.username });
      // propagate to global auth state so it reflects across the app
      if (user) {
        await setAuth({ accessToken: accessToken || null, refreshToken: refreshToken || null, user: { ...user, username: res.username } });
      }
      setEditingUsername(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update username');
    } finally {
      setUpdating(false);
    }
  };

  const applyFavorite = async (item: any) => {
    if (!isSelf || !resolvedUserId || !pickerOpen) return;
    const favAlbums = profile?.favAlbums || [];
    const favTracks = profile?.favTracks || [];
    const shaped = pickerOpen === 'album'
      ? { id: item.id, name: item.name, artist: (item.artists||[])[0]?.name || '', image: item.images?.[0]?.url }
      : { id: item.id, name: item.name, artist: (item.artists||[]).map((a:any)=>a.name).join(', '), image: item.album?.images?.[0]?.url };
    const nextAlbums = pickerOpen === 'album' ? [...favAlbums.filter((x:any)=>x.id!==shaped.id), shaped].slice(0,4) : favAlbums;
    const nextTracks = pickerOpen === 'track' ? [...favTracks.filter((x:any)=>x.id!==shaped.id), shaped].slice(0,4) : favTracks;
    try {
      setUpdating(true);
      const res = await updateFavorites(resolvedUserId, nextAlbums, nextTracks);
      setProfile({ ...profile, favAlbums: res.favAlbums, favTracks: res.favTracks });
      setPickerOpen(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      Alert.alert('Error', 'Failed to update favorites');
    } finally {
      setUpdating(false);
    }
  };

  const removeFavorite = async (kind: 'album'|'track', id: string) => {
    if (!isSelf || !resolvedUserId) return;
    const favAlbums = profile?.favAlbums || [];
    const favTracks = profile?.favTracks || [];
    const nextAlbums = kind==='album'? favAlbums.filter((x:any)=>x.id!==id) : favAlbums;
    const nextTracks = kind==='track'? favTracks.filter((x:any)=>x.id!==id) : favTracks;
    try {
      setUpdating(true);
      const res = await updateFavorites(resolvedUserId, nextAlbums, nextTracks);
      setProfile({ ...profile, favAlbums: res.favAlbums, favTracks: res.favTracks });
    } catch {
      Alert.alert('Error', 'Failed to update favorites');
    } finally {
      setUpdating(false);
    }
  };

  if (!resolvedUserId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Sign in to view your profile</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {profile.profileImage ? (
          <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{profile.displayName?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
        )}
        <Text style={styles.name}>{profile.displayName}</Text>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>@{profile.username || 'user'}</Text>
          {isSelf && !editingUsername && (
            <TouchableOpacity onPress={() => { setEditingUsername(true); setPendingUsername(profile.username || ''); }}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {isSelf && editingUsername && (
          <View style={styles.usernameEditRow}>
            <TextInput
              value={pendingUsername}
              onChangeText={setPendingUsername}
              placeholder="new_username"
              placeholderTextColor="#666"
              style={styles.usernameInput}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleUsernameSave} disabled={updating}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingUsername(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!profile.email && <Text style={styles.email}>{profile.email}</Text>}
        <View style={styles.countsRow}>
          <Text style={styles.count}>{profile.followersCount} Followers</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.count}>{profile.followingCount} Following</Text>
        </View>
        {!isSelf && (
          <TouchableOpacity style={[styles.followBtn, profile.isFollowing && styles.followingBtn]} onPress={handleFollowToggle} disabled={updating}>
            <Text style={styles.followBtnText}>{profile.isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Scrollable content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Favorites */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Favorite Albums</Text>
          {isSelf && (profile.favAlbums?.length || 0) < 4 && (
            <TouchableOpacity onPress={() => setPickerOpen('album')}>
              <Text style={styles.addLink}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {(profile.favAlbums || []).length === 0 && !isSelf ? (
          <Text style={styles.emptyText}>No favorites yet</Text>
        ) : (
          <View style={styles.grid}>
            {(profile.favAlbums || []).map((a: any) => (
              <View key={a.id} style={styles.gridItem}>
                {a.image ? (
                  <Image source={{ uri: a.image }} style={styles.gridArt} />
                ) : (
                  <View style={[styles.gridArt, styles.gridPlaceholder]} />
                )}
                <Text style={styles.gridName} numberOfLines={1}>{a.name}</Text>
                <Text style={styles.gridSub} numberOfLines={1}>{a.artist}</Text>
                {isSelf && (
                  <TouchableOpacity style={styles.removeBadge} onPress={() => removeFavorite('album', a.id)}>
                    <Text style={styles.removeBadgeText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {isSelf && (profile.favAlbums?.length || 0) < 4 && (
              <TouchableOpacity style={[styles.gridItem, styles.addTile]} onPress={() => setPickerOpen('album')}>
                <Text style={styles.addTileText}>+ Add Album</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Favorite Tracks</Text>
          {isSelf && (profile.favTracks?.length || 0) < 4 && (
            <TouchableOpacity onPress={() => setPickerOpen('track')}>
              <Text style={styles.addLink}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {(profile.favTracks || []).length === 0 && !isSelf ? (
          <Text style={styles.emptyText}>No favorites yet</Text>
        ) : (
          <View style={styles.grid}>
            {(profile.favTracks || []).map((t: any) => (
              <View key={t.id} style={styles.gridItem}>
                {t.image ? (
                  <Image source={{ uri: t.image }} style={styles.gridArt} />
                ) : (
                  <View style={[styles.gridArt, styles.gridPlaceholder]} />
                )}
                <Text style={styles.gridName} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.gridSub} numberOfLines={1}>{t.artist}</Text>
                {isSelf && (
                  <TouchableOpacity style={styles.removeBadge} onPress={() => removeFavorite('track', t.id)}>
                    <Text style={styles.removeBadgeText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {isSelf && (profile.favTracks?.length || 0) < 4 && (
              <TouchableOpacity style={[styles.gridItem, styles.addTile]} onPress={() => setPickerOpen('track')}>
                <Text style={styles.addTileText}>+ Add Track</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Recent Reviews */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
        </View>
        {userReviews.length === 0 ? (
          <Text style={styles.emptyText}>No reviews yet</Text>
        ) : (
          userReviews.slice(0, 5).map((item) => (
            <View key={item._id} style={styles.reviewCard}>
              {item.albumArt ? (
                <Image source={{ uri: item.albumArt }} style={styles.reviewArt} />
              ) : (
                <View style={[styles.reviewArt, styles.reviewArtPlaceholder]} />
              )}
              <View style={styles.reviewDetails}>
                <Text style={styles.reviewTitle} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.reviewSub} numberOfLines={1}>{item.artistName}</Text>
                <Text style={styles.reviewMeta}>⭐ {item.rating}/5 · {item.listeningDate ? new Date(item.listeningDate).toLocaleDateString() : ''}</Text>
              </View>
            </View>
          ))
        )}
      </View>
      </ScrollView>

      {/* Picker Modal */}
      <Modal visible={!!pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Favorite {pickerOpen === 'album' ? 'Album' : 'Track'}</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${pickerOpen === 'album' ? 'albums' : 'tracks'}...`}
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
            />
            {searchLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultRow} onPress={() => applyFavorite(item)}>
                    <Image 
                      source={{ uri: (item.images?.[0]?.url) || (item.album?.images?.[0]?.url) || '' }} 
                      style={styles.resultArt} 
                    />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {(item.artists||[]).map((a:any)=>a.name).join(', ')}
                      </Text>
                    </View>
                    <Text style={styles.pickText}>Add</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyHint}>No results</Text>}
                style={styles.resultsList}
              />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPickerOpen(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 32 },
  header: { alignItems: 'center', padding: 24, paddingTop: 50 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: { backgroundColor: Colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: Colors.textPrimary, fontSize: 28, fontWeight: 'bold' },
  name: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  username: { color: Colors.textSecondary, fontSize: 15 },
  editLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  usernameEditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  usernameInput: { 
    backgroundColor: Colors.skeleton, 
    color: Colors.textPrimary, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    minWidth: 160,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: Colors.black, fontWeight: '700', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 14 },
  email: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  countsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  count: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  dot: { color: Colors.textTertiary, fontSize: 15 },
  followBtn: { 
    marginTop: 16, 
    backgroundColor: Colors.primary, 
    paddingHorizontal: 24, 
    paddingVertical: 10, 
    borderRadius: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  followingBtn: { backgroundColor: Colors.surfaceLight },
  followBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
  },
  sectionTitle: { 
    color: Colors.textPrimary, 
    fontSize: 18, 
    fontWeight: '700',
  },
  addLink: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { 
    width: '47%', 
    backgroundColor: Colors.surface, 
    borderRadius: 10, 
    padding: 12, 
    position: 'relative',
  },
  gridArt: { width: '100%', aspectRatio: 1, borderRadius: 6, marginBottom: 8, backgroundColor: Colors.placeholder },
  gridPlaceholder: { backgroundColor: Colors.placeholder },
  gridName: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  gridSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  removeBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: 'rgba(0,0,0,0.75)', 
    borderRadius: 12, 
    width: 24, 
    height: 24, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  removeBadgeText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  addTile: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addTileText: { color: Colors.textSecondary, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlayDark, justifyContent: 'flex-end' },
  modalCard: { 
    backgroundColor: Colors.surfaceDark, 
    padding: 20, 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  searchInput: { 
    backgroundColor: Colors.skeleton, 
    color: Colors.textPrimary, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 8, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  resultArt: { width: 50, height: 50, borderRadius: 6, backgroundColor: Colors.placeholder },
  resultInfo: { flex: 1 },
  resultName: { color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  resultSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  pickText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  resultsList: { maxHeight: 300 },
  closeBtn: { 
    marginTop: 16, 
    alignSelf: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    backgroundColor: Colors.surface, 
    borderRadius: 8,
  },
  closeBtnText: { color: Colors.textPrimary, fontWeight: '600' },
  emptyHint: { color: Colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  // Recent reviews styles
  reviewCard: { 
    flexDirection: 'row', 
    backgroundColor: Colors.surface, 
    borderRadius: 10, 
    padding: 12, 
    marginTop: 8,
  },
  reviewArt: { width: 60, height: 60, borderRadius: 6, marginRight: 12 },
  reviewArtPlaceholder: { backgroundColor: Colors.placeholder },
  reviewDetails: { flex: 1, justifyContent: 'center' },
  reviewTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  reviewSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  reviewMeta: { color: Colors.primary, fontSize: 12, marginTop: 6, fontWeight: '600' },
});

export default ProfileScreen;
