import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { layoutTokens } from '../../theme';

/**
 * Section - Vertical container with consistent spacing
 * Used for grouping related content with title
 */
type SectionProps = {
  children: ReactNode;
  title?: string;
  spacing?: number; // multiplier of 8dp
  style?: ViewStyle;
};

export function Section({ children, title, spacing = 2, style }: SectionProps) {
  const theme = useTheme();
  const paddingVertical = layoutTokens.spacing(spacing);

  return (
    <View style={[styles.section, { paddingVertical }, style]}>
      {title && (
        <Text variant="titleMedium" style={{ color: theme.colors.onBackground, marginBottom: layoutTokens.spacing(1) }}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

/**
 * Row - Horizontal flex container
 * For inline elements (chips, buttons, etc.)
 */
type RowProps = {
  children: ReactNode;
  gap?: number; // multiplier of 8dp
  justify?: 'flex-start' | 'center' | 'space-between' | 'space-around';
  align?: 'flex-start' | 'center' | 'flex-end';
  wrap?: boolean;
  style?: ViewStyle;
};

export function Row({ children, gap = 1, justify = 'flex-start', align = 'center', wrap = false, style }: RowProps) {
  return (
    <View
      style={[
        styles.row,
        {
          gap: layoutTokens.spacing(gap),
          justifyContent: justify,
          alignItems: align,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * CardWrapper - Adds consistent M3 card padding
 * Use inside Card.Content for proper spacing
 */
type CardWrapperProps = {
  children: ReactNode;
  padding?: number; // multiplier of 8dp
  style?: ViewStyle;
};

export function CardWrapper({ children, padding = 2, style }: CardWrapperProps) {
  return (
    <View style={[styles.cardWrapper, { padding: layoutTokens.spacing(padding) }, style]}>
      {children}
    </View>
  );
}

/**
 * Spacer - Empty space with consistent sizing
 */
type SpacerProps = {
  size?: number; // multiplier of 8dp
  horizontal?: boolean;
};

export function Spacer({ size = 1, horizontal = false }: SpacerProps) {
  const dimension = layoutTokens.spacing(size);
  return <View style={{ [horizontal ? 'width' : 'height']: dimension }} />;
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: layoutTokens.spacing(2),
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  cardWrapper: {
    width: '100%',
  },
});
