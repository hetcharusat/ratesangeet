import React from 'react';
import { Box } from '@mui/material';
import { AppHeader } from './AppHeader';
import { AppBottomNav } from './AppBottomNav';
import { Outlet } from 'react-router-dom';

export const AppLayout: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />
      <Box component="main" sx={{ flex: 1, px: 2, pt: 2, pb: 8, maxWidth: 900, width: '100%', mx: 'auto' }}>
        <Outlet />
      </Box>
      <AppBottomNav />
    </Box>
  );
};
