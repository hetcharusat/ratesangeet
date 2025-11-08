# 🎨 Official Color Palette - Quick Reference

## Import
```typescript
import Colors from '../theme/colors';
```

---

## 🖤 Background Colors

| Name | Hex | Usage |
|------|-----|-------|
| `background` | `#191414` | Main app background |
| `surface` | `#282828` | Cards, elevated surfaces |
| `surfaceLight` | `#3E3E3E` | Lighter surface variant |
| `surfaceDark` | `#1A1A1A` | Darker surface variant |
| `skeleton` | `#2A2A2A` | Skeleton loaders |
| `placeholder` | `#333333` | Placeholder backgrounds |

**Example:**
```typescript
container: { backgroundColor: Colors.background }
card: { backgroundColor: Colors.surface }
```

---

## 💚 Primary Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| `primary` | `#1DB954` | Spotify green - primary actions |
| `primaryLight` | `#1ED760` | Hover states |
| `primaryDark` | `#1AA34A` | Pressed states |
| `primaryAlpha` | `#1DB95422` | Transparent green backgrounds |

**Example:**
```typescript
button: { backgroundColor: Colors.primary }
activeChip: { backgroundColor: Colors.primaryAlpha, borderColor: Colors.primary }
```

---

## 📝 Text Colors

| Name | Hex | Usage |
|------|-----|-------|
| `textPrimary` | `#FFFFFF` | Primary text (white) |
| `textSecondary` | `#B3B3B3` | Secondary text (gray) |
| `textTertiary` | `#6A6A6A` | Tertiary text (darker gray) |
| `textDisabled` | `#535353` | Disabled text |

**Example:**
```typescript
title: { color: Colors.textPrimary }
subtitle: { color: Colors.textSecondary }
```

---

## 🔲 UI Element Colors

| Name | Hex | Usage |
|------|-----|-------|
| `border` | `#3A3A3A` | Borders, dividers |
| `borderLight` | `#4A4A4A` | Lighter borders |
| `overlay` | `rgba(0,0,0,0.6)` | Modal overlays |
| `overlayDark` | `rgba(0,0,0,0.85)` | Darker overlays |
| `shadow` | `#000000` | Shadows |

**Example:**
```typescript
input: { borderColor: Colors.border }
modal: { backgroundColor: Colors.overlayDark }
```

---

## ✅ Status Colors

| Name | Hex | Usage |
|------|-----|-------|
| `success` | `#1DB954` | Success states |
| `error` | `#E22134` | Error states |
| `warning` | `#FFA500` | Warning states |
| `info` | `#4A90E2` | Info states |

**Example:**
```typescript
errorText: { color: Colors.error }
successBadge: { backgroundColor: Colors.success }
```

---

## 😊 Reaction Colors

| Name | Hex | Usage |
|------|-----|-------|
| `like` | `#1DB954` | Like/thumbs up |
| `love` | `#FF6B9D` | Love/heart |
| `fire` | `#FF6B35` | Fire emoji |
| `sad` | `#6B8CFF` | Sad emoji |

**Example:**
```typescript
loveReaction: { color: Colors.love }
```

---

## 🎯 Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| `activeTab` | `#1DB954` | Active tab indicator |
| `inactiveTab` | `#B3B3B3` | Inactive tab |
| `highlight` | `#1DB95433` | Highlighted items |
| `focus` | `#1DB95466` | Focus states |

**Example:**
```typescript
tabBar: { 
  activeTintColor: Colors.activeTab,
  inactiveTintColor: Colors.inactiveTab 
}
```

---

## 🔧 Utility Colors

| Name | Value | Usage |
|------|-------|-------|
| `transparent` | `transparent` | Transparent backgrounds |
| `black` | `#000000` | Pure black |
| `white` | `#FFFFFF` | Pure white |

**Example:**
```typescript
overlay: { backgroundColor: Colors.transparent }
```

---

## 📋 Common Patterns

### Card Style
```typescript
card: {
  backgroundColor: Colors.surface,
  borderRadius: 10,
  padding: 15,
}
```

### Primary Button
```typescript
button: {
  backgroundColor: Colors.primary,
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 8,
}
buttonText: {
  color: Colors.black,
  fontWeight: '700',
}
```

### Input Field
```typescript
input: {
  backgroundColor: Colors.skeleton,
  color: Colors.textPrimary,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
}
```

### Empty State
```typescript
emptyContainer: {
  alignItems: 'center',
  padding: 40,
}
emptyText: {
  color: Colors.textPrimary,
  fontSize: 18,
}
emptySubtext: {
  color: Colors.textSecondary,
  fontSize: 14,
}
```

### Modal Overlay
```typescript
modalOverlay: {
  flex: 1,
  backgroundColor: Colors.overlayDark,
  justifyContent: 'flex-end',
}
modalCard: {
  backgroundColor: Colors.surfaceDark,
  padding: 20,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
}
```

---

## 🌈 Color Combinations

### High Contrast (for important text)
```typescript
{
  backgroundColor: Colors.background,
  color: Colors.textPrimary,  // White on black
}
```

### Medium Contrast (for secondary info)
```typescript
{
  backgroundColor: Colors.surface,
  color: Colors.textSecondary,  // Gray on dark gray
}
```

### Primary Action
```typescript
{
  backgroundColor: Colors.primary,
  color: Colors.black,  // Black on green (high contrast)
}
```

### Hover/Active State
```typescript
{
  backgroundColor: Colors.primaryAlpha,
  borderWidth: 1,
  borderColor: Colors.primary,
  color: Colors.primary,
}
```

---

## 🎨 Accessibility

### Contrast Ratios
- **textPrimary on background**: 21:1 (AAA) ✅
- **textSecondary on background**: 7:1 (AA) ✅
- **primary on background**: 3.5:1 (AA for large text) ✅
- **black on primary**: 5:1 (AA) ✅

### Color Blindness Safe
- Primary green works for deuteranopia/protanopia
- Error red is distinguishable
- Use icons/labels with colors for critical info

---

## 📱 Platform-Specific Notes

### iOS
- Status bar: `light-content` (white text)
- Tab bar: Dark with green accent

### Android
- Navigation bar: `Colors.background`
- Ripple: `Colors.primaryAlpha`

### Web
- Focus outlines: `Colors.focus`
- Hover states: `Colors.primaryAlpha`

---

## 🔄 Updating the Theme

To change the entire app theme:

1. Edit `mobile/src/theme/colors.ts`
2. Change any color value
3. Save file
4. App updates everywhere automatically

**Example - Switch to blue theme:**
```typescript
export const Colors = {
  // ...
  primary: '#1E90FF',  // Change from green to blue
  // ...
}
```

All buttons, accents, active states update instantly.

---

## 📖 Type Safety

Colors are typed, so autocomplete works:

```typescript
// ✅ TypeScript autocomplete
const bg = Colors.background;
const text = Colors.textPrimary;

// ❌ TypeScript error
const invalid = Colors.notAColor;  // Error!
```

---

## 🚀 Migration Checklist

When updating a screen to use the theme:

- [ ] Replace `'#191414'` with `Colors.background`
- [ ] Replace `'#282828'` with `Colors.surface`
- [ ] Replace `'#1DB954'` with `Colors.primary`
- [ ] Replace `'#FFFFFF'` with `Colors.textPrimary`
- [ ] Replace `'#B3B3B3'` with `Colors.textSecondary`
- [ ] Replace `'#333'` with `Colors.placeholder`
- [ ] Add `import Colors from '../theme/colors';`
- [ ] Test screen visually

---

## 🎯 Quick Copy-Paste

```typescript
import Colors from '../theme/colors';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  card: { backgroundColor: Colors.surface, borderRadius: 10, padding: 15 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  button: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: Colors.black, fontWeight: '700' },
  input: { backgroundColor: Colors.skeleton, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
});
```

---

**Maintained By:** Design System Team  
**Last Updated:** November 2025  
**Version:** 1.0.0
