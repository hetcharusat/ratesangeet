import React from 'react';
import { createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

// Material Design 3 inspired dark theme with Spotify accent
export const md3Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1DB954', // Spotify green
      contrastText: '#0B0F10',
    },
    secondary: {
      main: '#BB86FC',
    },
    background: {
      default: '#0B0F10',
      paper: '#12181B',
    },
    text: {
      primary: '#E6F1F3',
      secondary: '#A7B6BB',
      disabled: '#7D8A8F',
    },
    divider: 'rgba(230,241,243,0.08)'
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 700, fontSize: '2rem' },
    h2: { fontWeight: 700, fontSize: '1.75rem' },
    h3: { fontWeight: 700, fontSize: '1.5rem' },
    h4: { fontWeight: 600, fontSize: '1.25rem' },
    h5: { fontWeight: 600, fontSize: '1.125rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    body1: { fontSize: '0.95rem' },
    body2: { fontSize: '0.85rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(230,241,243,0.06)',
        },
      },
      defaultProps: {
        elevation: 0,
        square: false,
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(230,241,243,0.06)',
          backgroundColor: '#0D1215',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(230,241,243,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});

// Work around TSX parsing issue: write long-form component for baseline
export const Baseline: React.FC = () => React.createElement(CssBaseline, {});
