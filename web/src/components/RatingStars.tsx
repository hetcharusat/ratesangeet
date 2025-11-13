import React from 'react';
import { Box } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

interface RatingStarsProps {
  value: number; // 0-5
  onChange?: (value: number) => void;
}

export const RatingStars: React.FC<RatingStarsProps> = ({ value, onChange }) => {
  const handleClick = (idx: number) => () => onChange?.(idx + 1);
  return (
    <Box sx={{ display: 'flex', gap: 0.5, color: 'primary.main' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={i} component="button" onClick={handleClick(i)} aria-label={`rate-${i+1}`} sx={{ p: 0, m: 0, lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
          {i < value ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        </Box>
      ))}
    </Box>
  );
};
