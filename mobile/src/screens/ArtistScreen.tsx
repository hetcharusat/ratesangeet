import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { ArtistProfile, getArtistProfile, SpotifyImage } from '../services/api';
import { LoadingState } from '../components/LoadingState';

interface ArtistScreenProps {
  route: any;
  navigation: any;
}

const pickImageUrl = (images?: SpotifyImage[]) => images?.[0]?.url ?? '';

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
);

// Simple in-memory cache with TTL to speed up repeated loads
const ARTIST_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const artistCache: Record<string, { ts: number; data: ArtistProfile }> = {};

const ArtistScreen: React.FC<ArtistScreenProps> = ({ route, navigation }) => {
  const { accessToken } = useAuth();
  const { artistId, q, market } = route.params || {};

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);

  const cacheKey = (artistId ? `id:${artistId}` : `q:${q || ''}`) + (market ? `:${market}` : '');

  const load = async () => {
    if (!accessToken) return;
    try {
      setError(null);

      // Serve from cache if fresh
      const cached = artistCache[cacheKey];
      const now = Date.now();
      if (cached && now - cached.ts < ARTIST_CACHE_TTL_MS) {
        setProfile(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await getArtistProfile(accessToken, { artistId, q, market });
      setProfile(data);
      artistCache[cacheKey] = { ts: now, data };
    } catch (e: any) {
      console.error('Failed to load artist profile', e?.message || e);
      setError('Unable to load artist. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [accessToken, artistId, q, market]);

  const artistName = profile?.artist?.name || q || 'Artist';
  const artistImage = pickImageUrl(profile?.artist?.images);

  const albums = useMemo(() => profile?.discography?.albums ?? [], [profile]);
  const singles = useMemo(() => profile?.discography?.singles ?? [], [profile]);
  const compilations = useMemo(() => profile?.discography?.compilations ?? [], [profile]);

  const openSpotifyTrack = async (id?: string) => {
    if (!id) return;
    try {
      await Linking.openURL(`spotify:track:${id}`);
    } catch {
      Linking.openURL(`https://open.spotify.com/track/${id}`);
    }
  };

  const openSpotifyAlbum = async (id?: string) => {
    if (!id) return;
    try {
      await Linking.openURL(`spotify:album:${id}`);
    } catch {
      Linking.openURL(`https://open.spotify.com/album/${id}`);
    }
  };

  const openSpotifyArtist = async (id?: string) => {
    if (!id) return;
    try {
      await Linking.openURL(`spotify:artist:${id}`);
    } catch {
      Linking.openURL(`https://open.spotify.com/artist/${id}`);
    }
  };

  const openAlbumForReview = (a: { id: string; name: string; images?: SpotifyImage[] }) => {
    const primaryArtist = profile?.artist?.name ? [{ name: profile.artist.name }] : undefined as any;
    navigation.navigate('AddReview', {
      itemType: 'album',
      album: { id: a.id, name: a.name, images: a.images, artists: primaryArtist },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LoadingState loading={loading} error={error} onRetry={load}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            {!!artistImage && (
              <Image source={{ uri: artistImage }} style={styles.artistImage} />
            )}
            <Text style={styles.artistName} numberOfLines={2}>{artistName}</Text>
            {!!profile?.artist?.id && (
              <TouchableOpacity 
                style={styles.openSpotifyBtn} 
                onPress={() => openSpotifyArtist(profile.artist?.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.openSpotifyText}>🎵 Open in Spotify</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Top Tracks */}
          {profile?.topTracks && profile.topTracks.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Top Tracks" />
              {profile.topTracks.map((t, idx) => (
                <View key={t.id} style={styles.trackRow}>
                  <Text style={styles.trackNumber}>{idx + 1}</Text>
                  <Image source={{ uri: pickImageUrl(t.album?.images) }} style={styles.trackArt} />
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.trackSub} numberOfLines={1}>
                      {(t.artists || []).map((a) => a?.name).filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openSpotifyTrack(t.id)} style={styles.trackOpenBtn} activeOpacity={0.7}>
                    <Text style={styles.trackOpenIcon}>Play</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Discography - Albums */}
          {albums.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Albums" />
              <View style={styles.gridContainer}>
                {albums.map((a) => (
                  <View key={a.id} style={styles.gridItem}>
                    <TouchableOpacity onPress={() => openAlbumForReview(a)} activeOpacity={0.8}>
                      <Image source={{ uri: pickImageUrl(a.images) }} style={styles.gridArt} />
                      <Text style={styles.gridName} numberOfLines={2}>{a.name}</Text>
                      {!!a.release_date && (
                        <Text style={styles.gridYear}>{new Date(a.release_date).getFullYear()}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.gridOpenBtn} 
                      onPress={() => openSpotifyAlbum(a.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridOpenText}>▶ Play</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Discography - Singles */}
          {singles.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Singles & EPs" />
              <View style={styles.gridContainer}>
                {singles.map((a) => (
                  <View key={a.id} style={styles.gridItem}>
                    <TouchableOpacity onPress={() => openAlbumForReview(a)} activeOpacity={0.8}>
                      <Image source={{ uri: pickImageUrl(a.images) }} style={styles.gridArt} />
                      <Text style={styles.gridName} numberOfLines={2}>{a.name}</Text>
                      {!!a.release_date && (
                        <Text style={styles.gridYear}>{new Date(a.release_date).getFullYear()}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.gridOpenBtn} 
                      onPress={() => openSpotifyAlbum(a.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridOpenText}>▶ Play</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Compilations */}
          {compilations.length > 0 && (
            <View style={styles.section}>
              <SectionTitle title="Compilations" />
              <View style={styles.gridContainer}>
                {compilations.map((a) => (
                  <View key={a.id} style={styles.gridItem}>
                    <TouchableOpacity onPress={() => openAlbumForReview(a)} activeOpacity={0.8}>
                      <Image source={{ uri: pickImageUrl(a.images) }} style={styles.gridArt} />
                      <Text style={styles.gridName} numberOfLines={2}>{a.name}</Text>
                      {!!a.release_date && (
                        <Text style={styles.gridYear}>{new Date(a.release_date).getFullYear()}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.gridOpenBtn} 
                      onPress={() => openSpotifyAlbum(a.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridOpenText}>▶ Play</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </LoadingState>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: Colors.background,
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
  container: { 
    flex: 1,
    ...(Platform.OS === 'web' ? { height: '100%' as any } : {}),
  },
  content: { 
    padding: 16, 
    paddingBottom: 40,
    ...(Platform.OS === 'web' ? { minHeight: '100%' as any } : {}),
  },
  header: { alignItems: 'center', marginBottom: 24 },
  artistImage: { width: 160, height: 160, borderRadius: 80, marginBottom: 16, borderWidth: 3, borderColor: Colors.primary },
  artistName: { color: Colors.textPrimary, fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  openSpotifyBtn: { 
    backgroundColor: Colors.primary, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 24,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openSpotifyText: { color: Colors.black, fontWeight: '700', fontSize: 15 },

  section: { marginBottom: 28 },
  sectionTitle: { 
    color: Colors.textPrimary, 
    fontSize: 20, 
    fontWeight: '900', 
    marginBottom: 16, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase',
    paddingBottom: 8,
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic' },

  // Top tracks - list style with number
  trackRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10, 
    backgroundColor: Colors.surface, 
    borderRadius: 10, 
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackNumber: { width: 28, color: Colors.textTertiary, fontSize: 15, fontWeight: '800', marginRight: 10, textAlign: 'center' },
  trackArt: { width: 52, height: 52, borderRadius: 6, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  trackSub: { color: Colors.textSecondary, fontSize: 13 },
  trackOpenBtn: { 
    paddingHorizontal: 16,
    paddingVertical: 8, 
    borderRadius: 16, 
    backgroundColor: Colors.primary, 
    marginLeft: 8,
  },
  trackOpenIcon: { color: Colors.black, fontSize: 16, fontWeight: '700' },

  // Albums grid
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginHorizontal: -6,
  },
  gridItem: { 
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  gridArt: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 8, 
    marginBottom: 8,
    backgroundColor: Colors.surfaceDark,
  },
  gridName: { 
    color: Colors.textPrimary, 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 3,
    minHeight: 32,
    lineHeight: 16,
  },
  gridYear: { 
    color: Colors.textSecondary, 
    fontSize: 11, 
    marginBottom: 8,
  },
  gridOpenBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  gridOpenText: { color: Colors.black, fontSize: 12, fontWeight: '700' },
});

export default ArtistScreen;
