/**
 * Official Color Palette - Spotify-inspired Dark Theme
 * 
 * Primary colors for consistent UI across the app
 */

export const Colors = {
  // Background colors
  background: '#191414',      // Main background (dark black)
  surface: '#282828',         // Cards, elevated surfaces
  surfaceLight: '#3E3E3E',    // Lighter surface variant
  surfaceDark: '#1A1A1A',     // Darker surface variant
  
  // Primary brand colors
  primary: '#1DB954',         // Spotify green - primary actions
  primaryLight: '#1ED760',    // Lighter green for hover states
  primaryDark: '#1AA34A',     // Darker green for pressed states
  primaryAlpha: '#1DB95422',  // Transparent green for backgrounds
  
  // Text colors
  textPrimary: '#FFFFFF',     // Primary text (white)
  textSecondary: '#B3B3B3',   // Secondary text (gray)
  textTertiary: '#6A6A6A',    // Tertiary text (darker gray)
  textDisabled: '#535353',    // Disabled text
  
  // UI element colors
  border: '#3A3A3A',          // Borders, dividers
  borderLight: '#4A4A4A',     // Lighter borders
  shadow: '#000000',          // Shadows
  overlay: 'rgba(0,0,0,0.6)', // Modal overlays
  overlayDark: 'rgba(0,0,0,0.85)', // Darker overlays
  
  // Status colors
  success: '#1DB954',         // Success states
  error: '#E22134',           // Error states
  warning: '#FFA500',         // Warning states
  info: '#4A90E2',            // Info states
  
  // Reaction/interaction colors
  like: '#1DB954',            // Like/thumbs up
  love: '#FF6B9D',            // Love/heart
  fire: '#FF6B35',            // Fire emoji
  sad: '#6B8CFF',             // Sad emoji
  
  // Placeholder/empty states
  placeholder: '#333333',     // Placeholder backgrounds
  skeleton: '#2A2A2A',        // Skeleton loaders
  
  // Semantic colors
  activeTab: '#1DB954',       // Active tab indicator
  inactiveTab: '#B3B3B3',     // Inactive tab
  highlight: '#1DB95433',     // Highlighted items
  focus: '#1DB95466',         // Focus states
  
  // Utility
  transparent: 'transparent',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export type ColorKey = keyof typeof Colors;

export default Colors;
