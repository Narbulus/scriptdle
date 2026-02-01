# Agent Guidelines

## Deployment
- This site is deployed automatically to cloudflare pages
- beta branch is on `https://beta.scriptdle.pages.dev/`
- production / main branch is on `https://scriptle.net`

## Generated Content
Daily puzzle files are generated at build time and should not be committed:
- `public/data/daily/` - Per-pack daily puzzle files (intermediate)
- `public/data/daily-all/` - Consolidated daily puzzle files (used by app)

These are created by `npm run generate:daily` during CI/CD builds. The `.gitignore` excludes these directories.

## Testing and Verification
All code changes must be tested and validated using the browser tool.
- **Cross-Device Testing**: You must verify your changes on both desktop web sizes and mobile web sizes.
- **Visual Verification**: Use command line tools or browser interactions to ensure the UI renders correctly across these dimensions.

## Design Guidelines
- **Legibility**: Ensure text is always legible. High contrast between text and background is required.
- **Color Palette**: Use complementary colors. Ensure that different color palettes do not negatively impact text readability.
- **Consistency**: Do not introduce too many varieties of text styling. Stick to the established design system and typography.

## Code Quality
- **Reusable Components**: Prioritize creating and using reusable components. Avoid duplicating code or styles; abstract common patterns into shared components.

---

## Design System & Theming

**Two-Tier Theming**: The app uses two independent themes that apply to different parts of the UI:

- **Main Theme** applies to:
  - Home/main menu screen (navigation, footer, background) — **except pack cards**
  - Script area in game pages (header with pack name, dialogue quotes you guess)

- **Pack Theme** applies to:
  - Pack cards on the home screen
  - All game page UI (navigation, footer, buttons, gameplay controls, title bar)
  - **EXCEPT** menus/modals (Help, History, etc.) which must always use **Main Theme**

- **Design Tokens**: Always use CSS custom properties from `src/styles/main.css` for spacing, typography, radii, shadows, and transitions instead of hardcoded values
- **Theme Scoping**: Use `[data-theme="main"]` and `[data-theme="pack"]` selectors when styling colors for components
- **Testing**: Verify new UI works on both home page and game page, and test theme switching between pages
