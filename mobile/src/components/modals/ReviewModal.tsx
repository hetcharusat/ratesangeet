import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Modal, Text, TextInput, useTheme } from 'react-native-paper';
import { createReview, ReviewPayload } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import RSButton from '../ui/RSButton';
import RatingStars from '../ui/RatingStars';

interface ReviewModalProps {
  visible: boolean;
  onDismiss: () => void;
  itemType: 'track' | 'album';
  spotifyId: string;
  itemName: string;
  artistName: string;
  albumArt?: string;
  onSuccess?: () => void;
}

export default function ReviewModal({
  visible,
  onDismiss,
  itemType,
  spotifyId,
  itemName,
  artistName,
  albumArt,
  onSuccess,
}: ReviewModalProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0 || !user) return;
    setSubmitting(true);
    try {
      const payload: ReviewPayload = {
        userId: user.id,
        itemType,
        spotifyId,
        itemName,
        artistName,
        albumArt,
        rating,
        reviewText: reviewText.trim() || undefined,
        isPublic: true,
      };
      await createReview(payload);
      onSuccess?.();
      onDismiss();
      setRating(0);
      setReviewText('');
    } catch (err) {
      console.error('Failed to create review:', err);
    }
    setSubmitting(false);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <ScrollView>
          <Text variant="titleLarge" style={styles.title}>Rate & Review</Text>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.itemName}>{itemName}</Text>
          <Text variant="bodySmall" style={{ opacity: 0.7, marginBottom: 16 }}>{artistName}</Text>

          <View style={styles.ratingRow}>
            <Text variant="labelLarge">Rating</Text>
            <RatingStars value={rating} onChange={setRating} />
          </View>

          <TextInput
            label="Your thoughts (optional)"
            value={reviewText}
            onChangeText={setReviewText}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
          />

          <View style={styles.actions}>
            <RSButton mode="outlined" onPress={onDismiss} disabled={submitting}>Cancel</RSButton>
            <RSButton mode="contained" onPress={handleSubmit} disabled={rating === 0 || submitting} loading={submitting}>
              Submit
            </RSButton>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { margin: 24, borderRadius: 16, padding: 20, maxHeight: '80%' },
  title: { fontWeight: '600', marginBottom: 8 },
  itemName: { fontWeight: '500' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  input: { marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
});
