# i18n with Dynamic Routes: Architectural Documentation

## Overview

This document describes the production‑ready i18n implementation in the Astrowind theme, which uses **Astro’s built‑in i18n routing** combined with **dynamic route parameters** and **content collections**. The system supports multiple languages (currently English and Spanish) while maintaining a DRY codebase, SEO‑friendly URLs, and static generation.

## Core Configuration

### Astro Config (`astro.config.ts`)

```typescript
i18n: {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routing: {
    prefixDefaultLocale: true,
  },
}
```

- **`prefixDefaultLocale: true`** forces all URLs, including the default language, to have a locale prefix (`/en/...`, `/es/...`).
- The root `/` automatically redirects to `/en/` via Astro’s i18n middleware.
- **No real locale directories** (`en/`, `es/`) are created; instead a **dynamic route parameter** `[locale]` is used.

## Routing Architecture

### Dynamic Route `[locale]`

All locale‑specific pages are placed under `src/pages/[locale]/`. This directory is a **dynamic route** – the bracket syntax `[locale]` tells Astro that `locale` is a route parameter.

Because `[locale]` is a dynamic route, **every `.astro` file inside it must export a `getStaticPaths` function** that returns the possible values for `locale` (`'en'`, `'es'`).

### Shared Utility: `getStaticPathsForLocale`

A helper in `src/utils/i18n.ts` generates the required static paths:

```typescript
import { LOCALES } from './blog';

export const getStaticPathsForLocale = () =>
  LOCALES.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));
```

Each `.astro` page under `[locale]/` imports and exports this function:

```astro
---
import { getStaticPathsForLocale } from '~/utils/i18n';
export const getStaticPaths = getStaticPathsForLocale;
---
```

**Applied to**: `index.astro`, `about.astro`, `contact.astro`, `services.astro`, `pricing.astro`, all files in `homes/` and `landing/`.

## Content Collections for Localized Content

### Blog Posts

**Data location**: `src/data/post/{en,es}/`  
**Collection**: `post` (defined in `src/content/config.ts`)  
**Route**: `src/pages/[locale]/[...blog]/`  
**Utilities**: `src/utils/blog.ts`

The blog system already handled i18n correctly:
- `getLangFromPostId(id)` extracts the language prefix from the content‑collection ID.
- `getStaticPathsBlogPost()`, `getStaticPathsBlogList()`, etc., iterate over `LOCALES` and return `params: { locale, blog: post.permalink }`.
- Permalinks follow the pattern defined in `src/config.yaml` (`post.permalink: '/%slug%'`), producing URLs like `/en/useful‑resources‑to‑create‑websites`.

**Critical fix**: The slug generation was corrected to strip the locale prefix from the ID:

```diff
- const slug = cleanSlug(id);
+ const slug = cleanSlug(id.split('/').pop() || id);
```

### Generic Markdown Pages (Terms, Privacy, etc.)

**Data location**: `src/data/pages/{en,es}/`  
**Collection**: `pages` (added to `src/content/config.ts`)  
**Route**: `src/pages/[locale]/[...pages]/index.astro`  
**Utilities**: `src/utils/pages.ts`

This pattern mirrors the blog but is simplified (no categories, tags, pagination).  
**Key functions**:
- `getNormalizedPage()` builds a page object with `Content` and `permalink`.
- `getStaticPathsPages()` returns `params: { locale, pages: 'pages/${slug}' }`.

**Route component** (`src/pages/[locale]/[...pages]/index.astro`):
- Exports `getStaticPaths = getStaticPathsPages`.
- Receives `page` and `locale` via props.
- Renders the markdown content using `MarkdownLayout.astro`.

**Layout nesting fix**: The route originally wrapped `MarkdownLayout` inside another `<Layout>`, causing duplicated headers/footers. The outer wrapper was removed:

```diff
- <Layout metadata={{ title }}>
-   <MarkdownLayout frontmatter={{ title }}>
-     <slot />
-   </MarkdownLayout>
- </Layout>
+ <MarkdownLayout frontmatter={{ title }}>
+   <Content />
+ </MarkdownLayout>
```

## Navigation and Permalinks

### Locale‑Aware Helpers

`src/utils/permalinks.ts` provides:

- `getPermalink(slug, type, locale?)` – prepends `/${locale}` when needed.
- `getPagePermalink(slug, locale?)` – shortcut for `/pages/${slug}`.
- `getBlogPermalink(locale?)`, `getHomePermalink(locale?)`.

### Navigation Data

`src/navigation.ts` exports functions `getHeaderData(locale)` and `getFooterData(locale)` that compute links with the current locale. Example:

```typescript
{
  text: 'Terms',
  href: getPagePermalink('terms', locale),
}
```

## Language Switching

The `LanguagePicker.astro` component uses Astro’s `astro:i18n` utilities (`getRelativeLocaleUrl`) to generate alternate‑language URLs while preserving the current page context.

## SEO and hreflang Tags

`src/layouts/Layout.astro` includes `<link rel="alternate" hreflang="...">` tags for each supported locale, generated via `getRelativeLocaleUrl`.

## Build and Validation

### Successful Build Criteria

1. **No `GetStaticPathsRequired` errors** – all dynamic routes export `getStaticPaths`.
2. **Correct URL prefixes** – `/en/...`, `/es/...` (no root pages except `404.astro`).
3. **Blog posts accessible** – e.g., `/en/useful‑resources‑to‑create‑websites`.
4. **Pages collection accessible** – e.g., `/en/pages/terms`.
5. **No duplicated headers/footers** – each page renders a single `<Layout>`.
6. **Language switcher functional** – toggles between locales preserving page.

### Testing Commands

```bash
npm run build   # Should complete without errors
npm run dev     # Verify live rendering
```

## Lessons Learned / Pitfalls

1. **Dynamic route vs. real directories**: Using `[locale]` as a dynamic parameter requires `getStaticPaths` on every page; real locale directories (`en/`, `es/`) would not need it but would duplicate code.

2. **Markdown files cannot export `getStaticPaths`**: Placing `.md` files directly under a dynamic route fails. Solution: use a content collection with a catch‑all route (`[...pages]/`).

3. **Slug generation must strip locale prefix**: The content‑collection ID includes the language prefix (`en/file.md`). The slug must be extracted from the filename part only.

4. **Layout nesting**: Avoid wrapping a component that already provides a layout; double‑wrapping leads to duplicated headers/footers.

5. **Route priority**: Static routes at root (`src/pages/about.astro`) take precedence over dynamic routes (`src/pages/[locale]/about.astro`). All conflicting root pages were deleted.

## Future Extensions

- **Add more locales**: Add to `locales` array in `astro.config.ts` and `LOCALES` in utilities.
- **Locale‑specific assets**: Use `src/assets/{locale}/` if needed.
- **Missing content fallback**: Implement fallback logic (e.g., Spanish page missing → show English).
- **RSS feeds per locale**: Extend `rss.xml.ts` to generate feeds for each language.

## Summary

The i18n system is now **production‑ready**:

- ✅ All pages are generated for both `en` and `es`.
- ✅ URLs are SEO‑friendly (`/en/pages/terms`).
- ✅ Navigation is locale‑aware.
- ✅ Blog and generic markdown pages use the same pattern.
- ✅ No build errors, no duplicated UI, language switcher works.

The architecture adheres to **framework primitive supremacy** (Astro’s i18n routing and content collections) and **function minimalism** (reusing the blog pattern for pages).