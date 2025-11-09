import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';

// Calculate item size: account for ProfileScreen padding (16*2) + gap between items
const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 32; // ProfileScreen has 16px padding on each side
const GRID_GAP = 10;
const ITEM_SIZE = (width - CONTAINER_PADDING - GRID_GAP) / 2;

interface FavoriteItem {
  id: string;
  name: string;
  artist?: string;
  image?: string;
}

interface FavoritesSectionProps {
  title: string;
  data: FavoriteItem[];
  isEditMode: boolean;
  onToggleEdit: () => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onItemPress: (item: FavoriteItem) => void;
  onSave: () => void;
  maxItems?: number;
}

// Separate component for animated item to avoid hooks issues
const FavoriteItemCard: React.FC<{
  item: FavoriteItem;
  isEditMode: boolean;
  onPress: () => void;
  onRemove: () => void;
}> = ({ item, isEditMode, onPress, onRemove }) => {
  const deleteScale = useRef(new Animated.Value(0)).current;
  const itemOpacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(deleteScale, {
        toValue: isEditMode ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(itemOpacity, {
        toValue: isEditMode ? 0.95 : 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isEditMode, deleteScale, itemOpacity]);

  return (
    <Animated.View style={[styles.gridItem, { opacity: itemOpacity }]}>
      <Pressable
        onPress={() => !isEditMode && onPress()}
        style={styles.itemTouchable}
      >
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/150' }}
          style={styles.itemImage}
        />
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.artist && (
            <Text style={styles.itemArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          )}
        </View>
      </Pressable>
      {isEditMode && (
        <Animated.View style={[styles.deleteButton, { 
          transform: [{ scale: deleteScale }],
          opacity: deleteScale 
        }]}>
          <TouchableOpacity
            onPress={onRemove}
            style={styles.deleteTouch}
          >
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export const FavoritesSection: React.FC<FavoritesSectionProps> = ({
  title,
  data,
  isEditMode,
  onToggleEdit,
  onRemove,
  onAdd,
  onItemPress,
  onSave,
  maxItems = 4,
}) => {
  const editScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(editScale, {
      toValue: isEditMode ? 1.05 : 1,
      useNativeDriver: true,
    }).start();
  }, [isEditMode, editScale]);

  const renderAddTile = () => {
    if (!isEditMode || data.length >= maxItems) return null;

    return (
      <TouchableOpacity
        key="add-tile"
        style={[styles.gridItem, styles.addTile]}
        onPress={onAdd}
      >
        <Text style={styles.addIcon}>+</Text>
        <Text style={styles.addText}>Add {title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { transform: [{ scale: editScale }] }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerActions}>
          {isEditMode && (
            <TouchableOpacity onPress={onSave} style={styles.saveButton}>
              <Text style={styles.saveIcon}>💾</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onToggleEdit} style={styles.editButton}>
            <Text style={styles.editIcon}>{isEditMode ? '✓' : '✎'}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {data.length === 0 && !isEditMode ? (
        <Text style={styles.emptyText}>No {title.toLowerCase()} yet. Tap ✎ to add.</Text>
      ) : (
        <View style={styles.grid}>
          {data.map((item) => (
            <FavoriteItemCard
              key={item.id}
              item={item}
              isEditMode={isEditMode}
              onPress={() => onItemPress(item)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
          {renderAddTile()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  editIcon: {
    fontSize: 14,
    color: Colors.primary,
  },
  saveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIcon: {
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemTouchable: {
    width: '100%',
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.background,
  },
  itemTextContainer: {
    padding: 6,
    minHeight: 44,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemArtist: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error + 'DD',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  deleteTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '50',
    borderStyle: 'dashed',
    backgroundColor: Colors.surface + '80',
    minHeight: ITEM_SIZE + 44,
  },
  addIcon: {
    fontSize: 28,
    color: Colors.primary,
    marginBottom: 4,
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
});
