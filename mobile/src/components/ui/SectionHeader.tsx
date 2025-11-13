import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  dense?: boolean;
  style?: object;
};

export default function SectionHeader({ title, subtitle, right, dense, style }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.container, dense && styles.dense, style]}> 
      <View style={styles.left}> 
        <Text variant={dense ? 'titleSmall' : 'titleMedium'} style={{ color: theme.colors.onSurface }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dense: {
    paddingVertical: 8,
  },
  left: { flex: 1 },
  right: { marginLeft: 8 },
});
