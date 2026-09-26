# Accessibility Plan — SkyTrack

## Automated (now, static)
`tests/a11y/landing.a11y.test.js` asserts: `<html lang>`, search input has accessible name (placeholder/aria-label), map container has role/label fallback text, images/canvas have text alternative note, no `tabindex>0`.
Full axe-core audit arrives with Playwright (later).

## Manual checklist (each cycle)
- [ ] Keyboard: Tab reaches search → map controls → markers/panel; focus visible; Esc closes panel.
- [ ] Screen reader: marker announces callsign + route; detail updates use `aria-live` (gap: add `aria-live="polite"` to panel — file as bug, do NOT fix now).
- [ ] Contrast: body text ≥4.5:1, muted ≥3:1 for large only (note violations, don't restyle now).
- [ ] Targets: controls/markers ≥24px (WCAG 2.2 AA); note small Leaflet default markers.
- [ ] Text scaling 200%: panel readable, no clipping; 360px width: no horizontal scroll.
- [ ] Status: loading/demo/live badge announced; errors in text, never color-only.
