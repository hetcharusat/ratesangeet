import React from 'react';
import { Stack, Typography } from '@mui/material';

export const ProfileScreen: React.FC = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Profile</Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }}>Coming soon.</Typography>
    </Stack>
  );
};
