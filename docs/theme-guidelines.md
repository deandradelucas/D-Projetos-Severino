# Theme guidelines

## When to edit each package of styles

- `src/pages/dashboard.css` is the single entrypoint for the authenticated shell. It imports the various theme variants at the top (`dashboard-theme-dark-fullblack.css`, `dashboard-theme-glass-effects.css`, etc.) and contains shared layout, grid, and scroll logic. Prefer editing this file when you need to update layout, sticky behaviors, or theme-independent utilities.
- `dashboard-theme-*.css` files specialize parts of the experience:
  - `*-fullblack` defines the base gradients / buttons for light, dark, and glass.
  - `*-mirror` duplicates the same rules with selectors that only run inside the mirrored style sheet (`dashboard-theme-glass-effects.css` imports the mirrored versions so they override cleanly).
  - `dashboard-theme-glass-effects.css` is loaded last for the glass theme: it softens backgrounds via `color-mix`, adds blur utilities, and may rely on `!important` to beat heavier gradients.

## Variable tokens and overrides

- Global tokens live in `old` sections of `dashboard.css` and in `src/index.css`. Key tokens:
  - `--bg-card`, `--bg-card-elevated`: used for cards / panels; glass uses `color-mix(in srgb, var(--bg-card) X%, transparent)` to keep the photo behind visible.
  - `--glass-blur`: default blur when stacking glass surfaces.
  - `--accent`: shared accent used for outlines and focus rings.
- When you need to brighten a glass panel, tweak the opacity inside the glass effects file rather than editing the mirrored gradients. That keeps the glass theme in sync with the light/dark colors.

## Sticky header / blur cascade

- The sticky header is structured as:
  1. `main.main-content.ref-dashboard-main` (wrapped in `.app-horizon-inner`).
  2. Inside it, `.ref-dashboard-inner > .ref-dashboard-header` for general pages.
  3. On the Dashboard, the header lives inside `.ref-dashboard-actions-card--welcome`.
- Scroll-aware styles use the class `ref-dashboard-main--scrolled` added by `ShellStickyHeaderScroll`. To modify the blur/fade, target the combination of `[data-theme] ... main.ref-dashboard-main--scrolled` selectors in `dashboard.css`, and add any additional `!important` overrides next to the mirrored rules if the glass theme still needs to win.

## Testing and validation

- After touching these CSS files:
  1. Run `npm run lint` to keep ESLint happy.
  2. Run `npm run audit:dashboard-css` if you remove or rename selectors; it checks for unused rules.
  3. Preview in `glass`, `dark`, and `light` by toggling `body[data-theme]` in DevTools to verify the cascading order.

Keeping this doc in sync helps future contributors understand where to land CSS changes without battling specificity wars.
