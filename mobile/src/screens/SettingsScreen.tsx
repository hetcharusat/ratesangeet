import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Appbar, Text, Switch, useTheme } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getArchiveStats } from '../storage/archiveJob';
import RSButton from '../components/ui/RSButton';

export default function SettingsScreen({ navigation }: any) {
  const { logout } = useAuth();
  const theme = useTheme();
  const [darkMode, setDarkMode] = useState(false);
  const [archiveCount, setArchiveCount] = useState(0);

  useEffect(() => {
    (async () => {
      const stats = await getArchiveStats();
      setArchiveCount(stats?.totalArchived || 0);
    })();
  }, []);

  const handleLogout = () => {
    logout();
    // Navigation happens automatically via AuthContext state change
    // App.tsx renders LoginScreen when user is null
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Settings" />
      </Appbar.Header>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text variant="bodyLarge">Dark Mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>Local Storage</Text>
        <View style={styles.card}>
          <View style={styles.column}>
            <Text variant="bodyLarge" style={{ fontWeight: '500' }}>Archived Scrobbles</Text>
            <Text variant="bodyMedium" style={{ opacity: 0.7, marginTop: 4 }}>
              {archiveCount.toLocaleString()} scrobbles stored locally
            </Text>
            <Text variant="bodySmall" style={{ opacity: 0.6, marginTop: 8 }}>
              Cloud keeps last 90 days; older scrobbles are archived on device
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>About</Text>
        <View style={styles.card}>
          <View style={styles.column}>
            <Text variant="bodyLarge" style={{ fontWeight: '500' }}>RateSangeet</Text>
            <Text variant="bodySmall" style={{ opacity: 0.7, marginTop: 4 }}>Version 2.0.0</Text>
            <Text variant="bodySmall" style={{ opacity: 0.6, marginTop: 8 }}>
              Track, rate, and review your favorite music
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 12 }}>Account</Text>
        <RSButton mode="contained" onPress={handleLogout} style={{ minHeight: 48, borderRadius: 12 }}>
          Logout
        </RSButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { backgroundColor: '#F5F5F5', borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, minHeight: 48 },
  column: { padding: 16 },
});
