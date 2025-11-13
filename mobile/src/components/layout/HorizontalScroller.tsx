import React, { useRef } from 'react';
import { ScrollView, View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { layoutTokens } from '../../theme';

/**
 * HorizontalScroller - Scrollable horizontal list with momentum
 * YouTube-style horizontal scroller with navigation arrows (web)
 */
type HorizontalScrollerProps = {
  children: React.ReactNode;
  title?: string;
  showArrows?: boolean; // Show navigation arrows (desktop)
  itemWidth?: number; // Fixed item width, or auto-fit
  gap?: number; // multiplier of 8dp
  style?: ViewStyle;
};

export function HorizontalScroller({
  children,
  title,
  showArrows = false,
  itemWidth,
  gap = 2,
  style,
}: HorizontalScrollerProps) {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const gapSize = layoutTokens.spacing(gap);

  const handleScrollLeft = () => {
    scrollViewRef.current?.scrollTo({ x: -200, animated: true });
  };

  const handleScrollRight = () => {
    scrollViewRef.current?.scrollTo({ x: 200, animated: true });
  };

  return (
    <View style={[styles.container, style]}>
      {/* Title + Navigation */}
      {title && (
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
            {title}
          </Text>
          {showArrows && (
            <View style={styles.arrowGroup}>
              <IconButton icon="chevron-left" size={20} onPress={handleScrollLeft} />
              <IconButton icon="chevron-right" size={20} onPress={handleScrollRight} />
            </View>
          )}
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={itemWidth ? itemWidth + gapSize : undefined}
        contentContainerStyle={[styles.scrollContent, { gap: gapSize }]}
      >
        {React.Children.map(children, (child, index) =>
          itemWidth ? (
            <View key={index} style={{ width: itemWidth }}>
              {child}
            </View>
          ) : (
            child
          )
        )}
      </ScrollView>
    </View>
  );
}

/**
 * ScrollerItem - Wrapper for consistent item sizing in HorizontalScroller
 * Use when not providing itemWidth to HorizontalScroller
 */
type ScrollerItemProps = {
  children: React.ReactNode;
  width: number; // Fixed width
  style?: ViewStyle;
};

export function ScrollerItem({ children, width, style }: ScrollerItemProps) {
  return <View style={[{ width }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layoutTokens.spacing(2),
    marginBottom: layoutTokens.spacing(1),
  },
  arrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutTokens.spacing(0.5),
  },
  scrollContent: {
    paddingHorizontal: layoutTokens.spacing(2),
    paddingVertical: layoutTokens.spacing(1),
  },
});
