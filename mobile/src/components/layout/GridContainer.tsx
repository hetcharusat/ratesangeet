import React, { ReactNode } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { layoutTokens } from '../../theme';

type Props = {
  children: ReactNode;
  columns?: 'auto' | 1 | 2 | 3 | 4;
  gap?: number; // multiplier of 8dp
  style?: ViewStyle;
};

/**
 * GridContainer - M3 responsive grid layout
 * Auto-adapts column count based on screen width if columns='auto'
 * Small (< 600): 1 column
 * Medium (600-904): 2 columns
 * Large (905-1239): 3 columns
 * XLarge (>= 1240): 4 columns
 */
export default function GridContainer({ children, columns = 'auto', gap = 2, style }: Props) {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width;
  
  const getColumnCount = (): number => {
    if (columns !== 'auto') return columns;
    
    if (screenWidth < layoutTokens.breakpoints.medium) return 1;
    if (screenWidth < layoutTokens.breakpoints.large) return 2;
    if (screenWidth < layoutTokens.breakpoints.xlarge) return 3;
    return 4;
  };

  const columnCount = getColumnCount();
  const gapSize = layoutTokens.spacing(gap);
  
    // Calculate item flex basis based on columns
    const flexBasis = `${(100 / columnCount) - 1}%` as any;

  return (
    <View style={[styles.container, { gap: gapSize }, style]}>
      {React.Children.map(children, (child) => (
          <View style={[styles.item, { flexBasis, maxWidth: flexBasis, paddingHorizontal: gapSize / 2 }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    marginBottom: layoutTokens.spacing(2),
  },
});
