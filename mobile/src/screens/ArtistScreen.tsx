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
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            {!!artistImage && (
              <Image source={{ uri: artistImage }} style={styles.artistImage} />
            )}
            <Text style={styles.artistName} numberOfLines={2}>{artistName}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Tracks</Text>
            {profile?.topTracks?.map((track) => (
              <TouchableOpacity key={track.id} style={styles.trackItem} onPress={() => openSpotifyTrack(track.id)}>
                <Image source={{ uri: pickImageUrl(track.album?.images) }} style={styles.trackArt} />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackName}>{track.name}</Text>
                  <Text style={styles.trackSub}>{(track.artists || []).map((a) => a?.name).filter(Boolean).join(', ')}</Text>
                </View>
                <Text style={styles.spotifyIcon}>🎵</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Albums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {albums.map((album) => (
                <TouchableOpacity key={album.id} style={styles.albumItem} onPress={() => openAlbumForReview(album)}>
                  <Image source={{ uri: pickImageUrl(album.images) }} style={styles.albumArt} />
                  <Text style={styles.albumName}>{album.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Singles & EPs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {singles.map((single) => (
                <TouchableOpacity key={single.id} style={styles.albumItem} onPress={() => openAlbumForReview(single)}>
                  <Image source={{ uri: pickImageUrl(single.images) }} style={styles.albumArt} />
                  <Text style={styles.albumName}>{single.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compilations</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {compilations.map((compilation) => (
                <TouchableOpacity key={compilation.id} style={styles.albumItem} onPress={() => openAlbumForReview(compilation)}>
                  <Image source={{ uri: pickImageUrl(compilation.images) }} style={styles.albumArt} />
                  <Text style={styles.albumName}>{compilation.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </LoadingState>
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
  },
  artistImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  artistName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
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
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackArt: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: '#fff',
    fontSize: 16,
  },
  trackSub: {
    color: '#999',
    fontSize: 14,
  },
  spotifyIcon: {
    color: '#1DB954',
    fontSize: 24,
  },
  albumItem: {
    width: 150,
    marginRight: 15,
  },
  albumArt: {
    width: '100%',
    height: 150,
  },
  albumName: {
    color: '#fff',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default ArtistScreen;
