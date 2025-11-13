import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

type BarData = { label: string; value: number; highlighted?: boolean };

type Props = {
  title: string;
  caption?: string;
  data: BarData[];
  maxValue?: number;
};

export default function BarChart({ title, caption, data, maxValue }: Props) {
  const theme = useTheme();
  const max = maxValue || Math.max(...data.map((d) => d.value));

  return (
    <Card style={styles.card} mode="elevated" elevation={1}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {title}
          </Text>
          {caption && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {caption}
            </Text>
          )}
        </View>
        <View style={styles.chartContainer}>
          {data.map((item, idx) => {
            const heightPercent = (item.value / max) * 100;
            const barColor = item.highlighted 
              ? theme.colors.primary 
              : theme.colors.primaryContainer;
            return (
              <View key={idx} style={styles.barWrapper}>
                <View style={[styles.bar, { height: `${heightPercent}%`, backgroundColor: barColor }]} />
                <Text 
                  variant="labelSmall" 
                  style={{ 
                    color: item.highlighted ? theme.colors.primary : theme.colors.onSurfaceVariant, 
                    marginTop: 8, 
                    textAlign: 'center' 
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  header: {
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
    paddingTop: 16,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 8,
  },
});
