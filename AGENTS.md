# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Framework**: Astro 6 with static output
- **Styling**: Tailwind CSS (base styles NOT applied automatically - see astro.config.ts)
- **Language**: TypeScript with strict null checks

## Architecture

- **Website Farm model**: One repo, multiple client websites. `main` = base theme; `client/<name>` branches = individual sites.
- **Full architecture docs**: [`docs/client-architecture.md`](docs/client-architecture.md) — branch model, content architecture, widget toolbox, onboarding process, design decisions.
- **Four content directories**: `pages/` (standalone pages), `post/` (blog), `templates/` (data-driven templates with nested YAML), `snippets/` (markdown fragments). Each has a specific translation path.
- **Widgets are immutable on client branches** — compose from existing widgets, never modify widget internals per client. New widgets needed by multiple clients go to `main`.

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
- Snippets in `src/data/snippets/` (flat, no locale subdirectories) — markdown content consumed by `MarkdownSlot.astro` component. Translated via markdown pipeline (target-locale copies written to `{locale}/` subdirs).
- Pages in `src/data/pages/{locale}/` — structural content pages (privacy, terms, markdown demo).
- Templates in `src/data/templates/{locale}/` — data-driven page templates with rich nested YAML frontmatter. Consumed by custom `.astro` pages via `getEntry()`. Translated via markdown pipeline (nested YAML traversal). NOT rendered by any catch-all route.
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
- **Navigation**: `src/utils/auto-navigation.ts` exports `getHeaderData(locale)` and `getFooterData(locale)`. Pages are auto‑scanned from file routes and content collections; each page's `navigation` config (title, showIn, order, group) controls placement. Action buttons and footer secondary links come from `NAVIGATION` in `src/config.yaml`.
- **Canonical URLs**: `getCanonical` constructs absolute URLs respecting `SITE.trailingSlash` and `SITE.site`.

### Configuration

- Site config in `src/config.yaml` (YAML, not JSON/TS). All i18n, blog, metadata, UI settings defined here.
- Custom integration `./vendor/integration` loads config at build time, creates virtual module `astrowind:config`.
- Import config values via `import { SITE, I18N, APP_BLOG, METADATA, UI, ANALYTICS } from 'astrowind:config'`.
- Navigation actions and footer links defined in `src/config.yaml` under `navigation`; page navigation auto-generated by `src/utils/auto-navigation.ts`.
- Integration also updates `robots.txt` with sitemap URL automatically after build.

### Typescript

- The Typescript Type Declaration file is at `src/types.d.ts`

### Internationalization (i18n)

Custom system (`src/i18n/`, ~1500 lines). No external i18n framework dependencies. Source locale comes from `config.yaml` `i18n.defaultLocale`.

**Architecture layers:**
1. **JSON catalogs** (`src/locales/{locale}.json`) — `{ "source string": "translated" }` maps. Keys are the source-locale text (e.g. English). Untranslated entries have value `""` (empty string).
2. **AST-based extraction** (`src/i18n/extract.ts`) — walks `.astro` files via `@astrojs/compiler`, finds translatable text nodes. Also parses **expression prop values** (e.g. `items={[...]}`, `slides={[...]}`) with acorn to extract string literals from JS expressions. Heuristic classifier excludes code, URLs, CSS classes, script contents.
3. **Catalog sync** — New keys from extraction get `""` in target catalogs. Dead keys (removed from all `.astro` files) are pruned from all catalogs automatically during build.
4. **AI translation** — Strings with `""` values are sent to the configured provider (Gemini REST API or DeepL) in batches of 30-50. Retries with exponential backoff.
5. **HTML post-processing** (`src/i18n/postprocess.ts`) — after `astro:build:done`, walks `dist/` HTML, replaces source-locale text with catalog translations via DOM-based full-string matching (htmlparser2). Normalizes Tailwind v4 class reordering for canonical comparison. Script tags excluded.
6. **Markdown content translation** (`src/i18n/markdown.ts`) — translates `src/data/{post,pages}/{sourceLocale}/` → all target locales. Content-addressable manifest (`src/i18n/manifest.ts`) tracks SHA-256 hashes — skips unchanged files even across git clones.

**User story behaviors (verified in v1.2.6):**

| User action | What happens |
|---|---|
| **New `.astro` string** | Extracted → added to source catalog with `""` → synced to target catalogs → AI translates → saved to JSON catalogs |
| **New `.md` file** | Detected by manifest hash mismatch → frontmatter translated line-by-line, body as single block → written to target locale dirs |
| **Modify `.astro` string** | Old key pruned, new key extracted and translated (same flow as new string) |
| **Modify `.md` file** | Manifest hash change triggers re-translation. Manual edits in target files are overwritten when source changes. |
| **Delete `.astro` string** | Pruned from source catalog and all target catalogs automatically during build. |
| **Delete `.md` source file** | Orphan translations in all target locale dirs are cleaned up automatically. Manifest entries removed. |
| **Manual translation edit (catalog)** | Non-empty values in target catalogs are **never overwritten** by AI. Survives all rebuilds. |
| **Manual translation edit (markdown)** | Target files survive until the source `.md` changes. When source changes, the manual edit is lost (re-translated). |
| **Add locale** (add to `config.yaml` `locales`) | New locale gets empty catalog, AI translates all strings + all markdown content. |
| **Remove locale** (remove from `config.yaml`) | Build warns about stale catalog file + content dirs in `src/data/`. Does NOT auto-delete (manual cleanup is safer). |
| **No API key** | Graceful degradation — provider is `null`, translations skipped, source text shown for all locales. Build succeeds. |
| **Provider switch** (change `provider:` in config) | Takes effect on next build. Previously translated strings (non-empty values) are preserved. Untranslated `""` entries are sent to the new provider. |
| **Change source/default locale** (cold start only) | Set `i18n.defaultLocale` in `config.yaml` before first build. All extraction, sync, and post-processing uses this locale as the source. |

**Manifest (`src/locales/.i18n-manifest.json`):**
- `catalogs` section: stores SHA-256 of source catalog JSON. Translation skipped if hash matches + no `""` gaps.
- `markdown` section: stores SHA-256 per source file. Translation skipped if hash matches.
- Manifest is git-safe (content-addressed, not mtime-based).

**Provider config** (`src/config.yaml` → `i18n.ai`):
```yaml
i18n:
  ai:
    provider: 'deepl'        # 'gemini' or 'deepl'
    geminiApiKey: null       # or your key string
    # deeplApiKey: null      # or via DEEPL_API_KEY env var
    # model: 'gemini-2.5-flash'  # only for gemini, only affects markdown body
```
Environment overrides: `GEMINI_API_KEY`, `DEEPL_API_KEY`, `I18N_PROVIDER`, `I18N_MODEL`.

**Key files:**
- `src/i18n/integration.ts` — main orchestration (extract → prune → sync → translate → cleanup + post-process)
- `src/i18n/catalog.ts` — load/save JSON catalogs
- `src/i18n/config.ts` — reads `config.yaml` + env vars, caches singleton
- `src/i18n/extract.ts` — AST-based string extraction (markup, attributes, expression props)
- `src/i18n/heuristic.ts` — string classification (translatable/URL/false)
- `src/i18n/postprocess.ts` — DOM-based HTML string replacement (full-string matching)
- `src/i18n/provider.ts` — Gemini (raw `fetch()`) + DeepL (deepl-node SDK) implementations
- `src/i18n/markdown.ts` — markdown translation + orphan cleanup
- `src/i18n/manifest.ts` — content-addressed manifest management

**Routing:** All routes locale-prefixed (`/[locale]/...`). `prefixDefaultLocale: true`, `redirectToDefaultLocale: false`. Pass `Astro.currentLocale` explicitly from `.astro` files to components. hreflang tags auto-generated in `Layout.astro`.

### CMS (Content Management)

- **Sveltia CMS** in `public/admin/` — modern, lightweight (300 KB) Git-based CMS, drop-in replacement for Decap/Netlify CMS.
- **Architecture**: Two static files (`index.html` loads JS from CDN, `config.yml` defines collections). Zero npm dependencies, no build changes.
- **Backend**: GitHub API (commits directly to the repo). Auth via personal access token (PAT).
- **Collections**:
  - Blog Posts (`src/data/post/en/`) — English-only editing; Gemini/DeepL handles translation at build time.
  - Pages (`src/data/pages/en/`) — standalone pages (privacy, terms) with navigation settings (showIn, order, group).
  - Templates (`src/data/templates/en/`) — data-driven landing pages with rich nested YAML. Define fields matching the actual frontmatter structure per client.
  - Snippets (`src/data/snippets/`) — flat markdown files with optional title frontmatter.
- **Branch-per-client**: `config.yml` `branch` field points to the client's branch (e.g. `client/artesano`). `main`'s CMS edits the base theme; each client branch has its own CMS at its own domain.
- **Deploy flow**: CMS edit → commit to branch → CI/CD triggers → `bun run build` → translate → deploy. `main` uses GitHub Actions → GitHub Pages. Client branches use Netlify Git integration.
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
