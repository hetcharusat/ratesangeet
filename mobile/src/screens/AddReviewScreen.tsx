import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { createReview, getAlbumDetails, Track } from '../services/api';
import StarRating from 'react-native-star-rating-widget';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Text,
  TextInput,
  ToggleButton,
  useTheme,
} from 'react-native-paper';

interface AddReviewScreenProps {
  route: any;
  navigation: any;
}

// ... (interfaces remain the same)

const AddReviewScreen = ({ route, navigation }: AddReviewScreenProps) => {
  const params = route.params;
  const itemType = params.itemType;
  const trackParam = itemType === 'track' ? params.track : null;
  const albumParam = itemType === 'album' ? params.album : null;
  const { user, accessToken } = useAuth();
  const theme = useTheme();

  const [albumDetails, setAlbumDetails] = useState(null);
  const [albumLoading, setAlbumLoading] = useState(itemType === 'album');
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // ... (useEffect for fetching album details remains the same)

  const handleSave = async () => {
    // ... (handleSave logic remains the same, but with Paper components for alerts)
  };

  const coverArt = itemType === 'track'
    ? trackParam?.album?.images?.[0]?.url ?? ''
    : albumParam?.images?.[0]?.url ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView>
        <Card>
          <Card.Cover source={{ uri: coverArt }} />
          <Card.Title
            title={itemType === 'track' ? trackParam?.name : albumParam?.name}
            subtitle={itemType === 'track' ? trackParam?.artists.map(a => a.name).join(', ') : albumParam?.artists.map(a => a.name).join(', ')}
          />
          <Card.Content>
            <StarRating rating={rating} onChange={setRating} />
            <TextInput
              label="Review"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              style={{ marginTop: 16 }}
            />
            <ToggleButton.Row onValueChange={value => setIsPublic(value === 'public')} value={isPublic ? 'public' : 'private'} style={{ marginTop: 16 }}>
              <ToggleButton icon="earth" value="public" />
              <ToggleButton icon="lock" value="private" />
            </ToggleButton.Row>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.goBack()}>Cancel</Button>
            <Button mode="contained" onPress={handleSave} loading={saving}>Save</Button>
          </Card.Actions>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddReviewScreen;
