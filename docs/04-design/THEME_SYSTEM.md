# Centralized Theme System

## ✨ You Have a Theme System!

All your UI styling is centralized in two files:

### 📁 `mobile/src/theme/colors.ts`
**All colors in one place** - change once, apply everywhere

```tsx
import Colors from '../theme/colors';

// Use instead of hardcoded hex values
backgroundColor: Colors.background,    // ✅ Instead of '#121212'
color: Colors.textPrimary,            // ✅ Instead of '#FFFFFF'
borderColor: Colors.border,           // ✅ Instead of '#3A3A3A'
```

### 📁 `mobile/src/theme/commonStyles.ts`
**Reusable style components** - consistent spacing, buttons, cards

```tsx
import { commonStyles } from '../theme/commonStyles';

// Combine with your custom styles
<View style={[commonStyles.card, styles.myCustomCard]}>
<Text style={commonStyles.textPrimary}>Hello</Text>
<TouchableOpacity style={commonStyles.buttonPrimary}>
```

---

## 🎨 Available Colors

### Backgrounds
- `Colors.background` - Main background (#191414)
- `Colors.surface` - Cards, elevated surfaces (#282828)
- `Colors.surfaceLight` - Lighter variant (#3E3E3E)
- `Colors.surfaceDark` - Darker variant (#1A1A1A)

### Primary (Spotify Green)
- `Colors.primary` - Main brand color (#1DB954)
- `Colors.primaryLight` - Hover states (#1ED760)
- `Colors.primaryDark` - Pressed states (#1AA34A)
- `Colors.primaryAlpha` - Transparent backgrounds (#1DB95422)

### Text
- `Colors.textPrimary` - Primary text (#FFFFFF)
- `Colors.textSecondary` - Secondary text (#B3B3B3)
- `Colors.textTertiary` - Tertiary text (#6A6A6A)
- `Colors.textDisabled` - Disabled text (#535353)

### UI Elements
- `Colors.border` - Borders, dividers (#3A3A3A)
- `Colors.borderLight` - Lighter borders (#4A4A4A)
- `Colors.shadow` - Shadows (#000000)
- `Colors.overlay` - Modal overlays (rgba)

### Status
- `Colors.success` - Success states (#1DB954)
- `Colors.error` - Error states (#E22134)
- `Colors.warning` - Warning states (#FFA500)
- `Colors.info` - Info states (#4A90E2)

### Special
- `Colors.skeleton` - Skeleton loaders (#2A2A2A)
- `Colors.placeholder` - Placeholder backgrounds (#333333)
- `Colors.black`, `Colors.white` - Utility colors

---

## 🛠️ Common Styles Available

### Containers
```tsx
commonStyles.safeArea        // SafeAreaView container
commonStyles.container       // Standard container
commonStyles.card           // Card with padding
commonStyles.cardElevated   // Card with shadow/elevation
```

### Headers
```tsx
commonStyles.header         // Header row with spacing
commonStyles.headerTitle    // Large bold header text
commonStyles.headerSubtitle // Small secondary text
```

### Text
```tsx
commonStyles.textPrimary    // Primary text style
commonStyles.textSecondary  // Secondary text style
commonStyles.textBold       // Bold weight
commonStyles.textSemiBold   // Semi-bold weight
```

### Buttons
```tsx
commonStyles.buttonPrimary      // Primary button (green)
commonStyles.buttonPrimaryText  // Primary button text
commonStyles.buttonSecondary    // Secondary button (outline)
```

### Images
```tsx
commonStyles.albumArt       // Standard album art (80x80)
commonStyles.albumArtSmall  // Small album art (50x50)
commonStyles.albumArtLarge  // Large album art (120x120)
```

### Utilities
```tsx
commonStyles.row            // flexDirection: 'row'
commonStyles.center         // Center both axes
commonStyles.spaceBetween   // justifyContent: 'space-between'
commonStyles.mb16          // marginBottom: 16
commonStyles.ph20          // paddingHorizontal: 20
```

---

## 📝 How to Use

### Before (Hardcoded)
```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',  // ❌ Hardcoded
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',            // ❌ Hardcoded
  },
  button: {
    backgroundColor: '#1DB954',  // ❌ Hardcoded
    padding: 12,
    borderRadius: 24,
  },
});
```

### After (Centralized Theme)
```tsx
import Colors from '../theme/colors';
import { commonStyles } from '../theme/commonStyles';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,  // ✅ From theme
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,          // ✅ From theme
  },
  // Or just use common styles:
  // No need to redefine!
});

// In your component:
<View style={commonStyles.container}>
  <Text style={commonStyles.headerTitle}>Title</Text>
  <TouchableOpacity style={commonStyles.buttonPrimary}>
    <Text style={commonStyles.buttonPrimaryText}>Click Me</Text>
  </TouchableOpacity>
</View>
```

---

## 🚀 Benefits

1. **Change Once, Apply Everywhere**
   ```tsx
   // Want to change the primary green?
   // Just edit colors.ts once!
   primary: '#FF6B35',  // Now orange everywhere!
   ```

2. **Dark Mode Ready**
   ```tsx
   // Already set up for dark theme
   // Easy to add light theme later
   ```

3. **Consistent Spacing**
   ```tsx
   // No more random margins
   // mb16, p20, etc. are standardized
   ```

4. **Faster Development**
   ```tsx
   // Reuse common patterns
   <View style={commonStyles.card}>
   // Instead of redefining card styles every time
   ```

---

## 📋 Migration Checklist

### Already Using Theme ✅
- ActivityScreen ✅
- SearchScreen ✅
- ProfileScreen ✅

### Need to Migrate
- HomeScreen ⚠️ (partially done - colors added, not using commonStyles yet)
- ExploreScreen
- HistoryScreen
- AddReviewScreen
- ReviewDetailScreen
- LoginScreen

### How to Migrate a Screen

1. **Add imports:**
   ```tsx
   import Colors from '../theme/colors';
   import { commonStyles } from '../theme/commonStyles';
   ```

2. **Replace hardcoded colors:**
   ```tsx
   // Find: '#121212'
   // Replace: Colors.background
   
   // Find: '#FFFFFF'
   // Replace: Colors.textPrimary
   
   // Find: '#1DB954'
   // Replace: Colors.primary
   ```

3. **Use common styles:**
   ```tsx
   // Instead of redefining:
   <View style={styles.card}>
   
   // Use:
   <View style={commonStyles.card}>
   ```

---

## 🎯 Next Steps

1. **Migrate remaining screens** to use Colors + commonStyles
2. **Add more common patterns** as needed (forms, inputs, modals)
3. **Consider creating** a `Typography` component for text variants
4. **Add** a `Spacing` constant for consistent gaps/margins

**Now you have a professional, scalable theme system!** 🎉
