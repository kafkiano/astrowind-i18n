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

## Widget Toolbox

These are the building blocks. A client page is just a sequence of widget invocations.

### Content Widgets

| Widget | Variants | Use for |
|---|---|---|
| **Hero** | `centered`, `side-by-side`, `text-only` | Page hero with title, subtitle, image, CTAs |
| **Content** | default, `isReversed`, `isAfterContent` | Text + image sections, feature bullets |
| **Features** | `cards`, `cards-image`, `cards-vertical`, `slider` | Feature grids, service cards, image grids |
| **CallToAction** | — | CTA boxes, banners, conversion sections |
| **Testimonials** | — | Customer reviews, quotes, social proof |
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

### New Widgets (to be added to `main`)

| Widget | Variants | Use for |
|---|---|---|
| **Team** | `cards` (grid), more later | Team members with photo, name, role, bio, socials |
| **Gallery** | `grid` (static), lightbox deferred | Image galleries, portfolios, product photos |
| **Badge** | `corner` (ribbon), `inline`, `banner` | Certifications, awards, ratings, social-proof badges |

---

## Page Composition Example

A typical client `index.astro` — nothing but widget composition:

```astro
---
import Layout from '~/layouts/PageLayout.astro';
import Hero from '~/components/widgets/Hero.astro';
import Badge from '~/components/widgets/Badge.astro';
import Content from '~/components/widgets/Content.astro';
import Gallery from '~/components/widgets/Gallery.astro';
import Testimonials from '~/components/widgets/Testimonials.astro';
import Team from '~/components/widgets/Team.astro';
import CallToAction from '~/components/widgets/CallToAction.astro';

import { getStaticPathsForLocale } from '~/utils/i18n';
export const getStaticPaths = getStaticPathsForLocale;

const metadata = {
  title: 'Artesano — Gallery · Café · Juice Bar',
  ignoreTitleTemplate: true,
};
---

<Layout metadata={metadata}>
  <!-- Hero with TripAdvisor corner badge -->
  <Hero
    variant="centered"
    title="artesano"
    subtitle="GALLERY • CAFE • JUICE BAR"
    image={{ src: '~/assets/images/artesano-logo.png', alt: 'artesano logo' }}
  >
    <Badge
      slot="badge"
      variant="corner"
      position="top-right"
      image={{ src: '~/assets/images/tripadvisor-badge.png', alt: 'TripAdvisor Certificate of Excellence' }}
      href="https://www.tripadvisor.com/..."
    />
  </Hero>

  <!-- About section -->
  <Content
    tagline="Welcome"
    title="A refreshing change"
    items={[
      { title: 'Vegetarian, vegan & gluten free', description: '...' },
      { title: 'Fresh-pressed juices & smoothies', description: '...' },
      { title: 'Local wines & micro-brew beers', description: '...' },
    ]}
    image={{ src: '~/assets/images/food-salad.jpg', alt: 'Fresh salad at Artesano' }}
  />

  <!-- TripAdvisor badges inline -->
  <Badge variant="inline" image={{ src: '~/assets/images/ta-2019.png', alt: 'Certificate of Excellence 2019' }} />
  <Badge variant="inline" image={{ src: '~/assets/images/ta-2018.png', alt: 'Certificate of Excellence 2018' }} />
  <Badge variant="inline" image={{ src: '~/assets/images/ta-2017.png', alt: 'Certificate of Excellence 2017' }} />

  <!-- Food gallery -->
  <Gallery
    tagline="Our kitchen"
    title="Fresh, made-to-order"
    images={[
      { src: '~/assets/images/food-1.jpg', alt: 'Goat cheese salad' },
      { src: '~/assets/images/food-2.jpg', alt: 'Fresh wrap' },
      { src: '~/assets/images/drinks-1.jpg', alt: 'Cocktails' },
      { src: '~/assets/images/drinks-2.jpg', alt: 'Fresh juice' },
      { src: '~/assets/images/art-1.jpg', alt: 'Local artwork' },
      { src: '~/assets/images/art-2.jpg', alt: 'Jewelry display' },
    ]}
  />

  <!-- Testimonials -->
  <Testimonials
    title="What our guests say"
    subtitle="From our TripAdvisor reviews"
    testimonials={[
      { title: 'Creative, healthy and delicious!', testimonial: '...', name: 'Sarah M.' },
      { title: 'A Beautiful Breakfast', testimonial: '...', name: 'James K.' },
      // ... more reviews
    ]}
  />

  <!-- Team -->
  <Team
    tagline="The Artesano Team"
    title="Always at your service"
    team={[
      {
        name: 'Ismael',
        job: 'Owner',
        image: { src: '~/assets/images/ismael.jpg', alt: 'Ismael, Owner' },
        description: 'Originally from Tangier, Morocco...',
        socials: [
          { icon: 'tabler:brand-facebook', href: 'https://facebook.com/...' },
          { icon: 'tabler:brand-instagram', href: 'https://instagram.com/...' },
        ],
      },
      {
        name: 'Matthew',
        job: 'Owner',
        image: { src: '~/assets/images/matthew.jpg', alt: 'Matthew, Owner' },
        description: '...',
      },
    ]}
  />

  <!-- Call to Action -->
  <CallToAction
    title="Visit us today"
    subtitle="Carretera Moraira-Calpe 16a, 03724 Moraira, Alicante"
    actions={[
      { variant: 'primary', text: 'Get directions', href: 'https://maps.google.com/...', icon: 'tabler:map-pin' },
      { text: 'Call us', href: 'tel:+34966272127', icon: 'tabler:phone' },
    ]}
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
2. **Configure**: Edit `src/config.yaml` — site name, metadata, locales, navigation
3. **Add images**: Drop client assets into `src/assets/images/`
4. **Build landing page**: Rewrite `src/pages/[locale]/index.astro` — compose widgets
5. **Delete unused pages**: Remove irrelevant templates from `src/pages/[locale]/`
6. **Add content**: Create markdown files in `src/data/post/{locale}/` and `src/data/pages/{locale}/`
7. **Style**: Adjust `CustomStyles.astro` for brand colors/fonts
8. **Favicon**: Update `Favicons.astro`
9. **Build & verify**: `bun run build` — check all locales render correctly
10. **Launch**: Deploy static output from `dist/`

---

## Design Decisions Log

| Decision | Rationale |
|---|---|
| Branch-per-client, not fork-per-client | Merging base improvements into client branches is trivial. Forks diverge irreversibly. |
| Widgets immutable on client branches | Prevents component sprawl. Forces composition discipline. New widgets go to `main`. |
| Source-locale-only content | Our value prop is automated i18n. Manual bilingual content is an anti-pattern. |
| Badge as standalone widget | Composable — can attach to any section. Not coupled to Hero or Content. |
| Gallery lightbox deferred | Adds JS complexity. Static grid covers 80% of client needs. Build the simple thing first. |
| Team `cards` variant first | Covers the common case. Advanced variants (featured, list) added when clients demand them. |
