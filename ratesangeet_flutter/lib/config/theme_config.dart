import 'package:flutter/material.dart';

ThemeData buildMaterial3Theme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme(
      brightness: Brightness.light,
      primary: Color(0xFF6200EE),
      onPrimary: Color(0xFFFFFFFF),
      secondary: Color(0xFF03DAC6),
      onSecondary: Color(0xFF000000),
      tertiary: Color(0xFF018786),
      onTertiary: Color(0xFFFFFFFF),
      error: Color(0xFFB3261E),
      onError: Color(0xFFFFFFFF),
      background: Color(0xFFFFFBFE),
      onBackground: Color(0xFF1C1B1F),
      surface: Color(0xFFFFFBFE),
      onSurface: Color(0xFF1C1B1F),
    ),
    typography: Typography.material2021(),
    cardTheme: CardThemeData(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
  );
}

/// RateSangeet Pink/Magenta Material Design 3 Dark Theme
ThemeData buildMaterial3DarkTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFFFF4E88), // Hot pink
      onPrimary: Color(0xFFFFFFFF),
      primaryContainer: Color(0xFFD81B60), // Deep pink
      onPrimaryContainer: Color(0xFFFFFFFF),
      secondary: Color(0xFFAB47BC), // Purple
      onSecondary: Color(0xFFFFFFFF),
      secondaryContainer: Color(0xFF8E24AA),
      onSecondaryContainer: Color(0xFFFFFFFF),
      tertiary: Color(0xFFFF6F00), // Orange accent
      onTertiary: Color(0xFFFFFFFF),
      error: Color(0xFFEF5350),
      onError: Color(0xFFFFFFFF),
      background: Color(0xFF0F0A15), // Very dark purple
      onBackground: Color(0xFFFFFFFF),
      surface: Color(0xFF1A1420), // Dark card surface
      onSurface: Color(0xFFFFFFFF),
      surfaceVariant: Color(0xFF2A1F30),
      onSurfaceVariant: Color(0xFFE0E0E0),
      outline: Color(0xFF3A2E42),
      surfaceTint: Color(0xFFFF4E88),
    ),
    scaffoldBackgroundColor: const Color(0xFF0F0A15),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      backgroundColor: Color(0xFF1A1420),
      surfaceTintColor: Color(0xFFFF4E88),
      centerTitle: true,
    ),
    cardTheme: CardThemeData(
      elevation: 2,
      color: const Color(0xFF1A1420),
      surfaceTintColor: const Color(0xFFFF4E88),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      margin: const EdgeInsets.all(8),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        elevation: 4,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF2A1F30),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFFF4E88), width: 2),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: const Color(0xFF2A1F30),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Color(0xFFFF4E88),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFF3A2E42),
      thickness: 1,
    ),
  );
}
