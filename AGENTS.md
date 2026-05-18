# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Framework**: Astro 5.0 with static output
- **Styling**: Tailwind CSS (base styles NOT applied automatically - see astro.config.ts)
- **Language**: TypeScript with strict null checks
- **Package Manager**: Bun v1.3.9

## Critical Non-Obvious Patterns

## Commands

- `bun run dev` - Starts astro dev server as background process with pm2 and logs in `dev/logs/dev.log`
- `bunx pm2 restart astro-dev` - Restart the dev server
- `bun run build` - Build for production
- `bun run check` - Run all checks (astro check, eslint, prettier)
- `bun run fix` - Auto-fix eslint and prettier issues
- `tail -n 50 dev/logs/dev.log` - Check dev logs for errors
- `bunx pm2 list` - Check running apps

In the most cases a `bun run build` or `bun run check` might be enough to check changes.

### Image Handling

- **ALWAYS** use `~/components/common/Image.astro` for images - never raw `<img>` tags.
- Image component throws error if `alt` is undefined/null (required for accessibility).
- Local images must be in `~/assets/images/` and referenced with `~/assets/images/...` path.
- **Dual optimizer**: Local images use Astro Assets optimizer; external images use Unpic optimizer if compatible (detected by `isUnpicCompatible`).
- Image optimization uses custom breakpoints: [16, 32, 48, 64, 96, 128, 256, 384] + device sizes up to 6K.
- `findImage()` in `src/utils/images.ts` resolves paths: `~/assets/images/...` → Vite glob import; absolute URLs pass through.
- OpenGraph images are auto‑optimized via `adaptOpenGraphImages` (same dual optimizer).

### Content & Blog

- Blog posts live in `src/data/post/{locale}/` with locale subdirectories (en, es, fr, de).
- Content collection uses glob loader from `src/data/post` with pattern `*.md,*.mdx`.
- Frontmatter schema in `src/content.config.ts`: publishDate, title, excerpt, image, category, tags, metadata (canonical, openGraph, robots), draft.
- Snippets in `src/data/snippets/` (flat, no locale subdirectories) — markdown content consumed by `MarkdownSlot.astro` component. Translated via UI string pipeline (extracted into JSON catalogs).
- Pages in `src/data/pages/{locale}/` — structural content pages (privacy, terms, markdown demo).
- Permalinks generated via `src/utils/blog.ts` using pattern from `src/config.yaml`.
- Reading time auto-calculated via remark plugin in `src/utils/frontmatter.ts`.
- Tables wrapped in overflow div automatically via rehype plugin.

### Path Aliases & Imports

- `~` alias maps to `src/` (configured in both tsconfig.json and vite alias)
- Use `import { getPermalink } from '~/utils/permalinks'` for all internal links
- Config values imported via `import { SITE, APP_BLOG } from 'astrowind:config'` (virtual module)

### Permalinks & Navigation

- **Permalink system**: `src/utils/permalinks.ts` provides `getPermalink`, `getHomePermalink`, `getBlogPermalink`, `getPagePermalink`, `getAsset`, `getCanonical`.
- **Locale‑aware**: All permalink functions accept optional `locale` parameter. **Pass locale explicitly from `.astro` files** using `Astro.currentLocale`.
- **Strips existing locales**: `getPermalink()` automatically strips existing locale prefixes from paths, allowing `/en/about` → `/es/about`.
- **Trailing slash**: `getPermalink()` respects `SITE.trailingSlash` config.
- **Blog pattern**: Defined in `src/config.yaml` `apps.blog.post.permalink` (default `'/%slug%'`). Variables: `%slug%`, `%year%`, `%month%`, etc.
- **Category/Tag bases**: `CATEGORY_BASE` and `TAG_BASE` derived from config.
- **Navigation**: `src/navigation.ts` exports `getHeaderData(locale)` returning hierarchical menu with translated links. Navigation titles are stored in the JSON catalogs and post-processed like all other UI strings.
- **Canonical URLs**: `getCanonical` constructs absolute URLs respecting `SITE.trailingSlash` and `SITE.site`.

### Configuration

- Site config in `src/config.yaml` (YAML, not JSON/TS). All i18n, blog, metadata, UI settings defined here.
- Custom integration `./vendor/integration` loads config at build time, creates virtual module `astrowind:config`.
- Import config values via `import { SITE, I18N, APP_BLOG, METADATA, UI, ANALYTICS } from 'astrowind:config'`.
- Navigation defined in `src/navigation.ts` – NOT in config file.
- Integration also updates `robots.txt` with sitemap URL automatically after build.

### Typescript

- The Typescript Type Declaration file is at `src/types.d.ts`

### Internationalization (i18n)

- **Custom system** (`src/i18n/`): ~600 lines replacing Wuchale. No external i18n framework dependencies.
- **Architecture**: (1) JSON catalogs per locale in `src/locales/{locale}.json` — simple `{ "English": "Translated" }` maps. (2) HTML post-processing Astro integration — after build, walks `dist/` and replaces English strings in non-English pages. (3) AI auto-translation via Gemini or DeepL at build time for untranslated strings.
- **Translation pipeline**: Extract → merge into EN catalog → sync new keys to target locales → AI translates untranslated entries → save. Only untranslated strings (where msgid === msgstr) trigger AI calls.
- **Markdown content translation** (`src/utils/i18n-md.ts`): Translates `src/data/{post,pages}/en/` → `{es,fr,de}/` using the configured AI provider. Incremental: skips files where output mtime ≥ source mtime (manual edits in target locales survive until source changes).
- **Provider config**: `src/config.yaml` → `i18n.ai.provider` (`'gemini'` or `'deepl'`) and `i18n.ai.geminiApiKey`. Also reads `GEMINI_API_KEY` or `DEEPL_API_KEY` from environment.
- **Locales**: Defined in `src/config.yaml` `i18n.locales`; default locale `i18n.defaultLocale` (English).
- **Routing**: All routes are locale‑prefixed (`/[locale]/...`). `prefixDefaultLocale: true`, `redirectToDefaultLocale: false`.
- **Explicit locale propagation**: `Astro.currentLocale` is only available in `.astro` files. Pass it explicitly to components and utility functions.
- **hreflang tags**: Auto-generated in `src/layouts/Layout.astro`.
- **Key utilities**: `getPermalink(slug, type, locale)` for all internal links; `getStaticPathsForLocale()` for `getStaticPaths` in `[locale]` pages.

### CMS (Content Management)

- **Sveltia CMS** in `public/admin/` — modern, lightweight (300 KB) Git-based CMS, drop-in replacement for Decap/Netlify CMS.
- **Architecture**: Two static files (`index.html` loads JS from CDN, `config.yml` defines collections). Zero npm dependencies, no build changes.
- **Backend**: GitHub API (commits directly to the repo). Auth via personal access token (PAT).
- **Collections**:
  - Blog Posts (`src/data/post/en/`) — English-only editing; Gemini/DeepL handles translation at build time.
  - Snippets (`src/data/snippets/`) — flat markdown files with optional title frontmatter.
- **Deploy flow**: CMS edit → commit to `main` → GitHub Actions triggers → `bun run build` → translate → deploy.
- **No locale editing for blog**: Target locales (es/fr/de) are auto-translated at build time. Manual translation editing can be added later as a separate CMS collection if needed.
- **Legacy**: Old `public/decapcms/` directory removed — was tied to Netlify Identity and wrong content paths.

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
