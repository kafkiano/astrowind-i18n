# 🌍 AstroWind Internationalized

![GitHub License](https://img.shields.io/github/license/kafkiano/astrowind-i18n)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/kafkiano/astrowind-i18n/actions.yaml)
![GitHub last commit](https://img.shields.io/github/last-commit/kafkiano/astrowind-i18n)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/kafkiano/astrowind-i18n/github-code-scanning%2Fcodeql?logo=github&label=CodeQL)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-F472B6?style=flat&logo=bun&logoColor=white)](https://bun.sh)

**AstroWind Internationalized** is a free and open-source template to make your website using **[Astro 6](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/)** with fully automated i18n integration via DeepL or Gemini auto translation. Ready to start a new project and designed taking into account web best practices.

- ✅ **Production-ready** scores in **PageSpeed Insights** reports.
- ✅ Integration with **Tailwind CSS** supporting **Dark mode** and **_RTL_**.
- ✅ **Fast and SEO friendly blog** with automatic **RSS feed**, **MDX** support, **Categories & Tags**, **Social Share**, ...
- ✅ **Image Optimization** (using new **Astro Assets** and **Unpic** for Universal image CDN).
- ✅ Generation of **project sitemap** based on your routes.
- ✅ **Open Graph tags** for social media sharing.
- ✅ **Analytics** built-in Google Analytics, and Splitbee integration.
- ✅ **Internationalization (i18n)** with custom system: JSON catalogs, HTML post-processing, AI-powered translation (Gemini/DeepL).
- ✅ **Git-based CMS** via Sveltia CMS — edit content online, commits trigger automatic redeploy.
- ✅ **Website Farm architecture** — one repo, unlimited client websites. Branch-per-client model keeps the base theme pristine while each client gets their own deployment pipeline.

**AstroWind** tries to give you quick access to creating a website using [Astro 6](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/). It's a free theme which focuses on simplicity, good practices and high performance.

Very little vanilla javascript is used only to provide basic functionality so that each developer decides which framework (React, Vue, Svelte, Solid JS...) to use and how to approach their goals.

In this version the template supports all the options in the `output` configuration, `static`, `hybrid` and `server`, but the blog only works with `prerender = true`. We are working on the next version and aim to make it fully compatible with SSR.

### Project structure

Inside **AstroWind** template, you'll see the following folders and files:

```bash
/
├── public/
│   ├── admin/
│   │   ├── index.html          # Sveltia CMS
│   │   └── config.yml          # CMS collections config
│   ├── _headers
│   └── robots.txt
├── src/
│   ├── assets/
│   │   ├── favicons/
│   │   ├── images/
│   │   └── styles/
│   │       └── tailwind.css
│   ├── components/
│   │   ├── blog/
│   │   ├── common/
│   │   │   ├── Image.astro
│   │   │   ├── MarkdownSlot.astro
│   │   │   └── ...
│   │   ├── ui/
│   │   ├── widgets/
│   │   │   ├── Header.astro
│   │   │   └── ...
│   │   ├── CustomStyles.astro
│   │   ├── Favicons.astro
│   │   └── Logo.astro
│   ├── data/
│   │   ├── post/{locale}/       # Blog posts per locale
│   │   ├── pages/{locale}/      # Standalone content pages per locale
│   │   ├── templates/{locale}/  # Data-driven page templates (nested YAML)
│   │   └── snippets/{locale}/   # Reusable markdown fragments (source in default-locale dir)
│   ├── i18n/                    # Custom i18n system
│   │   ├── catalog.ts           # JSON catalog management
│   │   ├── config.ts            # Configuration (reads config.yaml + env vars)
│   │   ├── extract.ts           # AST-based string extraction
│   │   ├── heuristic.ts         # String classification
│   │   ├── integration.ts       # Astro integration orchestrator
│   │   ├── manifest.ts          # Content-addressed translation manifest
│   │   ├── markdown.ts          # Markdown content translation
│   │   ├── postprocess.ts       # DOM-based HTML post-processing
│   │   └── provider.ts          # Gemini/DeepL AI translation
│   ├── locales/                 # JSON translation catalogs
│   │   ├── en.json              # Default locale string translation file
│   │   └── ...                  # More configured locales
│   ├── layouts/
│   │   ├── Layout.astro
│   │   ├── MarkdownLayout.astro
│   │   └── PageLayout.astro
│   ├── pages/
│   │   └── [locale]
│   │       ├── [...blog]
│   │       │   ├── [category]
│   │       │   └── [tag]
│   │       ├── homes
│   │       ├── landing
│   │       ├── [...pages]
│   │       ├── 404.astro
│   │       ├── index.astro
│   │       └── ...
│   │   ├── index.astro
│   │   ├── rss.xml.ts
│   │   └── ...
│   ├── utils/
│   │   ├── auto-navigation.ts
│   │   ├── blog.ts
│   │   ├── images.ts
│   │   ├── permalinks.ts
│   │   └── ...
│   ├── config.yaml
│   └── content.config.ts
├── .github/workflows/
│   └── actions.yaml             # CI/CD: build + deploy to Pages
├── package.json
├── astro.config.ts
└── ...
```

Astro looks for `.astro` files in the `src/pages/` directory. Each page is exposed as a route based on its file name. Markdown content (`.md`, `.mdx`) lives in `src/data/` and is consumed by content collections.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory if they do not require any transformation or in the `assets/` directory if they are imported directly.

### Commands

All commands are run from the root of the project, from a terminal:

| Command             | Action                                             |
| :------------------ | :------------------------------------------------- |
| `bun install`       | Installs dependencies                              |
| `bun run dev`       | Starts local dev server at `localhost:4321`        |
| `bun run build`     | Build your production site to `./dist/`            |
| `bun run preview`   | Preview your build locally, before deploying       |
| `bun run check`     | Check your project for errors                      |
| `bun run fix`       | Run Eslint and format codes with Prettier          |
| `bun run astro ...` | Run CLI commands like `astro add`, `astro preview` |

### Configuration

Basic configuration file: `./src/config.yaml`

```yaml
site:
  name: 'Example'
  site: 'https://example.com'
  base: '/' # Change this if you need to deploy to Github Pages, for example
  trailingSlash: false # Generate permalinks with or without "/" at the end

  googleSiteVerificationId: false # Or some value,

# Default SEO metadata
metadata:
  title:
    default: 'Example'
    template: '%s — Example'
  description: 'This is the default meta description of Example website'
  robots:
    index: true
    follow: true
  openGraph:
    site_name: 'Example'
    images:
      - url: '~/assets/images/og-default.jpg'
        width: 1200
        height: 628
    type: website
  twitter:
    handle: '@twitter_user'
    site: '@twitter_user'
    cardType: summary_large_image

i18n:
  language: en
  textDirection: ltr
  locales: ['en', 'es', 'fr', 'de', 'ar']
  defaultLocale: en
  localeNames:
    en: English
    es: Español
    fr: Français
    de: Deutsch
    ar: العربية
  localeDirections:
    ar: rtl
  ai:
    provider: 'deepl' # 'gemini' or 'deepl'

apps:
  blog:
    isEnabled: true # If the blog will be enabled
    postsPerPage: 6 # Number of posts per page

    post:
      isEnabled: true
      permalink: '/blog/%slug%' # Variables: %slug%, %year%, %month%, %day%, %hour%, %minute%, %second%, %category%
      robots:
        index: true

    list:
      isEnabled: true
      pathname: 'blog' # Blog main path, you can change this to "articles" (/articles)
      robots:
        index: true

    category:
      isEnabled: true
      pathname: 'category' # Category main path /category/some-category, you can change this to "group" (/group/some-category)
      robots:
        index: true

    tag:
      isEnabled: true
      pathname: 'tag' # Tag main path /tag/some-tag, you can change this to "topics" (/topics/some-category)
      robots:
        index: false

    isRelatedPostsEnabled: true # If a widget with related posts is to be displayed below each post
    relatedPostsCount: 4 # Number of related posts to display

analytics:
  vendors:
    googleAnalytics:
      id: null # or "G-XXXXXXXXXX"

ui:
  theme: 'system' # Values: "system" | "light" | "dark" | "light:only" | "dark:only"
```

#### Internationalization (i18n)

Astrowind uses a custom i18n system (`src/i18n/`) with zero framework dependencies. The system supports **any source locale** (configured via `i18n.defaultLocale`) and any number of target locales.

**How it works:**

1. **JSON catalogs** (`src/locales/{locale}.json`) – simple `"source string": "translated string"` maps. The source locale catalog (e.g. `en.json`) is the master key set. Target catalogs are kept in sync automatically. Untranslated entries are marked with empty string `""`.

2. **Automatic string extraction** – at build time, all `.astro` files are scanned for translatable text. New strings are added to the source catalog; removed strings are pruned from all catalogs.

3. **AI-powered translation** – strings with `""` values are sent to the configured provider (Gemini or DeepL) at build time. A content-addressed manifest (`.i18n-manifest.json`) skips translation when nothing changed.

4. **HTML post-processing** – after the build, an Astro integration walks `dist/` HTML files and replaces source-locale text with translations using full-string matching. Script tags are protected from corruption.

5. **Markdown content translation** (`src/i18n/markdown.ts`) – blog posts, pages, templates, and snippets in `src/data/{post,pages,templates,snippets}/{sourceLocale}/` are automatically translated to all target locales. Frontmatter is parsed as YAML and all nested string values are recursively translated — even deeply nested structures like hero sections, feature lists, and team member bios. The body is translated as a single block preserving formatting.

**Expected behaviors by user action:**

| Action | Behavior |
|---|---|
| **Add text to `.astro` file** | Extracted → added to source catalog → synced to target catalogs → AI translates |
| **Add new `.md` file** | Detected by manifest hash → translated to all target locales |
| **Modify `.astro` or `.md`** | Old keys/files replaced, new content re-translated |
| **Delete text from `.astro`** | Automatically pruned from source + all target catalogs |
| **Delete `.md` source file** | Orphan translations in target locale dirs cleaned up automatically |
| **Manually edit a translation** | Non-empty catalog entries are **never overwritten** by AI. Markdown target files survive until their source `.md` changes. |
| **Add a locale** (add to `locales` array) | Empty catalog created, all strings + markdown content auto-translated |
| **Remove a locale** (remove from `locales`) | Build warns about stale dirs/files. Manual cleanup recommended. |
| **No API key configured** | Build succeeds with English-only output. No crash, no blocking. |
| **Change source locale** (cold start only) | Set `i18n.defaultLocale` to the language your `.astro`/`.md` source files are written in before first build. |

#### Content Management (CMS)

Astrowind includes **Sveltia CMS** – a lightweight, Git-based content editor accessible at `/admin/`:

- **Zero npm dependencies** – just two static files in `public/admin/` (the JS bundle loads from CDN).
- **GitHub backend** – edits commit directly to the repository, triggering the CI/CD pipeline (build → translate → deploy).
- **Authentication** – log in with a GitHub personal access token (PAT).
- **Editable content:**
  - **Blog Posts** (`src/data/post/en/`) – all frontmatter fields (title, date, excerpt, image, tags, etc.) plus the markdown body.
  - **Pages** (`src/data/pages/en/`) – standalone pages (privacy, terms, about) with navigation settings.
  - **Templates** (`src/data/templates/en/`) – data-driven landing pages with rich nested YAML frontmatter. Edit hero, features, testimonials, team, CTA – all from one file.
  - **Snippets** (`src/data/snippets/en/`) – reusable markdown content rendered by the `MarkdownSlot` component. Target-locale copies are generated automatically at build time.

Target locale translations (es, fr, de) are handled automatically at build time and don't need manual CMS editing.

#### CI/CD (GitHub Actions)

`.github/workflows/actions.yaml` handles the `main` branch:

- **On push to `main`**: checkout → `bun install` → `bun run check` → `bun run build` (includes i18n translation) → deploy to GitHub Pages.
- **On pull request**: checkout → `bun install` → `bun run check` → `bun run build` (no deploy).

Client branches use Netlify's Git integration for CI/CD — no GitHub Actions needed per client.

#### Customize Design

To customize Font families, Colors or more Elements refer to the following files:

- `src/components/CustomStyles.astro`
- `src/assets/styles/tailwind.css`

#### Deploy to production (manual)

You can create an optimized production build with:

```shell
bun run build
```

Now, your website is ready to be deployed. All generated files are located at
`dist` folder, which you can deploy the folder to any hosting service you
prefer.

#### Deploy to production (docker)

This is particularly useful if you want to deploy on a production server without nodejs installed.

```shell
docker build --target artifact --output type=local,dest=./dist .
```

#### Deploy to production (docker+nginx)

```shell
# Create container image
docker build --target deploy -t astrowind-prod .
# Run the container and map localhost:8080
docker run -d -p 8080:8080 --name astrowind-server astrowind-prod
```

#### Deploy a client to Netlify

1. Create a client branch: `git checkout -b client/<name>` from `main`
2. Configure `src/config.yaml` (site name, domain, locales) and `netlify.toml`
3. Push the branch to GitHub
4. In Netlify: **Add new site → Import an existing project → GitHub**
5. Set **Production branch** to `client/<name>`
6. Add `DEEPL_API_KEY` or `GEMINI_API_KEY` in Netlify's environment variables
7. Deploy! Every push to the client branch triggers a rebuild with full i18n translation

See [`docs/client-architecture.md`](docs/client-architecture.md) for the complete onboarding checklist.

#### Deploy to Vercel

Clone this repository and deploy to Vercel. The same branch-per-client model works — set the production branch to your client branch in Vercel's project settings.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkafkiano%2Fastrowind-i18n)

## Acknowledgements

Initially created by **Arthelokyo** and maintained by a community of [contributors](https://github.com/arthelokyo/astrowind/graphs/contributors).

## License

**AstroWind** is licensed under the MIT license — see the [LICENSE](./LICENSE.md) file for details.
