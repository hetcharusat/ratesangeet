import React from 'react';
import { Box, Skeleton, Stack } from '@mui/material';

interface LoadingBlockProps {
  lines?: number;
  avatar?: boolean;
}

export const LoadingBlock: React.FC<LoadingBlockProps> = ({ lines = 2, avatar = false }) => {
  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {avatar && <Skeleton variant="circular" width={48} height={48} />}
        <Stack spacing={1} sx={{ flex: 1 }}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={16} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};
