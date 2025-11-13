import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

type Props = {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  caption?: string;
  loading?: boolean;
  compact?: boolean;
};

export default function StatCard({ icon, label, value, caption, loading, compact }: Props) {
  const theme = useTheme();
  return (
    <Card 
      style={[styles.card, compact && styles.compact]} 
      mode="elevated"
      elevation={1}
    >
      <Card.Content style={styles.content}>
        <Text 
          variant={compact ? 'labelLarge' : 'titleSmall'} 
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {label}
        </Text>
        {loading ? (
          <Text 
            variant={compact ? 'headlineSmall' : 'headlineMedium'} 
            style={{ color: theme.colors.onSurface, fontWeight: '600' }}
          >
            …
          </Text>
        ) : (
          <Text 
            variant={compact ? 'headlineSmall' : 'headlineMedium'} 
            style={{ color: theme.colors.onSurface, fontWeight: '600' }}
          >
            {value}
          </Text>
        )}
        {caption ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {caption}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    minWidth: 140,
  },
  compact: { 
    minWidth: 110,
  },
  content: { 
    paddingVertical: 12,
  },
});
