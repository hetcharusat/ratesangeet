import React from 'react';
import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import HistoryIcon from '@mui/icons-material/History';
import AlbumIcon from '@mui/icons-material/Album';
import PersonIcon from '@mui/icons-material/Person';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems: { label: string; path: string; icon: React.ReactElement }[] = [
  { label: 'Home', path: '/', icon: <HomeIcon /> },
  { label: 'History', path: '/history', icon: <HistoryIcon /> },
  { label: 'Albums', path: '/albums', icon: <AlbumIcon /> },
  { label: 'Profile', path: '/profile', icon: <PersonIcon /> },
];

export const AppBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = navItems.findIndex(i => i.path === location.pathname) ?? 0;

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: '1px solid rgba(230,241,243,0.06)' }}>
      <BottomNavigation
        showLabels
        value={current < 0 ? 0 : current}
        onChange={(_, idx) => navigate(navItems[idx].path)}
      >
        {navItems.map(item => (
          <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};
