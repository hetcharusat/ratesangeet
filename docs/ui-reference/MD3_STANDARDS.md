# Material Design 3 (MD3) Implementation Guide

## Official Resources
- **Official Docs**: https://m3.material.io/
- **React Native Paper (MD3)**: https://callstack.github.io/react-native-paper/docs/guides/theming
- **Color System**: https://m3.material.io/styles/color/system/overview
- **Components**: https://m3.material.io/components

## Theme System

### Color Roles (Light Theme)
```typescript
primary: '#6750A4'           // Main brand color
onPrimary: '#FFFFFF'         // Text/icons on primary
primaryContainer: '#EADDFF'  // Filled component backgrounds
onPrimaryContainer: '#21005D' // Text on primary container

secondary: '#625B71'         // Secondary brand color
onSecondary: '#FFFFFF'
secondaryContainer: '#E8DEF8'
onSecondaryContainer: '#1D192B'

tertiary: '#7D5260'         // Accent color
onTertiary: '#FFFFFF'
tertiaryContainer: '#FFD8E4'
onTertiaryContainer: '#31111D'

background: '#FFFBFE'       // App background
onBackground: '#1C1B1F'     // Text on background
surface: '#FFFBFE'          // Component surface
onSurface: '#1C1B1F'        // Text on surface
surfaceVariant: '#E7E0EC'   // Alternative surface
onSurfaceVariant: '#49454F' // Text on surface variant

outline: '#79747E'          // Borders, dividers
outlineVariant: '#CAC4D0'   // Subtle borders

error: '#B3261E'            // Error states
onError: '#FFFFFF'
errorContainer: '#F9DEDC'
onErrorContainer: '#410E0B'

elevation: {                // Surface elevation tints
  level0: 'transparent',
  level1: '#F7F2FA',       // 1dp elevation
  level2: '#F3EDF7',       // 3dp elevation
  level3: '#EEE8F4',       // 6dp elevation
  level4: '#EDE7F3',       // 8dp elevation
  level5: '#EBE6F2',       // 12dp elevation
}
```

## Component Guidelines

### Cards
```tsx
// DO: Use elevation mode with explicit level
<Card mode="elevated" elevation={1}>
  <Card.Content>
    <Text variant="titleMedium">Title</Text>
    <Text variant="bodySmall">Body</Text>
  </Card.Content>
</Card>

// DON'T: Hardcode colors or use 'contained' without theme
<Card style={{ backgroundColor: '#fff' }}>
```

### Typography Scale
```tsx
displayLarge     // 57sp, -0.25 tracking
displayMedium    // 45sp, 0 tracking
displaySmall     // 36sp, 0 tracking

headlineLarge    // 32sp, 0 tracking
headlineMedium   // 28sp, 0 tracking
headlineSmall    // 24sp, 0 tracking

titleLarge       // 22sp, 0 tracking
titleMedium      // 16sp, 0.15 tracking
titleSmall       // 14sp, 0.1 tracking

bodyLarge        // 16sp, 0.5 tracking
bodyMedium       // 14sp, 0.25 tracking
bodySmall        // 12sp, 0.4 tracking

labelLarge       // 14sp, 0.1 tracking (buttons)
labelMedium      // 12sp, 0.5 tracking
labelSmall       // 11sp, 0.5 tracking
```

### Spacing (8dp Grid)
```
4dp  - Tight spacing (chips, inline elements)
8dp  - Small spacing (list items, card padding)
12dp - Medium spacing (between sections)
16dp - Default spacing (screen padding, card margins)
24dp - Large spacing (major sections)
32dp - Extra large (top-level sections)
```

### Elevation Levels
```
0dp  - Flat (default surface)
1dp  - Cards, chips (use elevation={1})
3dp  - FAB resting, top app bar (elevation={2})
6dp  - Snackbar (elevation={3})
8dp  - Bottom nav, navigation drawer (elevation={4})
12dp - Modal bottom sheet (elevation={5})
```

### Border Radius
```
Extra small: 4dp  (chips, small buttons)
Small: 8dp        (cards, text fields)
Medium: 12dp      (FAB, dialogs)
Large: 16dp       (large cards, sheets)
Extra large: 28dp (bottom nav)
Full: 9999px      (circular)
```

## Common Patterns

### Card with Content
```tsx
<Card mode="elevated" elevation={1} style={{ borderRadius: 12, margin: 16 }}>
  <Card.Content style={{ paddingVertical: 12 }}>
    <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
      Label
    </Text>
    <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
      Value
    </Text>
  </Card.Content>
</Card>
```

### List Item
```tsx
<List.Item
  title="Title"
  description="Description"
  left={props => <List.Icon {...props} icon="folder" />}
  right={props => <List.Icon {...props} icon="chevron-right" />}
  onPress={() => {}}
/>
```

### Chips
```tsx
<Chip 
  mode="outlined" 
  onPress={() => {}}
  style={{ height: 32 }}
>
  Label
</Chip>
```

### Buttons
```tsx
// Filled (high emphasis)
<Button mode="contained" onPress={() => {}}>Action</Button>

// Filled tonal (medium emphasis)
<Button mode="contained-tonal" onPress={() => {}}>Action</Button>

// Outlined (medium emphasis)
<Button mode="outlined" onPress={() => {}}>Action</Button>

// Text (low emphasis)
<Button mode="text" onPress={() => {}}>Action</Button>
```

## Anti-Patterns (DON'T DO)

### ❌ Hardcoded Colors
```tsx
// BAD
<View style={{ backgroundColor: '#6750A4' }}>
<Text style={{ color: '#FFFFFF' }}>

// GOOD
<View style={{ backgroundColor: theme.colors.primary }}>
<Text style={{ color: theme.colors.onPrimary }}>
```

### ❌ Inconsistent Spacing
```tsx
// BAD
<View style={{ padding: 13, margin: 7 }}>

// GOOD
<View style={{ padding: 12, margin: 8 }}>
```

### ❌ Wrong Card Mode
```tsx
// BAD
<Card mode="contained" style={{ backgroundColor: '#fff' }}>

// GOOD
<Card mode="elevated" elevation={1}>
```

### ❌ Ignoring Typography Variants
```tsx
// BAD
<Text style={{ fontSize: 18, fontWeight: 'bold' }}>

// GOOD
<Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
```

## Checklist for Every Component

- [ ] Uses `useTheme()` hook for colors
- [ ] No hardcoded hex colors
- [ ] Typography uses `variant` prop
- [ ] Spacing follows 8dp grid
- [ ] Cards use `mode="elevated"` with `elevation` prop
- [ ] Border radius matches MD3 scale (4/8/12/16)
- [ ] Proper color contrast (check onBackground, onSurface)
- [ ] Responsive on 360x640 to 414x896
- [ ] Loading states use theme colors
- [ ] Empty states follow MD3 patterns

## Testing Checklist

- [ ] Light theme looks correct
- [ ] Dark theme looks correct (if implemented)
- [ ] No visual glitches on scroll
- [ ] Touch targets ≥48dp
- [ ] Text scales properly (no overflow)
- [ ] Colors have sufficient contrast (WCAG AA)
- [ ] Animations are smooth (60fps)
- [ ] Works on iOS and Android
