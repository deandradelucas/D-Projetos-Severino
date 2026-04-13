# Theme guidelines

## When to edit each package of styles

- `src/pages/dashboard.css` is the single entrypoint for the authenticated shell. It imports the dark theme variants at the top (`dashboard-theme-dark-mirror.css`, `dashboard-theme-dark-polish.css`, `dashboard-theme-dark-fullblack.css`) and contains shared layout, grid, and scroll logic. Prefer editing this file when you need to update layout, sticky behaviors, or theme-independent utilities.
- `dashboard-theme-*.css` files specialize parts of the dark theme (mirrored from light selectors, polish layer, fullblack accents).

## Variable tokens and overrides

- Global tokens live in the `:root` / `body[data-theme]` sections of `dashboard.css` and in `src/index.css`. Key tokens:
  - `--bg-card`, `--bg-card-elevated`: used for cards / panels.
  - `--sidebar-backdrop-blur`: default blur on the sidebar backdrop.
  - `--accent`: shared accent used for outlines and focus rings.

## Sticky header / blur cascade

- The sticky header is structured as:
  1. `main.main-content.ref-dashboard-main` (wrapped in `.app-horizon-inner`).
  2. Inside it, `.ref-dashboard-inner > .ref-dashboard-header` for general pages.
  3. On the Dashboard, the header lives inside `.ref-dashboard-actions-card--welcome`.
- Scroll-aware styles use the class `ref-dashboard-main--scrolled` added by `ShellStickyHeaderScroll`. To modify the blur/fade, target the combination of `[data-theme] ... main.ref-dashboard-main--scrolled` selectors in `dashboard.css`.

## Testing and validation

- After touching these CSS files:
  1. Run `npm run lint` to keep ESLint happy.
  2. Run `npm run audit:dashboard-css` if you remove or rename selectors; it checks for unused rules.
  3. Preview in `dark` and `light` by toggling `body[data-theme]` in DevTools to verify the cascading order.

Keeping this doc in sync helps future contributors understand where to land CSS changes without battling specificity wars.
