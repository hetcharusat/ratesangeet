import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getUserScrobbles, Scrobble, getAlbumDetails, getAlbumStats, AlbumStats as CloudAlbumStats } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Divider,
  List,
  Text,
  ToggleButton,
} from 'react-native-paper';

type TabType = 'tracks' | 'albums';
type AlbumFilterType = 'all' | '100%' | '50%+' | '<50%';

interface CompletedAlbum {
  albumName: string;
  artistName: string;
  albumArt: string;
  albumId?: string;
  totalTracks: number;
  listenedTracks: number;
  completionPercent: number;
  totalPlays: number;
  completedPlays?: number;
  lastPlayed: string;
}

const HistoryScreen = () => {
  const { user, accessToken } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('tracks');
  const [albumFilter, setAlbumFilter] = useState<AlbumFilterType>('all');
  const [scrobbles, setScrobbles] = useState<Scrobble[]>([]);
  const [allAlbums, setAllAlbums] = useState<CompletedAlbum[]>([]);
  const [filteredAlbums, setFilteredAlbums] = useState<CompletedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    // ... (loadHistory logic remains the same)
  };

  const applyAlbumFilter = (filter: AlbumFilterType) => {
    // ... (applyAlbumFilter logic remains the same)
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleRate = (scrobble: Scrobble) => {
    // ... (handleRate logic remains the same)
  };

  const openSpotifyTrack = async (trackId: string) => {
    // ... (openSpotifyTrack logic remains the same)
  };

  const handleAlbumClick = async (album: CompletedAlbum) => {
    // ... (handleAlbumClick logic remains the same)
  };

  const renderScrobble = ({ item }: { item: Scrobble }) => (
    <List.Item
      title={item.trackName}
      description={`${item.artistName} - ${item.albumName}`}
      left={props => <Avatar.Image {...props} source={{ uri: item.albumArt }} />}
      right={() => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="spotify" onPress={() => openSpotifyTrack(item.spotifyId)} />
          <IconButton icon="star-plus-outline" onPress={() => handleRate(item)} />
        </View>
      )}
    />
  );

  const renderCompletedAlbum = ({ item }: { item: CompletedAlbum }) => (
    <Card style={{ marginVertical: 8 }} onPress={() => handleAlbumClick(item)}>
      <Card.Title
        title={item.albumName}
        subtitle={item.artistName}
        left={props => <Avatar.Image {...props} source={{ uri: item.albumArt }} />}
      />
      <Card.Content>
        <Text>{`Completion: ${item.completionPercent}%`}</Text>
        <Text>{`Listened: ${item.listenedTracks}/${item.totalTracks}`}</Text>
        <Text>{`Total Plays: ${item.totalPlays}`}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={{ flex: 1 }}>
      <List.Item
        title="Listening History"
        description={`${scrobbles.length} tracks • ${allAlbums.length} albums`}
      />
      <ToggleButton.Row onValueChange={value => setActiveTab(value as TabType)} value={activeTab}>
        <ToggleButton icon="music-note" value="tracks" />
        <ToggleButton icon="album" value="albums" />
      </ToggleButton.Row>

      {activeTab === 'albums' && (
        <ToggleButton.Row onValueChange={value => applyAlbumFilter(value as AlbumFilterType)} value={albumFilter}>
          <ToggleButton icon="format-list-bulleted" value="all" />
          <ToggleButton icon="check-circle" value="100%" />
          <ToggleButton icon="progress-check" value="50%+" />
          <ToggleButton icon="progress-alert" value="<50%" />
        </ToggleButton.Row>
      )}

      {loading ? <ActivityIndicator animating={true} style={{ marginTop: 16 }} /> : (
        activeTab === 'tracks' ? (
          <FlatList
            data={scrobbles.slice(0, 100)}
            renderItem={renderScrobble}
            keyExtractor={(item) => item._id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        ) : (
          <FlatList
            data={filteredAlbums}
            renderItem={renderCompletedAlbum}
            keyExtractor={(item) => item.albumName + item.lastPlayed}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        )
      )}
    </View>
  );
};

export default HistoryScreen;
