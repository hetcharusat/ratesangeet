import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Chip, useTheme, Text } from 'react-native-paper';
import { layoutTokens } from '../../theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * FilterChip - M3 filter chip with selection state
 * Used for filtering content (genres, tags, etc.)
 */
type FilterChipProps = {
  label: string;
  selected?: boolean;
  icon?: string;
  onPress?: () => void;
};

export function FilterChip({ label, selected = false, icon, onPress }: FilterChipProps) {
  const theme = useTheme();

  return (
    <Chip
      mode={selected ? 'flat' : 'outlined'}
      selected={selected}
      onPress={onPress}
      icon={icon ? ({ size, color }) => <MaterialCommunityIcons name={icon} size={size} color={color} /> : undefined}
      style={{
        borderRadius: layoutTokens.roundness.sm,
        backgroundColor: selected ? theme.colors.secondaryContainer : 'transparent',
        borderColor: selected ? 'transparent' : theme.colors.outline,
      }}
      textStyle={{
        color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface,
      }}
    >
      {label}
    </Chip>
  );
}

/**
 * CategoryChip - Read-only chip for displaying categories
 * Similar to badges/tags
 */
type CategoryChipProps = {
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  onPress?: () => void;
};

export function CategoryChip({ label, icon, variant = 'secondary', onPress }: CategoryChipProps) {
  const theme = useTheme();

  const colorMap = {
    primary: {
      bg: theme.colors.primaryContainer,
      text: theme.colors.onPrimaryContainer,
    },
    secondary: {
      bg: theme.colors.secondaryContainer,
      text: theme.colors.onSecondaryContainer,
    },
    tertiary: {
      bg: theme.colors.tertiaryContainer,
      text: theme.colors.onTertiaryContainer,
    },
  };

  const colors = colorMap[variant];

  return (
    <Chip
      mode="flat"
      onPress={onPress}
      icon={icon ? ({ size }) => <MaterialCommunityIcons name={icon} size={size} color={colors.text} /> : undefined}
      style={{
        borderRadius: layoutTokens.roundness.sm,
        backgroundColor: colors.bg,
      }}
      textStyle={{ color: colors.text }}
    >
      {label}
    </Chip>
  );
}

/**
 * CompactChip - Minimal chip for dense layouts
 * No icon, smaller padding
 */
type CompactChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CompactChip({ label, selected = false, onPress }: CompactChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.compactChip,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
          borderRadius: layoutTokens.roundness.xs,
        },
      ]}
    >
      <Text
        variant="labelSmall"
        style={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * ChipRow - Horizontal scrollable row of chips
 * Auto-handles overflow with horizontal scroll
 */
type ChipRowProps = {
  children: React.ReactNode;
  gap?: number; // multiplier of 8dp
};

export function ChipRow({ children, gap = 1 }: ChipRowProps) {
  return (
    <View style={styles.chipRowContainer}>
      <View style={[styles.chipRow, { gap: layoutTokens.spacing(gap) }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactChip: {
    paddingVertical: layoutTokens.spacing(0.5),
    paddingHorizontal: layoutTokens.spacing(1.5),
    alignSelf: 'flex-start',
  },
  chipRowContainer: {
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
