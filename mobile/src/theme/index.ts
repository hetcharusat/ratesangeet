import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { Shape } from './tokens';

// M3 Layout Tokens - Based on https://m3.material.io/foundations/layout
export const layoutTokens = {
  baseSpacing: 8, // 8dp grid system
  spacing: (multiplier: number) => multiplier * 8,
  roundness: {
    xs: 4,   // Extra small - chips, small buttons
    sm: 8,   // Small - cards, text fields
    md: 12,  // Medium - FAB, dialogs
    lg: 16,  // Large - large cards, sheets
    xl: 28,  // Extra large - bottom nav
    full: 9999, // Circular
  },
  breakpoints: {
    small: 360,   // 1 column
    medium: 600,  // 2 columns
    large: 905,   // 3 columns
    xlarge: 1240, // 4+ columns
  },
};

// Material 3 Light Theme (Default Baseline)
// Based on official MD3 specs: https://m3.material.io/
export const md3BaselineLight: MD3Theme = {
  ...MD3LightTheme,
  // Ensure all required MD3Theme properties are present
  dark: false,
  mode: 'adaptive',
  // Square edges by default per guide (cards/buttons will override locally)
  roundness: Shape.radius.none,
  colors: {
    ...MD3LightTheme.colors,
    // Primary color palette
    primary: '#6750A4',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EADDFF',
    onPrimaryContainer: '#21005D',

    // Secondary color palette
    secondary: '#625B71',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DEF8',
    onSecondaryContainer: '#1D192B',

    // Tertiary color palette
    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',

    // Error color palette
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    // Background & Surface
    background: '#FFFBFE',
    onBackground: '#1C1B1F',
    surface: '#FFFBFE',
    onSurface: '#1C1B1F',
    surfaceVariant: '#E7E0EC',
    onSurfaceVariant: '#49454F',
    surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
    onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',

    // Outline
    outline: '#79747E',
    outlineVariant: '#CAC4D0',

    // Inverse
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    inversePrimary: '#D0BCFF',

    // Shadow & other
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',

    // Elevation overlays (transparent on light)
    elevation: {
      level0: 'transparent',
      level1: '#F7F2FA',
      level2: '#F3EDF7',
      level3: '#EEE8F4',
      level4: '#EDE7F3',
      level5: '#EBE6F2',
    },
  },
};

// Material 3 Dark Theme (Default Baseline)
export const md3BaselineDark: MD3Theme = {
  ...MD3DarkTheme,
  dark: true,
  mode: 'adaptive',
  roundness: Shape.radius.none,
  colors: {
    ...MD3DarkTheme.colors,
    // Use MD3 default dark colors, not custom Spotify colors
    primary: '#D0BCFF',
    onPrimary: '#381E72',
    primaryContainer: '#4F378B',
    onPrimaryContainer: '#EADDFF',

    secondary: '#CCC2DC',
    onSecondary: '#332D41',
    secondaryContainer: '#4A4458',
    onSecondaryContainer: '#E8DEF8',

    tertiary: '#EFB8C8',
    onTertiary: '#492532',
    tertiaryContainer: '#633B48',
    onTertiaryContainer: '#FFD8E4',

    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',

    background: '#1C1B1F',
    onBackground: '#E6E1E5',
    surface: '#1C1B1F',
    onSurface: '#E6E1E5',
    surfaceVariant: '#49454F',
    onSurfaceVariant: '#CAC4D0',
    surfaceDisabled: 'rgba(230, 225, 229, 0.12)',
    onSurfaceDisabled: 'rgba(230, 225, 229, 0.38)',

    outline: '#938F99',
    outlineVariant: '#49454F',

    inverseSurface: '#E6E1E5',
    inverseOnSurface: '#313033',
    inversePrimary: '#6750A4',

    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',

    elevation: {
      level0: 'transparent',
      level1: '#242329',
      level2: '#29272D',
      level3: '#2D2C32',
      level4: '#2F2E34',
      level5: '#323136',
    },
  },
};

// Helper to choose theme
export const getTheme = (mode: 'light' | 'dark' = 'light'): MD3Theme => {
  return mode === 'light' ? md3BaselineLight : md3BaselineDark;
};
