# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Framework**: Astro 5.0 with static output
- **Styling**: Tailwind CSS (base styles NOT applied automatically - see astro.config.ts)
- **Language**: TypeScript with strict null checks
- **Package Manager**: npm

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run check` - Run all checks (astro check, eslint, prettier)
- `npm run fix` - Auto-fix eslint and prettier issues

## Critical Non-Obvious Patterns

### Image Handling

- **ALWAYS** use `~/components/common/Image.astro` for images - never raw `<img>` tags
- Image component throws error if `alt` is undefined/null (required for accessibility)
- Local images must be in `~/assets/images/` and referenced with `~/assets/images/...` path
- External images use unpic optimizer automatically if compatible
- Image optimization uses custom breakpoints: [16, 32, 48, 64, 96, 128, 256, 384] + device sizes up to 6K

### Content & Blog

- Blog posts live in `src/data/post/` (NOT `src/content/` - counterintuitive)
- Content collection uses glob loader from `src/data/post` with pattern `*.md,*.mdx`
- Permalinks generated via `src/utils/blog.ts` using pattern from `src/config.yaml`
- Reading time auto-calculated via remark plugin in `src/utils/frontmatter.ts`
- Tables wrapped in overflow div automatically via rehype plugin

### Path Aliases & Imports

- `~` alias maps to `src/` (configured in both tsconfig.json and vite alias)
- Use `import { getPermalink } from '~/utils/permalinks'` for all internal links
- Config values imported via `import { SITE, APP_BLOG } from 'astrowind:config'` (virtual module)

### Configuration

- Site config in `src/config.yaml` (YAML, not JSON/TS)
- Custom integration `./vendor/integration` loads config as virtual module `astrowind:config`
- Navigation defined in `src/navigation.ts` - NOT in config file

### Styling

- Tailwind base styles NOT applied by integration (see `applyBaseStyles: false` in astro.config.ts)
- Import `~/assets/styles/tailwind.css` manually in layouts
- Custom styles in `src/components/CustomStyles.astro`

### Markdown Processing

- Remark plugins: `readingTimeRemarkPlugin` (adds readingTime to frontmatter)
- Rehype plugins: `responsiveTablesRehypePlugin`, `lazyImagesRehypePlugin`
- MDX supported via `@astrojs/mdx`

### Build Output

- Static site generation (`output: 'static'`)
- Compression enabled via `astro-compress` (CSS, HTML, JS - images/SVG disabled)
- Partytown integration disabled by default (`hasExternalScripts = false`)

### Code Style

- Prettier: 120 char width, single quotes, 2 spaces, trailing commas (es5)
- ESLint: TypeScript strict, unused vars with `_` prefix ignored
- Astro files use `astro-eslint-parser` with TypeScript parser

## Browser Automation with Cdp‑Cli

**Rationale**: Automate front‑end inspection, interaction, and debugging via Chrome DevTools Protocol. Output is NDJSON (newline‑delimited JSON), ideal for parsing with `jq`.

**Since `npm run dev` starts a chromium instance this feature is always available**

### Quick start

```bash
# Extract page titles
# Chromium launches always with a localhost:4321 new tab
cdp-cli tabs | jq -r '.title'

# Inspect page content
cdp-cli snapshot "PAGE_TITLE" --format dom
```

### Command reference

| Category   | Command example                                    | Purpose                   |
| ---------- | -------------------------------------------------- | ------------------------- |
| Navigation | `cdp-cli tabs`                                     | List open pages           |
|            | `cdp-cli new <url>`                                | Create new tab            |
|            | `cdp-cli go <page> <url\|back\|forward\|reload>`   | Navigate                  |
| Inspection | `cdp-cli snapshot <page> [--format ax\|text\|dom]` | Get page structure        |
|            | `cdp-cli console <page> [--verbose\|--all]`        | Retrieve console messages |
|            | `cdp-cli eval <page> "<expression>"`               | Execute JavaScript        |
| Automation | `cdp-cli click <page> <selector>`                  | Click element             |
|            | `cdp-cli fill <page> <text> <selector>`            | Fill input field          |
|            | `cdp-cli key <page> <key>`                         | Press keyboard key        |
| Capture    | `cdp-cli screenshot <page> <output>`               | Take screenshot           |
| Network    | `cdp-cli network <page> [--duration 5]`            | Monitor network requests  |

**Example parsing with `jq`**

```bash
# Filter console errors
cdp-cli console "PAGE_TITLE" --verbose | jq -c 'select(.type == "error")'

# Run eval in chrome
cdp-cli eval "PAGE_TITLE" "javascript code here" | jq -r '.value'
```

### Troubleshooting

- **Page not found**: Use `cdp-cli tabs` to see current page titles.
- **No console output**: Ensure `--duration` is set and page has logged messages.

**Detailed Reference**: Read `dev/docs/cdp-cli.md` for detailed examples and command patterns for `cdp-cli` in a case of heavy debugging.