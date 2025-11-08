# Web Front-End (Expo Web Wrapper)

This directory is a thin wrapper to run the React Native mobile app in a web context using Expo Web.

## Current State
- No separate web layout components exist here.
- All screens come from `../mobile` and already use `ScrollView` / `FlatList` with flex layouts.
- Reported scroll issues likely stem from root container or body overflow not being set explicitly.

## Root Fix Strategy (Not a Patch)
Instead of adding per-screen hacks, enforce consistent full-height flex and scroll behavior at the entry layer:
1. Inject a global CSS reset that ensures `html, body, #root` stretch to 100% height and allow overflow-y auto.
2. Avoid per-screen overflow styling duplication.
3. Maintain dark theme background consistent with mobile.

## Implementation Steps
1. Add `global.css` with base rules.
2. Ensure Expo's web entry loads this stylesheet (via `app.json` or custom HTML template if needed).
3. Provide a small helper for conditional web-only wrappers if future adjustments are needed.

## Added Files
- `global.css`: Core scroll + layout fix.
- `LayoutWeb.tsx`: Optional wrapper to apply consistent padding and fallback styling.

## Future Enhancements
- Add responsive adjustments for large desktop widths.
- Provide keyboard shortcut hints (e.g., refresh, navigate tabs).
- Consider separate navigation chrome for web later (not needed now).

