import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Card, Text, IconButton, useTheme } from 'react-native-paper';
import WavyProgressBar from './WavyProgressBar';

type NowPlayingCardProps = {
  track: {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string }[];
    };
  };
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  onRate?: () => void;
};

export default function NowPlayingCard({
  track,
  progressMs,
  durationMs,
  isPlaying,
  onRate,
}: NowPlayingCardProps) {
  const theme = useTheme();

  const progress = durationMs > 0 ? progressMs / durationMs : 0;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
      mode="elevated"
      elevation={1}
    >
      <Card.Content style={styles.content}>
        {/* Track info row */}
        <View style={styles.row}>
          <Image
            source={{
              uri: track.album.images[0]?.url || 'https://via.placeholder.com/80',
            }}
            style={styles.artwork}
          />

          <View style={styles.trackInfo}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[styles.trackName, { color: theme.colors.onSurface }]}
            >
              {track.name}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {track.artists.map((a) => a.name).join(', ')}
            </Text>
          </View>

          {onRate && (
            <IconButton
              icon="star-outline"
              size={32}
              iconColor={theme.colors.primary}
              onPress={onRate}
              style={styles.rateButton}
            />
          )}
        </View>

        {/* Progress section */}
        <View style={styles.progressContainer}>
          {/* Time labels */}
          <View style={styles.timeRow}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatTime(progressMs)}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatTime(durationMs)}
            </Text>
          </View>

          {/* Material Design 3 Linear Progress Bar */}
          <WavyProgressBar
            value={progress * 100}
            height={8}
            waveColor={theme.colors.primary}
            backgroundColor={theme.colors.surface}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
  },
  content: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  artwork: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  rateButton: {
    margin: 0,
  },
  progressContainer: {
    width: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
