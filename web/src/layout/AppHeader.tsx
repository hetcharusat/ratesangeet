import React from 'react';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

export const AppHeader: React.FC = () => {
  return (
    <AppBar position="static" color="transparent">
      <Toolbar sx={{ display: 'flex', gap: 2 }}>
        <IconButton edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Ratesangeet</Typography>
        <Typography sx={{ ml: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>v2 preview</Typography>
      </Toolbar>
    </AppBar>
  );
};
