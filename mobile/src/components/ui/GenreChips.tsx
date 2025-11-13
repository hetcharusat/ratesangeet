import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';

type Props = {
  genres: string[];
  onPress?: (genre: string) => void;
};

export default function GenreChips({ genres, onPress }: Props) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {genres.map((g, idx) => (
        <Chip
          key={idx}
          mode="outlined"
          onPress={() => onPress?.(g)}
          style={styles.chip}
          textStyle={{ color: theme.colors.onSurface }}
          selectedColor={theme.colors.primary}
        >
          {g}
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  chip: {
    height: 32,
  },
});
