/**
 * M3 Layout System - Production Components
 * 
 * Auto-responsive grid layout following Material 3 specifications
 * https://m3.material.io/
 * 
 * Usage:
 * ```tsx
 * <Section title="Your Albums" spacing={2}>
 *   <GridContainer columns={2} gap={2}>
 *     <AlbumCard {...albumProps} />
 *     <AlbumCard {...albumProps} />
 *   </GridContainer>
 * </Section>
 * ```
 */

// Core Layout
export { default as GridContainer } from './GridContainer';
export { Section, Row, CardWrapper, Spacer } from './Primitives';

// Micro-Cards
export { AlbumCard, MiniTrackCard, CommentCard } from './MicroCards';

// Chip System
export { FilterChip, CategoryChip, CompactChip, ChipRow } from './ChipSystem';

// Scrollers
export { HorizontalScroller, ScrollerItem } from './HorizontalScroller';

// Comment Thread Manager
export { default as CommentThread } from './CommentThread';
