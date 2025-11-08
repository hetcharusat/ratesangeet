import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../theme/colors';
import { getDiscoveryData, DiscoveryPayload, refreshAccessToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

type TabType = 'trending' | 'reviews';

// Simple category header component
const CategoryHeader = ({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: string }) => (
  <View style={styles.categoryHeader}>
    <Text style={styles.categoryTitle}>
      {icon ? `${icon} ` : ''}{title}
    </Text>
    {subtitle ? <Text style={styles.categorySubtitle}>{subtitle}</Text> : null}
  </View>
);

// Trending content tab
const TrendingTab = ({ data, loading, refreshing, onRefresh }: { data: DiscoveryPayload | null; loading: boolean; refreshing: boolean; onRefresh: () => void }) => {
  if (loading) {
    return (
      <View style={[styles.center, { flex: 1 }]}> 
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const openSpotify = (uri: string, url: string) => {
    // Try deep link first, fallback to web URL
    Linking.canOpenURL(uri).then(supported => {
      if (supported) {
        Linking.openURL(uri);
      } else {
        Linking.openURL(url);
      }
    }).catch(() => Linking.openURL(url));
  };

  // Group by content type
  const hasPlaylists = Boolean(
    (data?.madeForYou?.playlists?.length || 0) > 0 ||
    (data?.featuredPlaylists?.playlists?.length || 0) > 0
  );

  const hasAlbums = Boolean(
    (data?.newReleases?.albums?.length || 0) > 0 ||
    (data?.trendingAlbums?.albums?.length || 0) > 0
  );

  const hasTracks = Boolean(
    (data?.recommendations?.tracks?.length || 0) > 0 ||
    (data?.trendingTracks?.tracks?.length || 0) > 0
  );

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>        
      {/* === CATEGORY: PLAYLISTS === */}
      {hasPlaylists ? (
        <CategoryHeader 
          icon="🎧"
          title="PLAYLISTS"
          subtitle="Curated collections for every mood"
        />
      ) : null}

      {/* Made For You Playlists */}
      {data?.madeForYou?.playlists?.length ? (
        <View style={styles.section}>            
          <Text style={styles.sectionTitle}>{data.madeForYou.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.madeForYou.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.madeForYou.playlists.map((p, i) => (
              <TouchableOpacity key={i} style={styles.playlistPill} onPress={() => openSpotify(p.spotifyUri, p.spotifyUrl)}>
                {p.coverArt ? <Image source={{ uri: p.coverArt }} style={styles.playlistArt} /> : <View style={[styles.playlistArt, styles.placeholder]} />}
                <Text style={styles.playlistName} numberOfLines={2}>{p.playlistName}</Text>
                <Text style={styles.playlistMeta} numberOfLines={1}>{p.totalTracks} tracks</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Featured Playlists */}
      {data?.featuredPlaylists?.playlists?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{data.featuredPlaylists.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.featuredPlaylists.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.featuredPlaylists.playlists.map((p, i) => (
              <TouchableOpacity key={i} style={styles.playlistPill} onPress={() => openSpotify(p.spotifyUri, p.spotifyUrl)}>
                {p.coverArt ? <Image source={{ uri: p.coverArt }} style={styles.playlistArt} /> : <View style={[styles.playlistArt, styles.placeholder]} />}
                <Text style={styles.playlistName} numberOfLines={2}>{p.playlistName}</Text>
                <Text style={styles.playlistMeta} numberOfLines={1}>{p.totalTracks} tracks</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Divider */}
      {hasPlaylists && hasAlbums ? <View style={styles.groupDivider} /> : null}

      {/* === CATEGORY: ALBUMS === */}
      {hasAlbums ? (
        <CategoryHeader 
          icon="💿"
          title="ALBUMS"
          subtitle="New releases and trending albums"
        />
      ) : null}

      {/* New Releases You Might Like */}
      {data?.newReleases?.albums?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{data.newReleases.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.newReleases.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.newReleases.albums.map((a, i) => (
              <TouchableOpacity key={i} style={styles.albumPill} onPress={() => openSpotify(a.spotifyUri, a.spotifyUrl)}>
                {a.albumArt ? <Image source={{ uri: a.albumArt }} style={styles.albumArt} /> : <View style={[styles.albumArt, styles.placeholder]} />}
                <Text style={styles.albumName} numberOfLines={1}>{a.albumName}</Text>
                <Text style={styles.albumArtist} numberOfLines={1}>{a.artistName}</Text>
                <Text style={styles.albumMeta}>{a.totalTracks} tracks</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Trending Albums Worldwide */}
      {data?.trendingAlbums?.albums?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{data.trendingAlbums.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.trendingAlbums.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.trendingAlbums.albums.map((a, i) => (
              <TouchableOpacity key={i} style={styles.albumPill} onPress={() => openSpotify(a.spotifyUri, a.spotifyUrl)}>
                <View style={styles.rankBadge}><Text style={styles.rankText}>#{a.rank}</Text></View>
                {a.albumArt ? <Image source={{ uri: a.albumArt }} style={styles.albumArt} /> : <View style={[styles.albumArt, styles.placeholder]} />}
                <Text style={styles.albumName} numberOfLines={1}>{a.albumName}</Text>
                <Text style={styles.albumArtist} numberOfLines={1}>{a.artistName}</Text>
                <Text style={styles.albumMeta}>{a.totalTracks} tracks</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Divider */}
      {hasAlbums && hasTracks ? <View style={styles.groupDivider} /> : null}

      {/* === CATEGORY: TRACKS === */}
      {hasTracks ? (
        <CategoryHeader 
          icon="🎵"
          title="TRACKS"
          subtitle="Personalized picks and global hits"
        />
      ) : null}

      {/* Recommended Tracks */}
      {data?.recommendations?.tracks?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{data.recommendations.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.recommendations.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.recommendations.tracks.map((t, i) => (
              <TouchableOpacity key={i} style={styles.trackPill} onPress={() => openSpotify(t.spotifyUri, t.spotifyUrl)}>
                {t.albumArt ? <Image source={{ uri: t.albumArt }} style={styles.trackArt} /> : <View style={[styles.trackArt, styles.placeholder]} />}
                <Text style={styles.trackName} numberOfLines={1}>{t.trackName}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{t.artistName}</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Trending Tracks Worldwide */}
      {data?.trendingTracks?.tracks?.length ? (
        <View style={styles.section}>            
          <Text style={styles.sectionTitle}>{data.trendingTracks.title}</Text>
          <Text style={styles.sectionSubtitle}>{data.trendingTracks.description}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroller}>
            {data.trendingTracks.tracks.slice(0, 20).map((t, i) => (
              <TouchableOpacity key={i} style={styles.trackPill} onPress={() => openSpotify(t.spotifyUri, t.spotifyUrl)}>
                <View style={styles.rankBadge}><Text style={styles.rankText}>#{t.rank}</Text></View>
                {t.albumArt ? <Image source={{ uri: t.albumArt }} style={styles.trackArt} /> : <View style={[styles.trackArt, styles.placeholder]} />}
                <Text style={styles.trackName} numberOfLines={1}>{t.trackName}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{t.artistName}</Text>
                <View style={styles.spotifyBadge}>
                  <Text style={styles.spotifyBadgeText}>▶ Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
};

// Reviews tab (placeholder for now)
const ReviewsTab = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.center}>
      <Text style={styles.comingSoonTitle}>📝 Community Reviews</Text>
      <Text style={styles.comingSoonText}>Coming soon! All public reviews will appear here.</Text>
      <Text style={styles.comingSoonSubtext}>Stay tuned for ratings, reviews, and recommendations from the community.</Text>
    </ScrollView>
  );
};

const DiscoveryScreen = () => {
  const { user, accessToken, refreshToken, setAuth } = useAuth();
  const [data, setData] = useState<DiscoveryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  
  const tokenRef = useRef<string | null>(accessToken);
  const refreshTokenRef = useRef<string | null>(refreshToken);

  useEffect(() => {
    tokenRef.current = accessToken;
    refreshTokenRef.current = refreshToken;
  }, [accessToken, refreshToken]);

  // Helper to retry API calls with token refresh on 401
  const performWithRefresh = async <T,>(
    token: string | null,
    action: (token: string) => Promise<T>
  ): Promise<T> => {
    if (!token) {
      throw new Error('Missing access token');
    }

    try {
      return await action(token);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 && refreshTokenRef.current && user) {
        console.log('[DiscoveryScreen] Token expired, refreshing...');
        try {
          const refreshed = await refreshAccessToken(refreshTokenRef.current);
          if (refreshed?.accessToken) {
            const nextAuth = {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? refreshTokenRef.current,
              user,
            };
            await setAuth(nextAuth);
            tokenRef.current = refreshed.accessToken;
            if (refreshed.refreshToken) {
              refreshTokenRef.current = refreshed.refreshToken;
            }
            console.log('[DiscoveryScreen] Token refreshed successfully, retrying...');
            return await action(refreshed.accessToken);
          }
        } catch (refreshError) {
          console.error('[DiscoveryScreen] Failed to refresh token:', refreshError);
        }
      }
      throw error;
    }
  };

  const load = async () => {
    try {
      const payload = await performWithRefresh(tokenRef.current, (token) => 
        getDiscoveryData(token)
      );
      console.log('[DiscoveryScreen] Data loaded:', {
        madeForYou: payload?.madeForYou?.playlists?.length || 0,
        recommendations: payload?.recommendations?.tracks?.length || 0,
        newReleases: payload?.newReleases?.albums?.length || 0,
        trendingAlbums: payload?.trendingAlbums?.albums?.length || 0,
        trendingTracks: payload?.trendingTracks?.tracks?.length || 0,
        featuredPlaylists: payload?.featuredPlaylists?.playlists?.length || 0,
      });
      setData(payload);
    } catch (e) {
      console.error('[DiscoveryScreen] Error loading data:', e);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>          
        <Text style={styles.title}>Discovery</Text>
        <Text style={styles.subtitle}>Personalized picks + global trending</Text>
      </View>
      
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'trending' && styles.tabActive]} 
          onPress={() => setActiveTab('trending')}
        >
          <Text style={[styles.tabText, activeTab === 'trending' && styles.tabTextActive]}>
            🔥 Trending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]} 
          onPress={() => setActiveTab('reviews')}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            📝 Reviews
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      {activeTab === 'trending' ? (
        <TrendingTab data={data} loading={loading} refreshing={refreshing} onRefresh={onRefresh} />
      ) : (
        <ReviewsTab />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors.surface },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 5 },
  
  // Custom Tab Bar Styles
  tabBar: { 
    flexDirection: 'row', 
    backgroundColor: Colors.background, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.surface,
    paddingHorizontal: 20,
  },
  tab: { 
    flex: 1, 
    paddingVertical: 16, 
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { 
    borderBottomColor: Colors.primary,
  },
  tabText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: Colors.textSecondary,
  },
  tabTextActive: { 
    color: Colors.primary,
  },
  
  section: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  horizontalScroller: { marginTop: 12 },
  albumPill: { width: 140, marginRight: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, position: 'relative' },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.placeholder },
  albumName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  albumArtist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  albumMeta: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  trackPill: { width: 140, marginRight: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, position: 'relative' },
  trackArt: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.placeholder },
  trackName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  trackArtist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  trackMeta: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  releasePill: { width: 140, marginRight: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, position: 'relative' },
  releaseArt: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.placeholder },
  releaseName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  releaseArtist: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  releaseMeta: { fontSize: 11, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  playlistPill: { width: 160, marginRight: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, position: 'relative' },
  playlistArt: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.placeholder },
  playlistName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, lineHeight: 16 },
  playlistMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  rankBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, zIndex: 10 },
  rankText: { fontSize: 10, fontWeight: 'bold', color: Colors.background },
  spotifyBadge: { marginTop: 6, backgroundColor: '#1DB954', borderRadius: 6, paddingVertical: 4, alignItems: 'center' },
  spotifyBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  comingSoonTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, textAlign: 'center', marginBottom: 15 },
  comingSoonText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  comingSoonSubtext: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', opacity: 0.7 },
  placeholder: { backgroundColor: Colors.placeholder },
  categoryHeader: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 6 },
  categoryTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  categorySubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  groupDivider: { height: 1, backgroundColor: Colors.surface, marginHorizontal: 20, marginTop: 30, marginBottom: 10, opacity: 0.6 },
});

export default DiscoveryScreen;
