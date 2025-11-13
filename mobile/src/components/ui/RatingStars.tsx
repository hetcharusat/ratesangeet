import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

type Props = {
  value: number; // 0-5 in 0.5 steps
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
};

export default function RatingStars({ value, onChange, size = 20, readOnly }: Props) {
  const theme = useTheme();
  const stars = [1, 2, 3, 4, 5];
  const handlePress = (i: number) => {
    if (readOnly || !onChange) return;
    onChange(i);
  };

  return (
    <View style={styles.row}>
      {stars.map((i) => {
        const filled = value >= i - 0.01;
        const icon = filled ? 'star' : 'star-outline';
        return (
          <TouchableOpacity onPress={() => handlePress(i)} disabled={readOnly} key={i}>
            <Icon source={icon as any} size={size} color={filled ? theme.colors.primary : theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
