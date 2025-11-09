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

const { width } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

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
  }, [isEditMode]);

  const renderItem = (item: FavoriteItem) => {
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
    }, [isEditMode]);

    return (
      <Animated.View key={item.id} style={[styles.gridItem, { opacity: itemOpacity }]}>
        <Pressable
          onPress={() => !isEditMode && onItemPress(item)}
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
              onPress={() => onRemove(item.id)}
              style={styles.deleteTouch}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

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

      <View style={styles.grid}>
        {data.map(renderItem)}
        {renderAddTile()}
        {/* Fill empty slots with placeholders when not editing */}
        {!isEditMode &&
          data.length < maxItems &&
          Array.from({ length: maxItems - data.length }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.gridItem, styles.emptySlot]} />
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  editIcon: {
    fontSize: 16,
    color: Colors.primary,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIcon: {
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    padding: 8,
    minHeight: 52,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemArtist: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error + 'DD',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  deleteTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 16,
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
    minHeight: ITEM_SIZE + 52,
  },
  addIcon: {
    fontSize: 32,
    color: Colors.primary,
    marginBottom: 4,
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptySlot: {
    backgroundColor: Colors.surface + '20',
    borderWidth: 1,
    borderColor: Colors.surface,
    minHeight: ITEM_SIZE + 52,
  },
});
