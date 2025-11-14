import React, { useState } from 'react';
import { Box, Stack, Typography, Slider } from '@mui/material';
import WavyProgress from '../components/WavyProgress';

export const WavyProgressTestScreen: React.FC = () => {
  const [value, setValue] = useState(45);
  const [value2, setValue2] = useState(75);
  const [value3, setValue3] = useState(15);

  return (
    <Box sx={{ p: 4 }}>
      <Stack spacing={4}>
        <div>
          <Typography variant="h6" sx={{ mb: 2 }}>WavyProgress Component Test</Typography>
          
          <Stack spacing={3}>
            {/* Test 1: Interactive slider */}
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>Interactive ({value}%)</Typography>
              <WavyProgress 
                value={value} 
                height={8} 
                waveColor="#1DB954" 
                trackColor="#E8E8E8"
              />
              <Slider
                value={value}
                onChange={(e, newValue) => setValue(newValue as number)}
                min={0}
                max={100}
                sx={{ mt: 2 }}
              />
            </div>

            {/* Test 2: Different height */}
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>Larger height (12px) - {value2}%</Typography>
              <WavyProgress 
                value={value2} 
                height={12} 
                waveColor="#FF6B6B" 
                trackColor="#F0F0F0"
              />
            </div>

            {/* Test 3: Low progress */}
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>Low progress - {value3}%</Typography>
              <WavyProgress 
                value={value3} 
                height={6} 
                waveColor="#4D96FF" 
                trackColor="#E8E8E8"
              />
            </div>

            {/* Test 4: Full progress */}
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>Full progress - 100%</Typography>
              <WavyProgress 
                value={100} 
                height={10} 
                waveColor="#00D897" 
                trackColor="#E8E8E8"
              />
            </div>

            {/* Test 5: Zero progress */}
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>Zero progress - 0%</Typography>
              <WavyProgress 
                value={0} 
                height={8} 
                waveColor="#1DB954" 
                trackColor="#E8E8E8"
              />
            </div>
          </Stack>
        </div>
      </Stack>
    </Box>
  );
};

export default WavyProgressTestScreen;
