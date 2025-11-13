import React from 'react';
import { Card, CardContent, Typography, Stack, LinearProgress, Box } from '@mui/material';

interface AlbumCardProps {
  albumId?: string;
  name: string;
  artistName: string;
  albumArt?: string;
  progressPercent?: number; // 0-100
  onClick?: () => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ name, artistName, albumArt, progressPercent = 0, onClick }) => {
  return (
    <Card onClick={onClick} sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 1.5, cursor: onClick ? 'pointer' : 'default' }}>
      <Box sx={{ width: 64, height: 64, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.900', flexShrink: 0 }}>
        {albumArt ? (
          <img src={albumArt} width={64} height={64} style={{ display: 'block', objectFit: 'cover' }} alt="album art" />
        ) : null}
      </Box>
      <CardContent sx={{ p: 0, flex: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>{artistName}</Typography>
          {progressPercent > 0 && (
            <Stack spacing={0.5} sx={{ pt: 0.5 }}>
              <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 6, borderRadius: 999 }} />
              <Typography variant="caption" sx={{ opacity: 0.7 }}>{Math.round(progressPercent)}% complete</Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
