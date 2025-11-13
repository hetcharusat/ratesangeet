import React from 'react';
import { Grid, Typography, Stack } from '@mui/material';
import { StatCard } from '../components/StatCard';
import { AlbumCard } from '../components/AlbumCard';
import { LoadingBlock } from '../components/LoadingBlock';
import { fetchSummaryStats, fetchRecentScrobbles } from '../services/apiClient';

export const HomeScreen: React.FC = () => {
  const [stats, setStats] = React.useState<any>(null);
  const [recent, setRecent] = React.useState<any[]>([]);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const [loadingRecent, setLoadingRecent] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetchSummaryStats().then(s => { if (!cancelled) { setStats(s); setLoadingStats(false); } });
    // Stagger recent load for skeleton feel
    setTimeout(() => {
      fetchRecentScrobbles(10).then(r => { if (!cancelled) { setRecent(r); setLoadingRecent(false); } });
    }, 400);
    return () => { cancelled = true; };
  }, []);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Your Snapshot</Typography>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Listening overview (last 90 days cloud)</Typography>
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={4} sm={3} md={2}>
          <StatCard label="Minutes" value={stats?.totalMinutes ?? 0} loading={loadingStats} />
        </Grid>
        <Grid item xs={4} sm={3} md={2}>
          <StatCard label="Scrobbles" value={stats?.totalScrobbles ?? 0} loading={loadingStats} />
        </Grid>
        <Grid item xs={4} sm={3} md={2}>
          <StatCard label="Artists" value={stats?.uniqueArtistsCount ?? 0} loading={loadingStats} />
        </Grid>
      </Grid>

      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Scrobbles</Typography>
        {loadingRecent && <LoadingBlock lines={3} avatar />}
        <Stack spacing={1.5}>
          {recent.map(r => (
            <AlbumCard key={r.playedAt + r.spotifyId} name={r.trackName} artistName={r.artistName} albumArt={r.albumArt} />
          ))}
          {!loadingRecent && recent.length === 0 && <Typography variant="body2" sx={{ opacity: 0.7 }}>No recent activity.</Typography>}
        </Stack>
      </Stack>
    </Stack>
  );
};
