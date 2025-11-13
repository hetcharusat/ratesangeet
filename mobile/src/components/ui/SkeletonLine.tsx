import React from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Motion } from '../../theme/tokens';

// Simple animated shimmering line skeleton using MD3 theme colors
export default function SkeletonLine({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: object }) {
  const theme = useTheme();
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: Motion.duration.skeletonPulse / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: Motion.duration.skeletonPulse / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.0] });

  return (
    <Animated.View 
      style={[
        styles.base, 
        { 
          width, 
          height, 
          opacity, 
          backgroundColor: theme.colors.surfaceVariant 
        }, 
        style
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 4,
  },
});
