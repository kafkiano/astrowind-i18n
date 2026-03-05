# 🚀 AstroWind

![GitHub License](https://img.shields.io/github/license/kafkiano/astrowind-i18n)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/kafkiano/astrowind-i18n/actions.yaml)
![GitHub last commit](https://img.shields.io/github/last-commit/kafkiano/astrowind-i18n)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/kafkiano/astrowind-i18n/github-code-scanning%2Fcodeql?logo=github&label=CodeQL)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-F472B6?style=flat&logo=bun&logoColor=white)](https://bun.sh)


**AstroWind** is a free and open-source template to make your website using **[Astro 5.0](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/)**. Ready to start a new project and designed taking into account web best practices.

- ✅ **Production-ready** scores in **PageSpeed Insights** reports.
- ✅ Integration with **Tailwind CSS** supporting **Dark mode** and **_RTL_**.
- ✅ **Fast and SEO friendly blog** with automatic **RSS feed**, **MDX** support, **Categories & Tags**, **Social Share**, ...
- ✅ **Image Optimization** (using new **Astro Assets** and **Unpic** for Universal image CDN).
- ✅ Generation of **project sitemap** based on your routes.
- ✅ **Open Graph tags** for social media sharing.
- ✅ **Analytics** built-in Google Analytics, and Splitbee integration.
- ✅ **Internationalization (i18n)** with hybrid system: Wuchale for UI strings, Astro routing, locale‑fallback pages.

**AstroWind** tries to give you quick access to creating a website using [Astro 5.0](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/). It's a free theme which focuses on simplicity, good practices and high performance.

Very little vanilla javascript is used only to provide basic functionality so that each developer decides which framework (React, Vue, Svelte, Solid JS...) to use and how to approach their goals.

In this version the template supports all the options in the `output` configuration, `static`, `hybrid` and `server`, but the blog only works with `prerender = true`. We are working on the next version and aim to make it fully compatible with SSR.

### Project structure

Inside **AstroWind** template, you'll see the following folders and files:

```bash
/
├── public/
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
│   │   ├── ui/
│   │   ├── widgets/
│   │   │   ├── Header.astro
│   │   │   └── ...
│   │   ├── CustomStyles.astro
│   │   ├── Favicons.astro
│   │   └── Logo.astro
│   ├── content/
│   │   ├── post/
│   │   │   ├── post-slug-1.md
│   │   │   ├── post-slug-2.mdx
│   │   │   └── ...
│   │   └-- config.ts
│   ├── layouts/
│   │   ├── Layout.astro
│   │   ├── MarkdownLayout.astro
│   │   └── PageLayout.astro
│   ├── pages
│   │   └── [locale]
│   │       ├── [...blog]
│   │       │   ├── [category]
│   │       │   └── [tag]
│   │       ├── homes
│   │       ├── landing
│   │       └── [...pages]
│   │   ├── index.astro
│   │   ├── 404.astro
│   │   ├-- rss.xml.ts
│   │   └── ...
│   ├── utils/
│   ├── config.yaml
│   └── navigation.js
├── package.json
├── astro.config.ts
├── wuchale.config.js
└── ...
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

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
      - url: '~/assets/images/default.png'
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

Astrowind uses a hybrid i18n system:

1. **Wuchale** – compile‑time extraction of static UI strings (navigation, buttons). Zero runtime overhead, automatic fallback to source strings. Configured in `wuchale.config.js`.
2. **Astro i18n routing** – locale‑prefixed URLs (`/[locale]/...`). Configured in `astro.config.ts` and `src/config.yaml` (`i18n.locales`, `i18n.defaultLocale`).
3. **Content collections** – markdown pages stored in `src/data/pages/{locale}/`. Pages missing in a locale fall back to the default locale (English) automatically.

**Configuration** (in `src/config.yaml`):

```yaml
i18n:
  language: en
  textDirection: ltr
  locales: ['en', 'es', 'fr', 'de']
  defaultLocale: en
  localeNames:
    en: English
    es: Español
    fr: Français
    de: Deutsch
```

**Adding a new locale**:

1. Add locale code to `locales` array in `src/config.yaml`.
2. Create `src/data/pages/{locale}/` directory for translated pages.
3. Run `bun run dev` – Wuchale will generate corresponding `.po` files in `src/locales/`.

**Fallback behavior**:

- UI strings: Untranslated strings show the source (English) text.
- Pages: Missing locale‑specific pages automatically render the default‑locale version with a visual notice.
- URLs: Always locale‑prefixed; the default locale also receives a prefix (`/en/...`).

#### Customize Design

To customize Font families, Colors or more Elements refer to the following files:

- `src/components/CustomStyles.astro`
- `src/assets/styles/tailwind.css`

### Deploy

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

#### Deploy to Netlify

Clone this repository on your own GitHub account and deploy it to Netlify:

[![Netlify Deploy button](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/arthelokyo/astrowind)

#### Deploy to Vercel

Clone this repository on your own GitHub account and deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farthelokyo%2Fastrowind)

## Acknowledgements

Initially created by **Arthelokyo** and maintained by a community of [contributors](https://github.com/arthelokyo/astrowind/graphs/contributors).

## License

**AstroWind** is licensed under the MIT license — see the [LICENSE](./LICENSE.md) file for details.
