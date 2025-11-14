import React from 'react';
import { Box, styled } from '@mui/material';

interface WavyProgressProps {
  value: number; // 0-100
  height?: number;
  trackColor?: string;
  waveColor?: string;
  showDot?: boolean;
}

const Root = styled(Box)({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
});

const TrackContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'height',
})<{ height: number }>(({ height }) => ({
  flex: 1,
  position: 'relative',
  borderRadius: height / 2,
  overflow: 'hidden',
  backgroundColor: '#E8E8E8',
  height,
}));

const DottedBackground = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: 0.25,
  backgroundImage: 'radial-gradient(circle, #999 1px, transparent 1px)',
  backgroundSize: '6px 6px',
  pointerEvents: 'none',
});

const ProgressWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'progress',
})<{ progress: number }>(({ progress }) => ({
  position: 'relative',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  width: `${progress * 100}%`,
}));

const WaveSvg = styled('svg')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
});

const InactiveLine = styled(Box, {
  shouldForwardProp: (prop) => !['progress', 'height'].includes(prop as string),
})<{ progress: number; height: number }>(({ progress, height }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  width: `${(1 - progress) * 100}%`,
  paddingRight: height / 2,
}));

const InactiveSvg = styled('svg')({
  width: '100%',
  height: '100%',
});

const HandleCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'height',
})<{ height: number }>(({ height }) => ({
  position: 'absolute',
  right: '-2px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  zIndex: 10,
  width: height + 2,
  height: height + 2,
}));

const HandleShadow = styled(Box)({
  position: 'absolute',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
});

const HandleDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'waveColor',
})<{ waveColor: string }>(({ waveColor }) => ({
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  border: '1.5px solid #FFFFFF',
  backgroundColor: waveColor,
}));

const WavyProgress: React.FC<WavyProgressProps> = ({
  value,
  height = 8,
  trackColor = '#E8E8E8',
  waveColor = '#1DB954',
  showDot = true,
}) => {
  const progress = Math.max(0, Math.min(100, value)) / 100;
  const viewBoxHeight = height;
  const viewBoxWidth = 340;

  // Generate wavy path - bigger waves, no animation
  const generateWavePath = (width: number) => {
    const amplitude = 5;
    const wavelength = 24;
    const points: string[] = [];

    for (let x = 0; x <= width; x += 3) {
      const normalizedX = (x / wavelength) * Math.PI * 2;
      const wave = amplitude * Math.sin(normalizedX);
      const y = viewBoxHeight / 2 + wave;
      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')}`;
  };

  const filledWidth = viewBoxWidth * progress;
  const unfillWidth = viewBoxWidth - filledWidth;

  return (
    <Root>
      <TrackContainer height={height} sx={{ backgroundColor: trackColor }}>
        {/* Dotted background */}
        <DottedBackground />

        {/* Progress wrapper - clips the filled portion */}
        <ProgressWrapper progress={progress}>
          {/* Filled wavy line */}
          <WaveSvg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none">
            {/* Light fill under wave */}
            <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill={waveColor} opacity="0.12" />

            {/* Wavy stroke */}
            <path
              d={generateWavePath(viewBoxWidth)}
              stroke={waveColor}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </WaveSvg>

          {/* Handle circle on filled portion */}
          {showDot && progress > 0 && progress < 1 && (
            <HandleCircle height={height}>
              <HandleShadow />
              <HandleDot waveColor={waveColor} />
            </HandleCircle>
          )}
        </ProgressWrapper>

        {/* Unfilled portion - thin inactive line */}
        {progress < 1 && (
          <InactiveLine progress={progress} height={height}>
            <InactiveSvg viewBox={`0 0 ${unfillWidth} ${viewBoxHeight}`} preserveAspectRatio="none">
              <path
                d={generateWavePath(unfillWidth)}
                stroke="#CCCCCC"
                strokeWidth="1"
                fill="none"
                opacity="0.5"
                strokeLinecap="round"
              />
            </InactiveSvg>
          </InactiveLine>
        )}
      </TrackContainer>
    </Root>
  );
};

export default WavyProgress;
