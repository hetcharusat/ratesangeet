# M3 Grid System - Production Guide

## Overview
Complete Material Design 3 layout system with auto-responsive grids, micro-components, and consistent spacing. Built following https://m3.material.io/ specifications.

## Core Philosophy
- **Auto-positioning**: No hardcoded pixel values, components auto-fit within system
- **8dp spacing grid**: All spacing uses `layoutTokens.spacing(multiplier)` (8, 16, 24, 32, etc.)
- **Responsive breakpoints**: Auto-adapts columns based on screen width
- **Reusable micro-components**: AlbumCard, MiniTrackCard, CommentCard for consistent UI
- **Production-ready**: Type-safe, theme-aware, follows M3 elevation/roundness tokens

## Layout Tokens

### Spacing
```typescript
layoutTokens.spacing(1)  // 8dp
layoutTokens.spacing(2)  // 16dp
layoutTokens.spacing(3)  // 24dp
layoutTokens.spacing(4)  // 32dp
```

### Roundness
```typescript
layoutTokens.roundness.xs   // 4dp - Compact chips
layoutTokens.roundness.sm   // 8dp - Cards, chips
layoutTokens.roundness.md   // 12dp - Containers
layoutTokens.roundness.lg   // 16dp - Large surfaces
layoutTokens.roundness.xl   // 28dp - Prominent elements
layoutTokens.roundness.full // 9999px - Circles (avatars)
```

### Breakpoints
```typescript
layoutTokens.breakpoints.small   // 360px
layoutTokens.breakpoints.medium  // 600px
layoutTokens.breakpoints.large   // 905px
layoutTokens.breakpoints.xlarge  // 1240px
```

## Components

### GridContainer
Auto-responsive grid that adapts column count based on screen width.

```tsx
<GridContainer columns="auto" gap={2}>
  <AlbumCard {...album1} />
  <AlbumCard {...album2} />
  <AlbumCard {...album3} />
</GridContainer>
```

**Props**:
- `columns`: `'auto' | 1 | 2 | 3 | 4` - Auto adapts or fixed columns
- `gap`: `number` - Gap multiplier (8dp base)
- `style`: `ViewStyle` - Optional override

**Auto Columns**:
- Small (< 600px): 1 column
- Medium (600-904px): 2 columns
- Large (905-1239px): 3 columns
- XLarge (≥ 1240px): 4 columns

### Section
Vertical container with title and consistent spacing.

```tsx
<Section title="Your Albums" spacing={2}>
  <GridContainer columns={2}>
    {/* content */}
  </GridContainer>
</Section>
```

**Props**:
- `title`: `string` - Optional section heading
- `spacing`: `number` - Vertical padding multiplier
- `style`: `ViewStyle`

### Row
Horizontal flex container for inline elements.

```tsx
<Row gap={1} justify="space-between" align="center">
  <FilterChip label="Rock" />
  <FilterChip label="Jazz" />
</Row>
```

**Props**:
- `gap`: `number` - Spacing multiplier
- `justify`: `'flex-start' | 'center' | 'space-between' | 'space-around'`
- `align`: `'flex-start' | 'center' | 'flex-end'`
- `wrap`: `boolean` - Enable flex-wrap

### Spacer
Empty space with consistent sizing.

```tsx
<Spacer size={2} />         // 16dp vertical
<Spacer size={3} horizontal /> // 24dp horizontal
```

## Micro-Components

### AlbumCard
Compact album card with cover image, title, artist, and optional play count.

```tsx
<AlbumCard
  albumId="123"
  albumName="Rumours"
  artistName="Fleetwood Mac"
  albumArt="https://..."
  playCount={45}
  onPress={() => navigateToAlbum('123')}
/>
```

**Features**:
- 1:1 aspect ratio cover
- mode="elevated" elevation={1}
- 8dp border radius
- Auto-fits in GridContainer
- Placeholder icon if no albumArt

### MiniTrackCard
Horizontal track row for lists/scrollers.

```tsx
<MiniTrackCard
  trackId="456"
  trackName="Dreams"
  artistName="Fleetwood Mac"
  albumName="Rumours"
  durationMs={257000}
  isPlaying={true}
  onPress={() => playTrack('456')}
/>
```

**Features**:
- Play indicator icon (dynamic based on isPlaying)
- Duration formatted (3:42)
- Single-line text with ellipsis
- Press feedback

### CommentCard
Nested comment with avatar, reactions, and thread controls.

```tsx
<CommentCard
  username="musicfan92"
  text="This album is incredible!"
  timestamp={new Date()}
  depth={0}
  replyCount={3}
  reactions={{ like: 12, heart: 5 }}
  onReply={() => showReplyBox()}
  onToggleExpand={() => toggleThread()}
  isCollapsed={false}
/>
```

**Features**:
- Nested indentation (max 4 levels)
- Avatar with initial
- Time ago formatting
- Reaction badges
- Reply/expand controls
- YouTube-style threading

## Chip System

### FilterChip
Toggleable filter chip with selection state.

```tsx
<FilterChip
  label="Rock"
  selected={selectedGenre === 'Rock'}
  icon="music"
  onPress={() => setSelectedGenre('Rock')}
/>
```

**Features**:
- mode="outlined" (unselected) / mode="flat" (selected)
- Secondary container colors when selected
- Optional icon

### CategoryChip
Read-only badge/tag chip.

```tsx
<CategoryChip label="Top Rated" icon="star" variant="primary" />
```

**Variants**:
- `primary`: primaryContainer colors
- `secondary`: secondaryContainer colors
- `tertiary`: tertiaryContainer colors

### CompactChip
Minimal chip for dense layouts (no icon).

```tsx
<CompactChip
  label="Alternative"
  selected={tag === 'Alternative'}
  onPress={() => setTag('Alternative')}
/>
```

### ChipRow
Horizontal row with auto-wrapping for chips.

```tsx
<ChipRow gap={1}>
  <FilterChip label="Rock" />
  <FilterChip label="Jazz" />
  <FilterChip label="Electronic" />
</ChipRow>
```

## Scrollers

### HorizontalScroller
YouTube-style horizontal scroller with momentum.

```tsx
<HorizontalScroller title="Top Albums" itemWidth={150} gap={2}>
  {albums.map(album => (
    <AlbumCard key={album.id} {...album} />
  ))}
</HorizontalScroller>
```

**Props**:
- `title`: `string` - Optional title above scroller
- `showArrows`: `boolean` - Show nav arrows (desktop)
- `itemWidth`: `number` - Fixed item width (enables snap)
- `gap`: `number` - Gap multiplier

### ScrollerItem
Wrapper for items without fixed itemWidth.

```tsx
<HorizontalScroller title="Tracks">
  {tracks.map(track => (
    <ScrollerItem key={track.id} width={200}>
      <MiniTrackCard {...track} />
    </ScrollerItem>
  ))}
</HorizontalScroller>
```

## Usage Patterns

### Basic Grid Layout
```tsx
<Section title="Your Albums" spacing={2}>
  <GridContainer columns="auto" gap={2}>
    {albums.map(album => (
      <AlbumCard key={album.id} {...album} />
    ))}
  </GridContainer>
</Section>
```

### Filter + Grid
```tsx
<Section title="Browse Albums" spacing={2}>
  <ChipRow gap={1}>
    <FilterChip label="All" selected={filter === 'All'} />
    <FilterChip label="Rock" selected={filter === 'Rock'} />
  </ChipRow>
  <Spacer size={2} />
  <GridContainer columns={2} gap={2}>
    {filteredAlbums.map(album => (
      <AlbumCard key={album.id} {...album} />
    ))}
  </GridContainer>
</Section>
```

### Horizontal Album Scroller
```tsx
<HorizontalScroller title="Recently Played" itemWidth={150} gap={2}>
  {recentAlbums.map(album => (
    <AlbumCard key={album.id} {...album} />
  ))}
</HorizontalScroller>
```

### Track List
```tsx
<Section title="Top Tracks" spacing={2}>
  <View style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 12 }}>
    {tracks.map((track, index) => (
      <React.Fragment key={track.id}>
        <MiniTrackCard {...track} />
        {index < tracks.length - 1 && <Divider />}
      </React.Fragment>
    ))}
  </View>
</Section>
```

### Nested Comment Thread
```tsx
<Section title="Reviews" spacing={2}>
  {comments.map(comment => (
    <CommentCard
      key={comment.id}
      {...comment}
      depth={comment.depth}
      onReply={() => handleReply(comment.id)}
    />
  ))}
</Section>
```

## Migration Guide

### Old Pattern (Manual Layout)
```tsx
// ❌ Hardcoded positions, no responsive
<View style={{ padding: 16, flexDirection: 'row' }}>
  <View style={{ width: 150, marginRight: 16 }}>
    <Card>...</Card>
  </View>
  <View style={{ width: 150 }}>
    <Card>...</Card>
  </View>
</View>
```

### New Pattern (M3 Grid)
```tsx
// ✅ Auto-responsive, consistent spacing
<Section spacing={2}>
  <GridContainer columns={2} gap={2}>
    <AlbumCard {...album1} />
    <AlbumCard {...album2} />
  </GridContainer>
</Section>
```

## Testing
See `mobile/src/screens/LayoutPlayground.tsx` for interactive examples of all components.

## Best Practices
1. **Always use layoutTokens**: Never hardcode pixel values (8, 16, 24, etc.)
2. **Prefer GridContainer**: Auto-positioning over manual flex/width
3. **Use Spacer**: Consistent vertical/horizontal spacing between sections
4. **Consistent elevation**: All cards use `mode="elevated" elevation={1}`
5. **Theme-aware**: All colors via `theme.colors.*`, no hardcoded hex
6. **Responsive by default**: Use `columns="auto"` unless specific layout needed
7. **Micro-components**: Use AlbumCard/MiniTrackCard instead of custom implementations

## Performance
- GridContainer uses `React.Children.map` (efficient)
- HorizontalScroller has `decelerationRate="fast"` for momentum
- CommentCard depth capped at 4 levels (prevents excessive indentation)
- All components use `memo` where beneficial (future optimization)

## Accessibility
- All pressable components have proper onPress feedback
- Text uses proper Paper variants (titleMedium, bodySmall, etc.)
- Color contrast follows M3 standards (onSurface, onSurfaceVariant)
- Icon sizes consistent (24px for action icons, 14px for badges)

---

**Last Updated**: V2 Grid System Complete
**Status**: Production Ready
**Dependencies**: react-native-paper (MD3), react-native-vector-icons
