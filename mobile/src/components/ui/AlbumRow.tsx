import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  coverUrl: string;
  title: string;
  artist: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  showChevron?: boolean;
};

export default function AlbumRow({ coverUrl, title, artist, onPress, size = 'medium', showChevron = true }: Props) {
  const theme = useTheme();
  const sizeMap = { small: 48, medium: 64, large: 80 };
  const imageSize = sizeMap[size];

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} disabled={!onPress}>
      <Image source={{ uri: coverUrl }} style={[styles.cover, { width: imageSize, height: imageSize }]} />
      <View style={styles.info}>
        <Text variant={size === 'small' ? 'bodyMedium' : 'titleMedium'} numberOfLines={1} style={{ color: theme.colors.onSurface }}>
          {title}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
          {artist}
        </Text>
      </View>
      {showChevron && (
        <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  cover: {
    borderRadius: 8,
  },
  info: {
    flex: 1,
  },
});
