/**
 * Common Styles - Shared across all screens
 * 
 * Import these to maintain consistency:
 * import { commonStyles } from '../theme/commonStyles';
 */

import { StyleSheet } from 'react-native';
import Colors from './colors';

export const commonStyles = StyleSheet.create({
  // Safe Area & Containers
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Headers
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
  },

  // Cards
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardElevated: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Text Styles
  textPrimary: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  textSecondary: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  textTertiary: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  textBold: {
    fontWeight: 'bold',
  },
  textSemiBold: {
    fontWeight: '600',
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonSecondaryText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },

  // Images
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  albumArtSmall: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  albumArtLarge: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },

  // Empty States
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  skeleton: {
    backgroundColor: Colors.skeleton,
    borderRadius: 8,
  },

  // Spacing Utilities
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  p12: { padding: 12 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  ph20: { paddingHorizontal: 20 },
  pv12: { paddingVertical: 12 },

  // Flexbox Utilities
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  center: { alignItems: 'center', justifyContent: 'center' },
  spaceBetween: { justifyContent: 'space-between' },
  alignCenter: { alignItems: 'center' },
  flex1: { flex: 1 },

  // Borders
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  borderRadius12: { borderRadius: 12 },
  borderRadius16: { borderRadius: 16 },
});

export default commonStyles;
