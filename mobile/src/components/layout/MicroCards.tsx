import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { layoutTokens } from '../../theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * AlbumCard - Compact album card with cover + metadata
 * Auto-fits within GridContainer
 */
type AlbumCardProps = {
  albumId: string;
  albumName: string;
  artistName: string;
  albumArt?: string;
  playCount?: number;
  onPress?: () => void;
};

export function AlbumCard({ albumId, albumName, artistName, albumArt, playCount, onPress }: AlbumCardProps) {
  const theme = useTheme();

  return (
    <Card
      mode="elevated"
      elevation={1}
      style={{ borderRadius: layoutTokens.roundness.sm }}
      onPress={onPress}
    >
      <View style={styles.albumCardContainer}>
        {/* Album Cover (1:1 aspect ratio) */}
        <View style={styles.albumCover}>
          {albumArt ? (
            <Image source={{ uri: albumArt }} style={styles.albumImage} resizeMode="cover" />
          ) : (
            <View style={[styles.albumPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="album" size={48} color={theme.colors.onSurfaceVariant} />
            </View>
          )}
        </View>

        {/* Metadata */}
        <View style={styles.albumMeta}>
          <Text
            variant="titleSmall"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ color: theme.colors.onSurface, fontWeight: '600' }}
          >
            {albumName}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {artistName}
          </Text>
          {playCount !== undefined && (
            <View style={styles.playCountBadge}>
              <MaterialCommunityIcons name="play-circle-outline" size={14} color={theme.colors.primary} />
              <Text variant="labelSmall" style={{ color: theme.colors.primary, marginLeft: 4 }}>
                {playCount} plays
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

/**
 * MiniTrackCard - Horizontal track row with metadata
 * For lists/scrollers
 */
type MiniTrackCardProps = {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  durationMs?: number;
  isPlaying?: boolean;
  onPress?: () => void;
};

export function MiniTrackCard({
  trackId,
  trackName,
  artistName,
  albumName,
  durationMs,
  isPlaying,
  onPress,
}: MiniTrackCardProps) {
  const theme = useTheme();

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Pressable onPress={onPress}>
      <View style={[styles.miniTrackContainer, { backgroundColor: theme.colors.surface }]}>
        {/* Play Indicator */}
        <View style={styles.playIndicator}>
          <MaterialCommunityIcons
            name={isPlaying ? 'play-circle' : 'music-note'}
            size={24}
            color={isPlaying ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.onSurface, fontWeight: isPlaying ? '600' : '400' }}
          >
            {trackName}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {artistName} {albumName ? `• ${albumName}` : ''}
          </Text>
        </View>

        {/* Duration */}
        {durationMs && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDuration(durationMs)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * CommentCard - Nested comment with avatar + reactions
 * For review comment threads
 */
type CommentCardProps = {
  username: string;
  text: string;
  timestamp: Date;
  depth?: number;
  replyCount?: number;
  reactions?: { like?: number; heart?: number };
  onReply?: () => void;
  onToggleExpand?: () => void;
  isCollapsed?: boolean;
};

export function CommentCard({
  username,
  text,
  timestamp,
  depth = 0,
  replyCount = 0,
  reactions,
  onReply,
  onToggleExpand,
  isCollapsed,
}: CommentCardProps) {
  const theme = useTheme();
  const indentSize = Math.min(depth, 4) * layoutTokens.spacing(2); // Max 4 levels indent

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <View style={[styles.commentContainer, { marginLeft: indentSize }]}>
      {/* Avatar + Header */}
      <View style={styles.commentHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
            {username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentMeta}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
            {username}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatTimeAgo(timestamp)}
          </Text>
        </View>
      </View>

      {/* Comment Text */}
      {!isCollapsed && (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurface, marginTop: layoutTokens.spacing(1) }}
        >
          {text}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.commentActions}>
        {reactions && (
          <View style={styles.reactionGroup}>
            {reactions.like && reactions.like > 0 && (
              <View style={styles.reactionBadge}>
                <MaterialCommunityIcons name="thumb-up-outline" size={14} color={theme.colors.primary} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 2 }}>
                  {reactions.like}
                </Text>
              </View>
            )}
            {reactions.heart && reactions.heart > 0 && (
              <View style={styles.reactionBadge}>
                <MaterialCommunityIcons name="heart-outline" size={14} color={theme.colors.primary} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 2 }}>
                  {reactions.heart}
                </Text>
              </View>
            )}
          </View>
        )}
        {onReply && (
          <Pressable onPress={onReply}>
            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
              Reply
            </Text>
          </Pressable>
        )}
        {replyCount > 0 && onToggleExpand && (
          <Pressable onPress={onToggleExpand}>
            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
              {isCollapsed ? `Show ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // AlbumCard
  albumCardContainer: {
    width: '100%',
  },
  albumCover: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: layoutTokens.roundness.sm,
    borderTopRightRadius: layoutTokens.roundness.sm,
    overflow: 'hidden',
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumMeta: {
    padding: layoutTokens.spacing(2),
    gap: layoutTokens.spacing(0.5),
  },
  playCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: layoutTokens.spacing(0.5),
  },

  // MiniTrackCard
  miniTrackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layoutTokens.spacing(1.5),
    paddingHorizontal: layoutTokens.spacing(2),
    gap: layoutTokens.spacing(1.5),
  },
  playIndicator: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },

  // CommentCard
  commentContainer: {
    paddingVertical: layoutTokens.spacing(1.5),
    paddingHorizontal: layoutTokens.spacing(2),
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutTokens.spacing(1),
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: layoutTokens.roundness.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentMeta: {
    flex: 1,
    gap: 2,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutTokens.spacing(2),
    marginTop: layoutTokens.spacing(1),
  },
  reactionGroup: {
    flexDirection: 'row',
    gap: layoutTokens.spacing(1),
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layoutTokens.spacing(1),
    paddingVertical: layoutTokens.spacing(0.5),
    borderRadius: layoutTokens.roundness.xs,
  },
});
