import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Pressable } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 32;
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
      <Card>
        <Pressable onPress={() => !isEditMode && onPress()}>
          <Card.Cover source={{ uri: item.image || 'https://via.placeholder.com/150' }} style={styles.itemImage} />
          <Card.Content style={styles.itemTextContainer}>
            <Text variant="bodyMedium" numberOfLines={1}>{item.name}</Text>
            {item.artist && <Text variant="bodySmall" numberOfLines={1}>{item.artist}</Text>}
          </Card.Content>
        </Pressable>
        {isEditMode && (
          <Animated.View style={[styles.deleteButton, { transform: [{ scale: deleteScale }] }]}>
            <IconButton icon="close" size={14} onPress={onRemove} style={styles.deleteIcon} />
          </Animated.View>
        )}
      </Card>
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
      <Card key="add-tile" style={[styles.gridItem, styles.addTile]} onPress={onAdd}>
        <Icon name="plus" size={28} />
        <Text>Add {title}</Text>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { transform: [{ scale: editScale }] }]}>
        <Text variant="titleMedium">{title}</Text>
        <View style={styles.headerActions}>
          {isEditMode && <IconButton icon="content-save" size={20} onPress={onSave} />}
          <IconButton icon={isEditMode ? 'check' : 'pencil'} size={20} onPress={onToggleEdit} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
  },
  itemTextContainer: {
    padding: 6,
    minHeight: 44,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  deleteIcon: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: ITEM_SIZE,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
});
