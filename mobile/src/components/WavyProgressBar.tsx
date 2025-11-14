import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, Rect, Circle, ClipPath, G } from 'react-native-svg';

type WavyProgressBarProps = {
  value: number; // 0-100
  height?: number;
  waveColor?: string;
  backgroundColor?: string;
};

export default function WavyProgressBar({
  value,
  height = 8,
  waveColor = '#1DB954',
  backgroundColor = '#E8E8E8',
}: WavyProgressBarProps) {
  const progress = Math.max(0, Math.min(100, value)) / 100;
  const trackWidth = 340;
  const filledWidth = trackWidth * progress;

  // Generate wavy path with bigger waves - updates based on progress only (no animation)
  const generateWavePath = (width: number) => {
    const amplitude = 5; // Bigger waves
    const wavelength = 24; // Larger wavelength
    const points: string[] = [];

    for (let x = 0; x <= width; x += 3) {
      const normalizedX = (x / wavelength) * Math.PI * 2;
      const wave = amplitude * Math.sin(normalizedX);
      const y = height / 2 + wave;
      points.push(`${x},${y}`);
    }

    return `M ${points.join(' L ')}`;
  };

  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height={height + 10}
        viewBox={`0 0 ${trackWidth} ${height + 10}`}
        preserveAspectRatio="none"
      >
        <Defs>
          {/* Clip path for filled portion */}
          <ClipPath id="waveClip">
            <Rect x="0" y="0" width={filledWidth} height={height} rx={height / 2} />
          </ClipPath>

          {/* Clip path for unfilled portion */}
          <ClipPath id="unfillClip">
            <Rect x={filledWidth} y="0" width={trackWidth - filledWidth} height={height} rx={height / 2} />
          </ClipPath>
        </Defs>

        {/* Background track (pill shape) */}
        <Rect
          x="0"
          y="0"
          width={trackWidth}
          height={height}
          rx={height / 2}
          fill={backgroundColor}
        />

        {/* Dotted pattern background */}
        <G opacity="0.3">
          {Array.from({ length: Math.ceil(trackWidth / 6) }).map((_, i) => (
            <Circle key={`dot-${i}`} cx={i * 6} cy={height / 2} r="0.8" fill="#999" />
          ))}
        </G>

        {/* Filled portion with wavy line */}
        {progress > 0 && (
          <G clipPath="url(#waveClip)">
            {/* Light fill under wave */}
            <Rect x="0" y="0" width={filledWidth} height={height} fill={waveColor} opacity="0.12" />

            {/* Wavy stroke - bigger, no animation */}
            <Path
              d={generateWavePath(filledWidth)}
              stroke={waveColor}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )}

        {/* Unfilled portion (thin line) */}
        {progress < 1 && (
          <G clipPath="url(#unfillClip)">
            <Path
              d={generateWavePath(trackWidth - filledWidth)}
              stroke="#CCCCCC"
              strokeWidth="1"
              fill="none"
              opacity="0.5"
              strokeLinecap="round"
            />
          </G>
        )}

        {/* Handle circle at progress point */}
        {progress > 0 && progress < 1 && (
          <G>
            {/* Shadow */}
            <Circle cx={filledWidth} cy={height / 2} r="5" fill="#000" opacity="0.12" />
            {/* Handle with border */}
            <Circle
              cx={filledWidth}
              cy={height / 2}
              r="4.5"
              fill={waveColor}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
