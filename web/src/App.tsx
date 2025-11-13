import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { md3Theme, Baseline } from './theme/md3';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';

export default function App() {
  return (
    <ThemeProvider theme={md3Theme}>
      <Baseline />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
