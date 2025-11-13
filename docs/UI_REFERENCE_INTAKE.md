# UI Reference Intake Guide

Use this guide to provide design references (HTML/CSS/JS and screenshots) so we can translate them into React Native + React Native Paper (Material 3) components.

## What to Provide

1) Screenshots (PNG/JPG)
- One per screen/state (Home, History, Album Detail, Profile, Empty states, Loading states)
- Place in `docs/ui-reference/screens/`
- File naming: `01-home.png`, `02-history.png`, `03-album-detail.png`, etc.

2) Reference HTML/CSS/JS (optional but helpful)
- Place in `docs/ui-reference/html/`
- Each screen in its own folder with `index.html`, `styles.css`, and any assets
- Keep CSS variables and class names consistent; we will map them to MD3 components

3) Component inventory (short list)
- In `docs/ui-reference/COMPONENTS.md`, list unique pieces we should build as reusable components
- Example:
  - StatCard (icon + title + value + caption)
  - AlbumRow (cover + title + artist + progress bar)
  - SectionHeader (title + optional action)
  - SkeletonLine / SkeletonCard (loading)
  - RatingStars

4) Mapping notes (what matters most)
- In `docs/ui-reference/MAPPING.md`, tell us which elements are critical (spacing, colors, typography) and which are flexible
- Example:
  - "Use MD3 Baseline Light colors"
  - "Cards have 12dp corner radius"
  - "Compact density for lists"

## Folder Structure Template

```
docs/
  ui-reference/
    screens/
      01-home.png
      02-history.png
      03-album-detail.png
      04-profile.png
    html/
      01-home/
        index.html
        styles.css
      02-history/
        index.html
        styles.css
    COMPONENTS.md
    MAPPING.md
```

## MD3 (Material 3) Implementation Notes

- We use `react-native-paper` (Material Design 3) for mobile
- Theme: MD3 Baseline Light (static) or Spotify-like Dark; both available in `mobile/src/theme/index.ts`
- Components to prefer:
  - Appbar, Surface, Card, List.Item, Button, Chip, Badge, Divider, ProgressBar, TextInput, Snackbar
- Type scale: Use `Text` variants in Paper (`titleLarge`, `titleMedium`, `bodyMedium`, `labelLarge`)
- Spacing: 8dp grid (4/8/12/16/24/32)
- Elevation: low (Card/Surface 1-2), higher on modals/sheets

## How We Translate HTML/CSS to RN Paper

- Containers -> Surface / Card
- Buttons -> Button (mode: contained/outlined/text)
- Badges/Tags -> Chip/Badge
- Lists -> List.Item + Divider
- Progress -> ProgressBar
- Avatars -> Avatar.Image / Avatar.Icon
- Grid -> Flexbox rows/columns with `gap` via `style`

## Acceptance Checklist (per screen)
- Uses MD3 components only (no custom View unless needed)
- Theme tokens only (no hardcoded colors)
- Responsive on small phones (360x640) and large phones (414x896)
- Works on iOS/Android; Web is best-effort
- Loading and empty states included

## Optional: Figma Links
If you have Figma, include links in `MAPPING.md` and export PNGs to `screens/`.

---
If you follow this structure, we can turn your references into reusable RN Paper components quickly and accurately.
