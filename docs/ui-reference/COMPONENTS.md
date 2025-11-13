# Component Inventory

Reusable MD3 components built for the app. Each uses theme tokens only and supports loading/empty states where relevant.

## ✅ Implemented (v1)

### Atoms
- ✅ **SectionHeader** (`SectionHeader.tsx`): title + optional subtitle + right action slot
- ✅ **SkeletonLine** (`SkeletonLine.tsx`): shimmer placeholder with animated opacity
- ✅ **RatingStars** (`RatingStars.tsx`): 1–5 stars using MD3 icons, read-only or interactive

### Molecules
- ✅ **StatCard** (`StatCard.tsx`): label + value + caption, compact variant + loading state
- ✅ **AlbumRow** (`AlbumRow.tsx`): cover + title + artist + chevron, size variants
- ✅ **GenreChips** (`GenreChips.tsx`): horizontal scrolling genre/tag chips
- ✅ **FriendReviewCard** (`FriendReviewCard.tsx`): friend avatar + album title + rating + review snippet
- ✅ **BarChart** (`BarChart.tsx`): simple bar chart for top albums visualization

### Screens
- ✅ **HomeScreenV2** (`HomeScreenV2.tsx`): MD3 home with stats grid, bar chart, album list, vibe chips, friend reviews

## 🚧 Planned (v2)
- TrackRow: index + title + artist + duration + explicit tag
- ProgressCycleIndicator: shows album completion cycle progress (0-70%)
- EmptyState: illustration + message + action button
- ErrorState: error icon + message + retry button
- SectionListHeader: sticky section headers for history screen
- ToolbarSearch: app bar with integrated search behavior

## 📦 Component Usage
Import from barrel: `import { StatCard, AlbumRow, SectionHeader } from '../components/ui';`

All components respect MD3 theme tokens via `useTheme()` hook and support light/dark modes automatically.