import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import RatingStars from './RatingStars';

type Props = {
  friendName: string;
  friendAvatar: string;
  albumTitle: string;
  rating: number;
  reviewSnippet: string;
  onPress?: () => void;
};

export default function FriendReviewCard({ friendName, friendAvatar, albumTitle, rating, reviewSnippet, onPress }: Props) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Content style={styles.content}>
          <Image source={{ uri: friendAvatar }} style={styles.avatar} />
          <View style={styles.textContainer}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              <Text style={{ fontWeight: '600' }}>{friendName}</Text> reviewed{' '}
              <Text style={{ fontWeight: '700' }}>{albumTitle}</Text>
            </Text>
            <View style={{ marginVertical: 6 }}>
              <RatingStars value={rating} size={16} readOnly />
            </View>
            <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
              "{reviewSnippet}"
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 8,
  },
  content: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textContainer: {
    flex: 1,
  },
});
