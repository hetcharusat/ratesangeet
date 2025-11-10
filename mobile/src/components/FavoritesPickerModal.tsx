import React, { useState, useEffect } from 'react';
import { FlatList, View } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  Card,
  IconButton,
  ActivityIndicator,
  Avatar,
  List,
} from 'react-native-paper';
import { searchMusic } from '../services/api';

interface SearchResult {
  id: string;
  name: string;
  artist: string;
  image?: string;
}

interface FavoritesPickerModalProps {
  visible: boolean;
  type: 'album' | 'track';
  accessToken: string;
  onClose: () => void;
  onSelect: (item: SearchResult) => void;
}

export const FavoritesPickerModal: React.FC<FavoritesPickerModalProps> = ({
  visible,
  type,
  accessToken,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchMusic(accessToken, query, type);
        const items = type === 'album' ? data.albums?.items || [] : data.tracks?.items || [];
        
        const mapped = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          artist: item.artists?.[0]?.name || 'Unknown Artist',
          image: item.images?.[0]?.url || item.album?.images?.[0]?.url,
        }));
        setResults(mapped);
      } catch (error: any) {
        console.error('Search error:', error);
        setResults([]);
        if (error.code === 'ECONNABORTED') {
          setError('Search timed out. Please try again.');
        } else if (error.response?.status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError('Search failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [query, type, accessToken, visible]);

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    onClose();
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <List.Item
      title={item.name}
      description={item.artist}
      left={props => <Avatar.Image {...props} source={{ uri: item.image || 'https://via.placeholder.com/60' }} />}
      right={props => <IconButton {...props} icon="plus" onPress={() => handleSelect(item)} />}
      onPress={() => handleSelect(item)}
    />
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onClose} contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20 }}>
        <Card>
          <Card.Title
            title={`Add ${type === 'album' ? 'Album' : 'Track'}`}
            right={(props) => <IconButton {...props} icon="close" onPress={onClose} />}
          />
          <Card.Content>
            <TextInput
              label={`Search for ${type}s...`}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator animating={true} style={{ marginTop: 16 }} />}
            {error && <Text style={{ color: 'red', marginTop: 16 }}>{error}</Text>}
            {!loading && !error && query.trim() && results.length === 0 && (
              <Text style={{ marginTop: 16 }}>No results found</Text>
            )}
            {!loading && !error && !query.trim() && (
              <Text style={{ marginTop: 16 }}>Type to search Spotify {type}s</Text>
            )}
            <FlatList
              data={results}
              renderItem={renderItem}
              keyExtractor={item => item.id}
            />
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );
};
