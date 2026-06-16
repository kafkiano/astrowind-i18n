# Client Website Architecture

How we adapt the astrowind-i18n base theme into individual client websites — reproducibly, without per-client component sprawl.

## Core Principle: Compose, Don't Create

> **Widgets are immutable building blocks. Client work is composition + content, never widget internals.**

Every client website is assembled from the same set of widgets. We do not create new components on client branches. If multiple clients need a new widget, we add it to `main` so everyone benefits.

---

## Branch Model

```
main                      ← Clean base theme (astrowind-i18n)
  ├── client/artesano     ← Artesano Moraira (gallery · café · juice bar)
  ├── client/next-co      ← Next client
  └── ...
```

- `main` stays pristine — upgradeable, reusable, the single source of truth.
- Client branches are created from `main` at the start of a project.
- Improvements to widgets, i18n, or layouts happen on `main` and can be merged into client branches.

---

## What Changes Per Client

### ✅ Modified (every client)

| Layer | Files | What we do |
|---|---|---|
| **Config** | `src/config.yaml` | Site name, metadata, locales, navigation, UI theme, analytics |
| **Images** | `src/assets/images/` | Logo, photos, badges — all client-specific assets |
| **Page templates** | `src/pages/[locale]/index.astro` | Rewrite — compose widgets into the landing page |
| **Page templates** | `src/pages/[locale]/` other pages | Delete unused templates (pricing, services, landing demos, home variants). Keep only what the client needs (about, contact, 404, blog if applicable) |
| **Styles** | `src/components/CustomStyles.astro` | Brand colors, font overrides, client-specific CSS |
| **Favicons** | `src/components/Favicons.astro` | Client favicon and app icons |
| **Content** | `src/data/post/{locale}/` | Blog posts, news, menu updates |
| **Content** | `src/data/pages/{locale}/` | Structural pages (privacy, terms, about markdown) |
| **Content** | `src/data/templates/{locale}/` | Data-driven page templates (landing page, custom pages) |

### ❌ Never Touched (immutable)

| Layer | What stays |
|---|---|
| **Widget components** | `src/components/widgets/*` — Hero, Content, Testimonials, Features, etc. |
| **UI components** | `src/components/ui/*` — Button, Headline, ItemGrid, etc. |
| **Layouts** | `src/layouts/*` — PageLayout, LandingLayout, MarkdownLayout |
| **i18n system** | `src/i18n/*` — extraction, translation, post-processing |
| **Utilities** | `src/utils/*` — permalinks, navigation, images, blog |
| **Common components** | `src/components/common/*` — Image, Metadata, LocaleSwitcher, etc. |

---

## Content Architecture: Four Directories, Two Translation Pipelines

Every piece of content in astrowind-i18n lives in one of four directories under `src/data/`. Each has a clear purpose and a specific translation path.

```
src/data/
├── pages/{locale}/      ← Full markdown pages (body = content)
│   ├── privacy.md            Rendered by [...pages] catch-all
│   └── terms.md              Translated via markdown pipeline
│
├── post/{locale}/        ← Blog posts
│   └── *.md                  Rendered by [...blog] routes
│                             Translated via markdown pipeline
│
├── templates/{locale}/   ← Data for custom .astro page templates
│   └── landing.md             Consumed by landing/template.astro via getEntry()
│                             Translated via markdown pipeline (nested YAML)
│                             NOT rendered by any catch-all route
│
└── snippets/             ← Markdown fragments embedded in .astro components
    └── *.md                  Imported via MarkdownSlot.astro
                              Translated via UI string pipeline (JSON catalogs)
```

### Translation Paths

| Content type | Pipeline | Output |
|---|---|---|
| `pages/` | Markdown translation | Target-locale `.md` copies (e.g. `es/privacy.md`) |
| `post/` | Markdown translation | Target-locale `.md` copies |
| `templates/` | Markdown translation (nested YAML) | Target-locale `.md` copies |
| `snippets/` | UI string extraction → JSON catalogs → HTML post-processing | Translated strings in `dist/` HTML |

**Why templates use the markdown pipeline, not the UI string pipeline:**

The UI string extractor walks `.astro` file ASTs and finds hardcoded text nodes. It cannot see dynamic data from `getEntry()` results. Template data lives in markdown frontmatter — it's dynamic, not hardcoded. The markdown translator creates proper target-locale copies (e.g. `es/landing.md`) that `getEntry()` reads at build time.

### The Template Pattern

A **template** is a markdown file with rich nested YAML frontmatter that defines an entire page's content. A custom `.astro` page reads it via `getEntry()` and maps frontmatter fields to widgets.

**Template file** (`src/data/templates/en/landing.md`):
```yaml
---
title: Landing Demo

hero:
  title: Welcome
  subtitle: This page is driven by markdown
  actions:
    - text: Get started
      href: '#'
      variant: primary

features:
  items:
    - title: Feature one
      description: ...
    - title: Feature two
      description: ...

testimonials:
  - title: Great product
    testimonial: ...
    name: Jane D.

cta:
  title: Ready to start?
  actions:
    - text: Contact us
      href: '#'
---
```

**Page template** (`src/pages/[locale]/landing/template.astro`):
```astro
---
import { getEntry } from 'astro:content';
import Hero from '~/components/widgets/Hero.astro';
import Features from '~/components/widgets/Features.astro';
import Testimonials from '~/components/widgets/Testimonials.astro';
import CallToAction from '~/components/widgets/CallToAction.astro';

const locale = Astro.currentLocale ?? 'en';
const { data } = await getEntry('templates', `${locale}/landing`);
---

<Layout>
  {data.hero && <Hero {...data.hero} />}
  {data.features && <Features {...data.features} />}
  {data.testimonials && <Testimonials variant="slider" testimonials={data.testimonials} />}
  {data.cta && <CallToAction {...data.cta} />}
</Layout>
```

**Key properties:**
- **CMS-editable**: All content in one file. Client edits text and images via Sveltia CMS.
- **Auto-translated**: The i18n system traverses all nested YAML values and translates them via DeepL/Gemini.
- **Section-optional**: The `.astro` template checks for each section's presence. Remove a section from frontmatter → it disappears from the page.
- **No code changes**: Adding a new section means adding YAML to the markdown file. The template already knows about all available widgets.
- **`showIn` untouched**: Templates are in their own collection. The `showIn` field on `pages/` remains purely about navigation visibility.

### When to use each directory

| You want to... | Use |
|---|---|
| Add a standalone page with body content (privacy, terms, about) | `pages/` |
| Write a blog post | `post/` |
| Build a data-driven landing page or custom page | `templates/` |
| Embed a reusable markdown fragment in a component | `snippets/` |

---

## Widget Toolbox

These are the building blocks. A client page is just a sequence of widget invocations.

### Content Widgets

| Widget | Variants | Use for |
|---|---|---|
| **Hero** | `centered`, `side-by-side`, `text-only` | Page hero with title, subtitle, image, CTAs |
| **Content** | default, `isReversed`, `isAfterContent` | Text + image sections, feature bullets |
| **Features** | `cards`, `cards-image`, `cards-vertical`, `slider` | Feature grids, service cards, image grids |
| **CallToAction** | — | CTA boxes, banners, conversion sections |
| **Testimonials** | `grid`, `slider` (Embla carousel with autoplay) | Customer reviews, quotes, social proof |
| **Team** | `cards` (photo grid) | Team members with photo, name, role, bio, social links |
| **Gallery** | `grid` (static) | Image galleries, portfolios, product photos |
| **Badge** | `corner` (ribbon), `inline`, `banner` | Certifications, awards, ratings, social-proof badges |
| **Stats** | — | Numbers, metrics, achievements |
| **Steps** | default, `isReversed` | Process steps, how-it-works |
| **FAQs** | — | Accordion FAQ sections |
| **Pricing** | — | Pricing tables |
| **Contact** | — | Contact forms |
| **Slider** | Embla carousel | Image/testimonial carousels |
| **Brands** | — | Logo clouds, partner logos |

### Structural Widgets

| Widget | Purpose |
|---|---|
| **Header** | Navigation, actions, locale switcher, theme toggle |
| **Footer** | Footer links, social icons, copyright |
| **Announcement** | Top banner bar (needs configurable props — currently hardcoded) |

---

## Page Composition: Two Approaches

### Approach A: Template-Driven (recommended for CMS)

The markdown file defines all content. The `.astro` template reads it and maps to widgets. Client edits one file in CMS.

**Template** (`src/data/templates/en/home.md`):
```yaml
---
title: Artesano — Gallery · Café · Juice Bar

hero:
  title: artesano
  subtitle: GALLERY • CAFE • JUICE BAR
  tagline: Welcome to a refreshing change
  image:
    src: ~/assets/images/artesano-logo.png
    alt: artesano logo
  actions:
    - text: View menu
      href: '#dishes'
      variant: primary

welcome:
  tagline: Welcome
  title: A refreshing change
  image: ~/assets/images/food-salad.jpg
  items:
    - title: Vegetarian, vegan & gluten free
      description: A wide selection for every dietary preference.
    - title: Fresh-pressed juices & smoothies
      description: Made to order alongside local wines and craft beers.

testimonials:
  - title: Creative, healthy and delicious!
    testimonial: A wonderful find in Moraira. The food is fresh and creative.
    name: Sarah M.
  - title: A Beautiful Breakfast
    testimonial: Beautiful presentation, fresh ingredients, friendly service.
    name: James K.

team:
  - name: Ismael
    job: Owner
    image: ~/assets/images/ismael.jpg
    imageAlt: Ismael, Owner of Artesano
    description: Originally from Tangier, Morocco...
    socials:
      - icon: tabler:brand-facebook
        href: https://facebook.com/artesanomoraira

cta:
  title: Visit us today
  subtitle: Carretera Moraira-Calpe 16a, 03724 Moraira, Alicante
  actions:
    - variant: primary
      text: Get directions
      href: https://maps.google.com/...
      icon: tabler:map-pin
---
```

**Page** (`src/pages/[locale]/index.astro`):
```astro
---
import { getEntry } from 'astro:content';
import Layout from '~/layouts/PageLayout.astro';
import Hero from '~/components/widgets/Hero.astro';
import Content from '~/components/widgets/Content.astro';
import Testimonials from '~/components/widgets/Testimonials.astro';
import Team from '~/components/widgets/Team.astro';
import CallToAction from '~/components/widgets/CallToAction.astro';

const locale = Astro.currentLocale ?? 'en';
const { data } = await getEntry('templates', `${locale}/home`);
---

<Layout metadata={{ title: data.title }}>
  {data.hero && <Hero {...data.hero} />}
  {data.welcome && <Content {...data.welcome} />}
  {data.testimonials && <Testimonials variant="slider" testimonials={data.testimonials} />}
  {data.team && <Team team={data.team} />}
  {data.cta && <CallToAction {...data.cta} />}
</Layout>
```

### Approach B: Hardcoded (for simple sites, no CMS)

Widgets are invoked directly with inline data. Simpler but requires code changes for content updates.

```astro
---
import Layout from '~/layouts/PageLayout.astro';
import Hero from '~/components/widgets/Hero.astro';
import CallToAction from '~/components/widgets/CallToAction.astro';
---

<Layout metadata={{ title: 'My Site' }}>
  <Hero
    variant="centered"
    title="Welcome"
    subtitle="The best place in town"
    actions={[
      { variant: 'primary', text: 'Get started', href: '#' },
    ]}
  />
  <CallToAction
    title="Ready?"
    actions={[{ text: 'Contact us', href: '#' }]}
  />
</Layout>
```

---

## i18n Strategy: Source-Locale-Only

Our core competency is automated translation. We never deal with half-baked manual translations.

- **Client provides content in one source language** (e.g., English for artesano).
- **`config.yaml`** sets `defaultLocale` + target `locales` (e.g., `['en', 'es']`).
- **Build pipeline** auto-extracts strings from `.astro` files, AI-translates them, and post-processes into locale-specific HTML.
- **Markdown content** (blog posts, pages) is auto-translated pre-build.
- **Result**: `/en/` and `/es/` pages with proper `hreflang` tags — strictly better for SEO than the old-school "English then Spanish on the same page" approach.

The client's old site has bilingual content inline. Our model separates locales properly. This is a feature, not a limitation.

---

## New Client Onboarding Process

1. **Create branch**: `git checkout -b client/client-name` from `main`
2. **Configure site**: Edit `src/config.yaml` — site name, metadata, locales, navigation. Set `base: '/'` for Netlify deployment.
3. **Add images**: Drop client assets into `src/assets/images/`
4. **Create landing template**: Write `src/data/templates/en/home.md` with rich nested YAML frontmatter defining all sections (hero, features, testimonials, team, CTA, etc.)
5. **Wire up index page**: Rewrite `src/pages/[locale]/index.astro` to read from `getEntry('templates', ...)` and map frontmatter fields to widgets
6. **Delete unused pages**: Remove irrelevant templates from `src/pages/[locale]/` (keep only what the client needs)
7. **Add content pages**: Create markdown files in `src/data/pages/{locale}/` (privacy, terms, about)
8. **Style**: Adjust `CustomStyles.astro` for brand colors/fonts
9. **Favicon**: Update `Favicons.astro`
10. **CMS config**: Edit `public/admin/config.yml`:
    - Set `branch: client/client-name`
    - Define template collection fields matching the landing page YAML structure
    - Remove unused collections (posts if no blog, etc.)
11. **Netlify setup**: Create `netlify.toml` with build command and publish directory. Add `DEEPL_API_KEY` or `GEMINI_API_KEY` in Netlify's environment variables (never commit API keys).
12. **Build & verify**: `bun run build` — check all locales render correctly
13. **Push & deploy**: Push branch to GitHub. In Netlify UI: Add new site → Import from GitHub → set production branch to `client/client-name`. Every subsequent push triggers auto-deploy with full i18n translation.

### CMS Configuration Per Client

Each client branch needs its own CMS config. Key differences from `main`:

```yaml
# public/admin/config.yml
backend:
  name: github
  repo: kafkiano/astrowind-i18n
  branch: client/client-name  # ← points to this client's branch

media_folder: src/assets/images
public_folder: ~/assets/images
```

The template collection should define fields matching the actual YAML structure of the client's landing page. Use `widget: object` for nested sections, `widget: list` for arrays (testimonials, team members), and `widget: image` for photo fields.

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "bun run build"
  publish = "dist"
```

Set API keys in Netlify UI → Site configuration → Environment variables. Never commit them to the repository.

---

## Design Decisions Log

| Decision | Rationale |
|---|---|
| Branch-per-client, not fork-per-client | Merging base improvements into client branches is trivial. Forks diverge irreversibly. |
| Widgets immutable on client branches | Prevents component sprawl. Forces composition discipline. New widgets go to `main`. |
| Source-locale-only content | Our value prop is automated i18n. Manual bilingual content is an anti-pattern. |
| Template-driven pages (nested YAML) | One file per page, CMS-editable, auto-translated. Client edits content without touching code. |
| Four-directory content model | `pages/`, `post/`, `templates/`, `snippets/` — each has a clear purpose and translation path. No overloading `showIn`. |
| CMS media_folder = `src/assets/images/` | Unifies image handling. CMS uploads go through Astro's full asset pipeline (webp, srcset, lazy loading). |
| Netlify per client branch, GitHub Pages for `main` | One GitHub Pages site per repo. Client sites need their own domains → Netlify. |
| Badge as standalone widget | Composable — can attach to any section. Not coupled to Hero or Content. |
| Gallery lightbox deferred | Adds JS complexity. Static grid covers 80% of client needs. Build the simple thing first. |
| Team `cards` variant first | Covers the common case. Advanced variants (featured, list) added when clients demand them. |
