import React from 'react';
import { Card, CardContent, Typography, Stack } from '@mui/material';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sublabel, loading }) => {
  return (
    <Card sx={{ minWidth: 140 }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>{label}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {loading ? '…' : value}
          </Typography>
          {sublabel && <Typography variant="caption" sx={{ opacity: 0.6 }}>{sublabel}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
};
