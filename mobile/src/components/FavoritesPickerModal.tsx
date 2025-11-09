import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
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
      // Reset state when modal closes
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
        // Extract items from the correct property based on type
        const items = type === 'album' 
          ? (data.albums?.items || []) 
          : (data.tracks?.items || []);
        
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
    }, 600); // Increased debounce to 600ms for better batching

    return () => clearTimeout(timer);
  }, [query, type, accessToken]);

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Add {type === 'album' ? 'Album' : 'Track'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder={`Search for ${type}s...`}
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {error && !loading && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <TouchableOpacity 
                onPress={() => {
                  setError(null);
                  setQuery(query + ' '); // Trigger re-search
                  setTimeout(() => setQuery(query.trim()), 0);
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && query.trim() && results.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          )}

          {!loading && !error && !query.trim() && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Type to search Spotify {type}s
              </Text>
            </View>
          )}

          {!loading && !error && results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelect(item)}
                >
                  <Image
                    source={{
                      uri: item.image || 'https://via.placeholder.com/60',
                    }}
                    style={styles.resultImage}
                  />
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </View>
                  <Text style={styles.addIcon}>+</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorContainer: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  resultArtist: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addIcon: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '300',
    marginLeft: 8,
  },
});
