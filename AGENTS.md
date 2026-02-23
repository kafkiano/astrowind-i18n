# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Framework**: Astro 5.0 with static output
- **Styling**: Tailwind CSS (base styles NOT applied automatically - see astro.config.ts)
- **Language**: TypeScript with strict null checks
- **Package Manager**: Bun v1.3.9

## Commands

- `bun run dev` - Start dev server & chromium instance as background process with pm2 and logs in `dev/logs/dev.log`
- `pm2 restart app` - Restart the dev server
- `bun run build` - Build for production
- `bun run check` - Run all checks (astro check, eslint, prettier)
- `bun run fix` - Auto-fix eslint and prettier issues
- `tail -n 50 dev/logs/dev.log` - Check dev logs for errors
- `pm2 list` - Check running apps

## Critical Non-Obvious Patterns

### Development Environment

- `bun run dev` starts two pm2 processes: Astro dev server (`app`) and a headless Chromium instance (`chromium`) for CDP‑CLI automation.
- Configuration in `dev/dev.config.json`; logs go to `dev/logs/dev.log`.
- Use `pm2 restart app` to restart dev server without killing Chromium.
- Chromium launches with `localhost:4321` open; enables browser automation via `cdp-cli` (see `dev/docs/cdp-cli.md`).

### Image Handling

- **ALWAYS** use `~/components/common/Image.astro` for images - never raw `<img>` tags.
- Image component throws error if `alt` is undefined/null (required for accessibility).
- Local images must be in `~/assets/images/` and referenced with `~/assets/images/...` path.
- **Dual optimizer**: Local images use Astro Assets optimizer; external images use Unpic optimizer if compatible (detected by `isUnpicCompatible`).
- Image optimization uses custom breakpoints: [16, 32, 48, 64, 96, 128, 256, 384] + device sizes up to 6K.
- `findImage()` in `src/utils/images.ts` resolves paths: `~/assets/images/...` → Vite glob import; absolute URLs pass through.
- OpenGraph images are auto‑optimized via `adaptOpenGraphImages` (same dual optimizer).

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

### Permalinks & Navigation

- **Permalink system**: `src/utils/permalinks.ts` provides `getPermalink`, `getBlogPermalink`, `getPagePermalink`, `getAsset`.
- **Locale‑aware**: All permalink functions accept optional `locale` parameter; prepend `/[locale]` automatically.
- **Blog pattern**: Defined in `src/config.yaml` `apps.blog.post.permalink` (default `'/%slug%'`). Variables: `%slug%`, `%year%`, `%month%`, etc.
- **Category/Tag bases**: `CATEGORY_BASE` and `TAG_BASE` derived from config.
- **Navigation**: `src/navigation.ts` exports `getHeaderData(locale)` returning hierarchical menu with translated links via Wuchale.
- **Automatic transformation**: `applyGetPermalinks` recursively processes navigation objects, converting `href` objects (`{type: 'home', url: ...}`) into final URLs.
- **Canonical URLs**: `getCanonical` constructs absolute URLs respecting `SITE.trailingSlash` and `SITE.site`.

### Configuration

- Site config in `src/config.yaml` (YAML, not JSON/TS). All i18n, blog, metadata, UI settings defined here.
- Custom integration `./vendor/integration` loads config at build time, creates virtual module `astrowind:config`.
- Import config values via `import { SITE, I18N, APP_BLOG, METADATA, UI, ANALYTICS } from 'astrowind:config'`.
- Navigation defined in `src/navigation.ts` – NOT in config file.
- Integration also updates `robots.txt` with sitemap URL automatically after build.

### Internationalization (i18n)

- **Hybrid system**: Wuchale (compile‑time string extraction) + Astro i18n routing + content collections.
- **Locales**: Defined in `src/config.yaml` `i18n.locales`; default locale `i18n.defaultLocale`.
- **Wuchale**: Extracts UI strings from source code, generates `.po` files in `src/locales/`. Untranslated strings automatically fall back to source (English).
- **Routing**: All routes are locale‑prefixed (`/[locale]/...`). Default locale also gets prefix (`/en/`).
- **Pages**: Markdown pages live in `src/data/pages/{locale}/`. Missing locale pages fall back to default locale (English) with visual notice.
- **Navigation**: Translated via Wuchale; see `src/navigation.ts` and `wuchale.config.js`.
- **Utilities**: `src/utils/i18n.ts` provides `getLangFromUrl`, `useTranslatedPath`, `getCurrentLocale`.
- **Static paths**: `src/utils/pages.ts` `getStaticPathsPages` generates paths for all locale‑page combos; missing pages fall back.

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
