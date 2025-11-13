import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ProgressBar, useTheme } from 'react-native-paper';

interface AlbumProgressProps {
  percent: number; // 0-100
  uniqueCount: number;
  totalTracks?: number;
  compact?: boolean;
}

/**
 * AlbumProgress - MD3 styled progress indicator for album completion cycles.
 * Shows threshold (70%) and unique track count / total when eligible (>=4 tracks).
 */
export default function AlbumProgress({ percent, uniqueCount, totalTracks, compact }: AlbumProgressProps) {
  const theme = useTheme();
  const showEligible = (totalTracks ?? 0) >= 4;
  const color = percent >= 70 ? theme.colors.primary : theme.colors.secondary;
  return (
    <View style={styles.container}>
      <View style={styles.row}>        
        <ProgressBar progress={percent / 100} color={color} style={[styles.bar, compact && styles.barCompact]} />
        <Text variant="labelSmall" style={styles.percentLabel}>{Math.round(percent)}%</Text>
      </View>
      {showEligible && (
        <Text variant={compact ? 'bodySmall' : 'bodyMedium'} style={styles.subtitle}>
          {uniqueCount} / {totalTracks} unique • {percent >= 70 ? 'Cycle complete ready' : '70% for completion'}
        </Text>
      )}
      {!showEligible && (
        <Text variant={compact ? 'bodySmall' : 'bodyMedium'} style={styles.subtitle}>Less than 4 tracks – not tracked</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bar: { flex: 1, height: 8, borderRadius: 4, marginRight: 8 },
  barCompact: { height: 6 },
  percentLabel: { width: 42, textAlign: 'right', opacity: 0.7 },
  subtitle: { marginTop: 4, opacity: 0.7 },
});
