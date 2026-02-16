# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Framework**: Astro 5.0 with static output
- **Styling**: Tailwind CSS (base styles NOT applied automatically - see astro.config.ts)
- **Language**: TypeScript with strict null checks
- **Package Manager**: npm

## Commands

- `npm run dev` - Start dev server & chromium instance with logging at: `dev/logs/dev.log`
- `pm2 restart app` - Restart the dev server
- `npm run build` - Build for production
- `npm run check` - Run all checks (astro check, eslint, prettier)
- `npm run fix` - Auto-fix eslint and prettier issues
- `tail -n 50 dev/logs/dev.log` - Check dev logs for errors
- `pm2 list` - Check running apps
- `cdp-cli` - Browser automation, html inspection, `eval` tests
- `gitingest` - Turn codebase into text digest.txt file for further processing or piping

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
