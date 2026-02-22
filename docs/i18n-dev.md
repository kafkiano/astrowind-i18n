# I18N Developer Reference

## Executive Summary

This document provides a complete forensic analysis of the internationalization (i18n) and locale configuration system in the Astrowind project. The system implements a **hybrid architecture** combining Astro's built-in i18n routing, Wuchale compile-time string extraction, and content collection-based localization.

**Key Finding**: The i18n system is well-architected with clear separation of concerns, but contains some redundancy and potential coupling issues between configuration sources.

---

## 1. Configuration Sources

### 1.1 Primary Configuration: `src/config.yaml`

**Location**: [`src/config.yaml`](src/config.yaml:30-40)

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

**Purpose**: Single source of truth for all i18n configuration.

**Fields**:
- `language`: Default language code (used in metadata)
- `textDirection`: Text direction (ltr/rtl)
- `locales`: Array of supported locale codes
- `defaultLocale`: Fallback locale
- `localeNames`: Human-readable display names for UI

### 1.2 Astro Configuration: `astro.config.ts`

**Location**: [`astro.config.ts`](astro.config.ts:24-54)

```typescript
const config = yaml.load(configContent) as AstroConfig;
const i18nConfig = config.i18n || { locales: ['en'], defaultLocale: 'en' };

export default defineConfig({
  i18n: {
    locales: i18nConfig.locales || ['en'],
    defaultLocale: i18nConfig.defaultLocale || 'en',
    routing: {
      prefixDefaultLocale: true,
    },
  },
  // ...
});
```

**Purpose**: Configures Astro's built-in i18n routing system.

**Critical Setting**: `prefixDefaultLocale: true` - Forces `/en/` prefix even for default locale.

**Dependency Chain**: Reads from `src/config.yaml` → YAML parsing → Astro config.

### 1.3 Wuchale Configuration: `wuchale.config.js`

**Location**: [`wuchale.config.js`](wuchale.config.js:9-44)

```javascript
const config = yaml.load(configContent);
const locales = config.i18n?.locales || ['en'];

export default defineConfig({
  locales,
  adapters: {
    main: astro(),
    navigation: vanilla({
      files: { include: ['src/navigation.ts'] },
      catalog: 'navigation',
      loader: 'custom',
      heuristic: (node, context) => {
        // Extracts 'text' and 'title' properties from navigation.ts
      },
    }),
  },
  writeFiles: { compiled: true },
});
```

**Purpose**: Configures Wuchale compile-time string extraction system.

**Adapters**:
- `main`: Astro adapter for UI strings (extracted from Astro components)
- `navigation`: Vanilla adapter for navigation strings (extracted from `src/navigation.ts`)

**Dependency Chain**: Reads from `src/config.yaml` → YAML parsing → Wuchale config.

---

## 2. Virtual Module System

### 2.1 Integration: `vendor/integration/index.ts`

**Location**: [`vendor/integration/index.ts`](vendor/integration/index.ts:25-56)

```typescript
const virtualModuleId = 'astrowind:config';
const resolvedVirtualModuleId = '\0' + virtualModuleId;

const { SITE, I18N, METADATA, APP_BLOG, UI, ANALYTICS } = configBuilder(rawJsonConfig);

updateConfig({
  vite: {
    plugins: [
      {
        name: 'vite-plugin-astrowind-config',
        resolveId(id) {
          if (id === virtualModuleId) return resolvedVirtualModuleId;
        },
        load(id) {
          if (id === resolvedVirtualModuleId) {
            return `
              export const SITE = ${JSON.stringify(SITE)};
              export const I18N = ${JSON.stringify(I18N)};
              // ...
            `;
          }
        },
      },
    ],
  },
});
```

**Purpose**: Creates a virtual module `astrowind:config` that exposes configuration values.

**Usage Pattern**: `import { I18N } from 'astrowind:config'`

### 2.2 Config Builder: `vendor/integration/utils/configBuilder.ts`

**Location**: [`vendor/integration/utils/configBuilder.ts`](vendor/integration/utils/configBuilder.ts:124-145)

```typescript
const getI18N = (config: Config) => {
  const _default = {
    language: 'en',
    textDirection: 'ltr',
    locales: ['en'],
    defaultLocale: 'en',
    localeNames: { en: 'English' },
  };

  const value = merge({}, _default, config?.i18n ?? {});

  // Ensure localeNames has entries for all locales
  const localeNames = value.localeNames || {};
  value.locales.forEach((locale: string) => {
    if (!localeNames[locale]) {
      localeNames[locale] = locale.toUpperCase(); // Fallback to code
    }
  });
  value.localeNames = localeNames;

  return value as I18NConfig;
};
```

**Purpose**: Builds I18N configuration with defaults and validation.

**Safety Feature**: Auto-generates `localeNames` for missing entries using uppercase locale codes.

---

## 3. Utility Functions

### 3.1 Locale Constants: `src/utils/locales.ts`

**Location**: [`src/utils/locales.ts`](src/utils/locales.ts:1-16)

```typescript
import { I18N } from 'astrowind:config';

export const LOCALES = I18N.locales;
export const DEFAULT_LOCALE = I18N.defaultLocale;
export const LANGUAGE = I18N.language;
export const TEXT_DIRECTION = I18N.textDirection;

export const getAstroI18nConfig = () => ({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  routing: {
    prefixDefaultLocale: true,
  },
});
```

**Purpose**: Centralized locale constants exported from virtual module.

**Usage**: Used throughout codebase for locale-aware operations.

### 3.2 I18n Utilities: `src/utils/i18n.ts`

**Location**: [`src/utils/i18n.ts`](src/utils/i18n.ts:1-75)

```typescript
export function getLangFromUrl(url: URL): string {
  if (import.meta.env.SSR && Astro.i18n) {
    return Astro.i18n?.currentLocale || DEFAULT_LOCALE;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0])) {
    return segments[0];
  }
  return DEFAULT_LOCALE;
}

export function useTranslatedPath(targetLocale?: string): (path: string, locale?: string) => string {
  return (path: string, locale?: string) => {
    const target = locale || targetLocale;
    if (!target) return path;
    try {
      if (import.meta.env.SSR && Astro.i18n) {
        return getRelativeLocaleUrl(target, path);
      }
    } catch (e) {
      console.warn('Failed to generate translated path', e);
    }
    const defaultLocale = DEFAULT_LOCALE;
    const shouldPrefix = target !== defaultLocale;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return shouldPrefix ? `/${target}/${cleanPath}` : `/${cleanPath}`;
  };
}

export function getCurrentLocale(): string {
  if (import.meta.env.SSR && Astro.i18n?.currentLocale) {
    return Astro.i18n?.currentLocale;
  }
  return DEFAULT_LOCALE;
}

export const getStaticPathsForLocale = () =>
  LOCALES.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));
```

**Purpose**: Core i18n utility functions for locale detection and path translation.

**Functions**:
- `getLangFromUrl()`: Extracts locale from URL pathname
- `useTranslatedPath()`: Returns a function to translate paths to target locale
- `getCurrentLocale()`: Gets current locale from Astro context (SSR only)
- `getStaticPathsForLocale()`: Generates static paths for all locales

### 3.3 Permalink Utilities: `src/utils/permalinks.ts`

**Location**: [`src/utils/permalinks.ts`](src/utils/permalinks.ts:42-86)

```typescript
export const getPermalink = (slug = '', type = 'page', locale?: string): string => {
  let permalink: string;

  if (slug.startsWith('https://') || slug.startsWith('http://') || ...) {
    return slug;
  }

  switch (type) {
    case 'home': return getHomePermalink(locale);
    case 'blog': return getBlogPermalink(locale);
    case 'asset': permalink = getAsset(slug); break;
    case 'category': permalink = createPath(CATEGORY_BASE, trimSlash(slug)); break;
    case 'tag': permalink = createPath(TAG_BASE, trimSlash(slug)); break;
    case 'post': permalink = createPath(trimSlash(slug)); break;
    case 'page': default: permalink = createPath(slug); break;
  }

  const prefixed = locale ? `/${locale}${permalink}` : permalink;
  return definitivePermalink(prefixed);
};
```

**Purpose**: Generates locale-aware permalinks for all content types.

**Key Feature**: Automatically prefixes paths with locale code when provided.

---

## 4. Middleware System

### 4.1 Middleware: `src/middleware.js`

**Location**: [`src/middleware.js`](src/middleware.js:1-22)

```javascript
import * as main from './locales/main.loader.js';
import * as navigation from './locales/navigation.loader.server.js';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { locales } from './locales/data.js';
import { I18N } from 'astrowind:config';

let ready = false;
const readyPromise = Promise.all([
  loadLocales(main.key, main.loadIDs, main.loadCatalog, locales),
  loadLocales(navigation.key, navigation.loadIDs, navigation.loadCatalog, locales),
]).then(() => {
  ready = true;
});

export async function onRequest(context, next) {
  if (!ready) {
    await readyPromise;
  }
  const locale = context.params.locale ?? I18N.defaultLocale;
  return runWithLocale(locale, next);
}
```

**Purpose**: Loads Wuchale translation catalogs and sets locale context for each request.

**Critical Behavior**:
- Loads both `main` and `navigation` catalogs on startup
- Waits for catalogs to be ready before processing requests
- Extracts locale from URL params or falls back to default
- Wraps request handler with `runWithLocale()` for translation context

**Dependency Chain**: Wuchale loaders → Middleware → Request handlers

---

## 5. Content Collections

### 5.1 Content Config: `src/content/config.ts`

**Location**: [`src/content/config.ts`](src/content/config.ts:49-79)

```typescript
const postCollection = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/data/post' }),
  schema: z.object({
    publishDate: z.date().optional(),
    updateDate: z.date().optional(),
    draft: z.boolean().optional(),
    title: z.string(),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    metadata: metadataDefinition(),
  }),
});

const pagesCollection = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx'], base: 'src/data/pages' }),
  schema: z.object({
    title: z.string(),
  }),
});
```

**Purpose**: Defines content collections for blog posts and pages.

**Locale Strategy**: Content files are organized by locale in directory structure:
- `src/data/post/{locale}/` - Blog posts
- `src/data/pages/{locale}/` - Markdown pages

### 5.2 Blog Utilities: `src/utils/blog.ts`

**Location**: [`src/utils/blog.ts`](src/utils/blog.ts:9-120)

```typescript
const getLangFromPostId = (id: string): string => id.split('/')[0];

const load = async function (lang?: string): Promise<Array<Post>> {
  const posts = await getCollection('post');
  const normalizedPosts = posts.map(async (post) => await getNormalizedPost(post));

  let results = (await Promise.all(normalizedPosts))
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf())
    .filter((post) => !post.draft);

  if (lang) {
    results = results.filter((post) => getLangFromPostId(post.id) === lang);
  }

  return results;
};

export const getStaticPathsBlogPost = async (): Promise<Array<{
  params: { locale: string; blog: string };
  props: { post: Post; locale: string };
}>> => {
  const paths = [];
  for (const locale of LOCALES) {
    const posts = await load(locale);
    for (const post of posts) {
      paths.push({
        params: { locale, blog: post.permalink },
        props: { post, locale },
      });
    }
  }
  return paths;
};
```

**Purpose**: Loads and filters blog posts by locale.

**Key Functions**:
- `getLangFromPostId()`: Extracts locale from post ID (first path segment)
- `load()`: Loads all posts, optionally filtered by locale
- `getStaticPathsBlogPost()`: Generates static paths for all locale-post combinations

### 5.3 Page Utilities: `src/utils/pages.ts`

**Location**: [`src/utils/pages.ts`](src/utils/pages.ts:7-93)

```typescript
const getLangFromPageId = (id: string): string => id.split('/')[0];

const load = async function (lang?: string): Promise<Array<NormalizedPage>> {
  const pages = await getCollection('pages');
  const normalizedPages = pages.map(async (page) => await getNormalizedPage(page));

  let results = await Promise.all(normalizedPages);

  if (lang) {
    results = results.filter((page) => getLangFromPageId(page.id) === lang);
  }

  return results;
};

export const getStaticPathsPages = async (): Promise<Array<{
  params: { locale: string; pages: string };
  props: { page: NormalizedPage; locale: string };
}>> => {
  const paths = [];
  for (const locale of LOCALES) {
    const pages = await load(locale);
    for (const page of pages) {
      paths.push({
        params: { locale, pages: `pages/${page.slug}` },
        props: { page, locale },
      });
    }
  }
  return paths;
};
```

**Purpose**: Loads and filters markdown pages by locale.

**Pattern**: Identical to blog utilities but for pages collection.

---

## 6. Navigation System

### 6.1 Navigation: `src/navigation.ts`

**Location**: [`src/navigation.ts`](src/navigation.ts:1-189)

```typescript
export const getHeaderData = (locale: string = DEFAULT_LOCALE) => ({
  links: [
    {
      text: 'Homes',
      links: [
        { text: 'SaaS', href: getPermalink('/homes/saas', 'page', locale) },
        { text: 'Startup', href: getPermalink('/homes/startup', 'page', locale) },
        // ...
      ],
    },
    // ...
  ],
  actions: [{ text: 'Download', href: 'https://github.com/arthelokyo/astrowind', target: '_blank' }],
});

export const getFooterData = (locale: string = DEFAULT_LOCALE) => ({
  links: [
    {
      title: 'Product',
      links: [
        { text: 'Features', href: '#' },
        // ...
      ],
    },
    // ...
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPagePermalink('terms', locale) },
    { text: 'Privacy Policy', href: getPagePermalink('privacy', locale) },
  ],
  // ...
});
```

**Purpose**: Generates navigation data with locale-aware links.

**Translation Strategy**: Navigation `text` values are extracted by Wuchale and translated via `.po` files.

**Usage**: Called from layouts with current locale parameter.

---

## 7. Components

### 7.1 Locale Switcher: `src/components/common/LocaleSwitcher.astro`

**Location**: [`src/components/common/LocaleSwitcher.astro`](src/components/common/LocaleSwitcher.astro:1-98)

```astro
---
import { getRelativeLocaleUrl } from 'astro:i18n';
import { LOCALES, DEFAULT_LOCALE } from '~/utils/locales';
import { I18N } from 'astrowind:config';

const { currentLocale = Astro.currentLocale || 'en', showLabels = false, class: className = '' } = Astro.props;

const getPathWithoutLocale = (pathname: string) => {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      const withoutLocale = pathname.replace(`/${locale}`, '');
      return withoutLocale === '' ? '' : withoutLocale;
    }
  }
  return pathname;
};

const currentPathWithoutLocale = getPathWithoutLocale(Astro.url.pathname);

const getLocaleDisplayName = (localeCode: string): string => {
  return I18N.localeNames?.[localeCode] || localeCode.toUpperCase();
};
---

<div class="relative inline-block">
  <button data-aw-toggle-locale>
    <Icon name="tabler:language" />
    {showLabels && <span>{currentLocale.toUpperCase()}</span>}
  </button>

  <div data-aw-locale-dropdown>
    <ul>
      {LOCALES.map((locale: string) => {
        let url: string;
        try {
          url = getRelativeLocaleUrl(locale, currentPathWithoutLocale);
          if (url.endsWith('/') && url !== '/') {
            url = url.slice(0, -1);
          }
        } catch {
          const shouldPrefix = locale !== DEFAULT_LOCALE;
          const cleanPath = currentPathWithoutLocale === '/' ? '' : currentPathWithoutLocale;
          url = shouldPrefix ? `/${locale}${cleanPath}` : cleanPath || '/';
        }

        return (
          <li>
            <a href={url} hreflang={locale} aria-current={locale === currentLocale ? 'page' : undefined}>
              <span>{getLocaleDisplayName(locale)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  </div>
</div>
```

**Purpose**: Dropdown component for switching between locales.

**Key Features**:
- Generates locale-specific URLs for current page
- Uses `getRelativeLocaleUrl()` with fallback to manual construction
- Displays locale names from config
- Highlights current locale

### 7.2 Main Layout: `src/layouts/Layout.astro`

**Location**: [`src/layouts/Layout.astro`](src/layouts/Layout.astro:1-83)

```astro
---
import { I18N } from 'astrowind:config';
import { LOCALES } from '~/utils/locales';
import { getRelativeLocaleUrl } from 'astro:i18n';

const { language: defaultLanguage, textDirection } = I18N;
const currentLocale = Astro.currentLocale || defaultLanguage;
const currentPath = Astro.url.pathname;

const getPathWithoutLocale = (pathname: string) => {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.replace(`/${locale}`, '') || '/';
    }
  }
  return pathname;
};

const currentPathWithoutLocale = getPathWithoutLocale(currentPath);
---

<!doctype html>
<html lang={currentLocale} dir={textDirection}>
  <head>
    <!-- hreflang tags for i18n -->
    {
      (() => {
        const removeTrailingSlash = (url: string) => (url.endsWith('/') && url !== '/' ? url.slice(0, -1) : url);
        const enUrl = removeTrailingSlash(getRelativeLocaleUrl('en', currentPathWithoutLocale));
        const esUrl = removeTrailingSlash(getRelativeLocaleUrl('es', currentPathWithoutLocale));
        return (
          <>
            <link rel="alternate" hreflang="en" href={enUrl} />
            <link rel="alternate" hreflang="es" href={esUrl} />
            <link rel="alternate" hreflang="x-default" href={enUrl} />
          </>
        );
      })()
    }
  </head>
  <body>
    <slot />
  </body>
</html>
```

**Purpose**: Root layout with i18n metadata and hreflang tags.

**Key Features**:
- Sets `lang` and `dir` attributes on `<html>` element
- Generates hreflang tags for SEO (currently hardcoded to en/es)
- Uses `Astro.currentLocale` for current locale detection

**Issue**: hreflang tags are hardcoded to only `en` and `es`, not dynamic based on `LOCALES`.

### 7.3 Page Layout: `src/layouts/PageLayout.astro`

**Location**: [`src/layouts/PageLayout.astro`](src/layouts/PageLayout.astro:1-35)

```astro
---
import { getHeaderData, getFooterData } from '~/navigation';

const { metadata } = Astro.props;
const locale = Astro.currentLocale || 'en';
const headerData = getHeaderData(locale);
const footerData = getFooterData(locale);
---

<Layout metadata={metadata}>
  <slot name="header">
    <Header {...headerData} isSticky showRssFeed showToggleTheme showLocaleSwitcher />
  </slot>
  <main>
    <slot />
  </main>
  <slot name="footer">
    <Footer {...footerData} />
  </slot>
</Layout>
```

**Purpose**: Page layout that passes locale to navigation components.

**Pattern**: Extracts current locale and passes to `getHeaderData()` and `getFooterData()`.

### 7.4 Metadata Component: `src/components/common/Metadata.astro`

**Location**: [`src/components/common/Metadata.astro`](src/components/common/Metadata.astro:1-69)

```astro
---
import { SITE, METADATA, I18N } from 'astrowind:config';

const seoProps: AstroSeoProps = merge(
  {
    openGraph: {
      locale: I18N?.language || 'en',
      type: 'website',
    },
  },
  // ...
);
---

<AstroSeo {...seoProps} />
```

**Purpose**: Sets OpenGraph locale metadata.

**Issue**: Uses `I18N.language` (default language) instead of current locale.

---

## 8. Auto-Generated Files

### 8.1 Locale Data: `src/locales/data.js`

**Location**: [`src/locales/data.js`](src/locales/data.js:1-2)

```javascript
export const sourceLocale = 'en'
export const locales = ['en','es','fr','de']
```

**Purpose**: Auto-generated by Wuchale with locale configuration.

**Status**: Should match `src/config.yaml` but is a separate source of truth.

### 8.2 Main Loader: `src/locales/main.loader.js`

**Location**: [`src/locales/main.loader.js`](src/locales/main.loader.js:1-16)

```javascript
import { currentRuntime } from 'wuchale/load-utils/server'
import { loadCatalog, loadIDs } from './.wuchale/main.proxy.sync.js'

const key = 'main'

export { loadCatalog, loadIDs, key }

export const getRuntime = (loadID) => currentRuntime(key, loadID)
export const getRuntimeRx = getRuntime
```

**Purpose**: Template for Wuchale main catalog loader.

**Generated**: Actual loader is generated in `.wuchale/main.proxy.sync.js`.

### 8.3 Navigation Loader: `src/locales/navigation.loader.server.js`

**Location**: [`src/locales/navigation.loader.server.js`](src/locales/navigation.loader.server.js:1-10)

```javascript
import { loadLocales } from 'wuchale/load-utils/server';
import { loadCatalog, loadIDs } from './.wuchale/navigation.proxy.sync.js';
import { locales } from './data.js';

const key = 'navigation';

export const getRuntime = await loadLocales(key, loadIDs, loadCatalog, locales);
export const getRuntimeRx = getRuntime;
export { loadCatalog, loadIDs, key };
```

**Purpose**: Server-side loader for navigation catalog.

**Difference**: Uses `loadLocales()` (async) instead of `currentRuntime()` (sync).

---

## 9. Root Index Page

### 9.1 Index: `src/pages/index.astro`

**Location**: [`src/pages/index.astro`](src/pages/index.astro:1-5)

```astro
---
// This root index page is required for Astro i18n with prefixDefaultLocale: true
// It will be automatically redirected to the default locale (/en/) by Astro's i18n middleware
// No content needed here
---
```

**Purpose**: Empty page that redirects to default locale.

**Required By**: Astro's i18n routing with `prefixDefaultLocale: true`.

---

## 10. Architectural Issues

### 10.1 Configuration Redundancy

**Issue**: Locale configuration exists in multiple places:
1. `src/config.yaml` (primary)
2. `src/locales/data.js` (auto-generated by Wuchale)
3. `astro.config.ts` (reads from YAML)
4. `wuchale.config.js` (reads from YAML)

**Risk**: Configuration drift if sources become out of sync.

**Current Mitigation**: All sources read from `src/config.yaml`, but `src/locales/data.js` is generated separately.

### 10.2 Hardcoded hreflang Tags

**Location**: [`src/layouts/Layout.astro`](src/layouts/Layout.astro:60-74)

**Issue**: hreflang tags are hardcoded to only `en` and `es`:

```astro
const enUrl = removeTrailingSlash(getRelativeLocaleUrl('en', currentPathWithoutLocale));
const esUrl = removeTrailingSlash(getRelativeLocaleUrl('es', currentPathWithoutLocale));
return (
  <>
    <link rel="alternate" hreflang="en" href={enUrl} />
    <link rel="alternate" hreflang="es" href={esUrl} />
    <link rel="alternate" hreflang="x-default" href={enUrl} />
  </>
);
```

**Impact**: Missing hreflang tags for `fr` and `de` locales, affecting SEO.

**Fix Required**: Generate hreflang tags dynamically from `LOCALES` array.

### 10.3 Incorrect OpenGraph Locale

**Location**: [`src/components/common/Metadata.astro`](src/components/common/Metadata.astro:39)

**Issue**: Uses `I18N.language` (default language) instead of current locale:

```astro
openGraph: {
  locale: I18N?.language || 'en',  // Should be currentLocale
  type: 'website',
},
```

**Impact**: All pages show same OpenGraph locale regardless of actual page locale.

**Fix Required**: Use `Astro.currentLocale` or pass locale as prop.

### 10.4 Duplicate Path Stripping Logic

**Issue**: `getPathWithoutLocale()` function is duplicated in multiple files:
1. [`src/layouts/Layout.astro`](src/layouts/Layout.astro:33-41)
2. [`src/components/common/LocaleSwitcher.astro`](src/components/common/LocaleSwitcher.astro:16-26)

**Impact**: Maintenance burden and potential inconsistency.

**Fix Required**: Extract to shared utility in `src/utils/i18n.ts`.

### 10.5 Navigation Translation Coupling

**Issue**: Navigation strings are extracted via Wuchale's vanilla adapter with custom heuristic:

```javascript
heuristic: (node, context) => {
  if (node.type === 'Literal' || node.type === 'StringLiteral') {
    const parent = context.parent;
    if (parent && parent.type === 'Property' && (parent.key.name === 'text' || parent.key.name === 'title')) {
      return { type: 'script', message: node.value };
    }
  }
  return null;
},
```

**Impact**: Fragile - depends on AST structure of `src/navigation.ts`.

**Risk**: Changes to navigation structure could break extraction.

---

## 11. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    src/config.yaml                              │
│  (Single Source of Truth for i18n Configuration)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ astro.config.ts │ │wuchale.config│ │vendor/integration│
│ (Astro i18n)   │ │.js           │ │(Virtual Module)  │
└────────┬────────┘ └──────┬───────┘ └────────┬─────────┘
         │                 │                    │
         ▼                 ▼                    ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│Astro Routing    │ │Wuchale       │ │astrowind:config  │
│/[locale]/...    │ │String        │ │Virtual Module    │
└─────────────────┘ │Extraction    │ └────────┬─────────┘
                   │              │          │
                   └──────┬───────┘          │
                          │                  │
                          ▼                  ▼
                   ┌──────────────┐ ┌──────────────────┐
                   │.po files     │ │I18N, LOCALES,    │
                   │(Translations)│ │DEFAULT_LOCALE    │
                   └──────────────┘ └──────────────────┘
                          │                  │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │src/middleware.js │
                          │(Load Catalogs)  │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │Request Handlers  │
                          │(runWithLocale)  │
                          └──────────────────┘
```

---

## 12. File Inventory

### Configuration Files
| File | Purpose | Lines |
|------|---------|-------|
| [`src/config.yaml`](src/config.yaml:30-40) | Primary i18n configuration | 11 |
| [`astro.config.ts`](astro.config.ts:24-54) | Astro i18n routing config | 31 |
| [`wuchale.config.js`](wuchale.config.js:9-44) | Wuchale extraction config | 36 |

### Utility Files
| File | Purpose | Lines |
|------|---------|-------|
| [`src/utils/locales.ts`](src/utils/locales.ts:1-16) | Locale constants | 16 |
| [`src/utils/i18n.ts`](src/utils/i18n.ts:1-75) | I18n utility functions | 75 |
| [`src/utils/permalinks.ts`](src/utils/permalinks.ts:42-86) | Locale-aware permalinks | 45 |
| [`src/utils/blog.ts`](src/utils/blog.ts:9-296) | Blog locale utilities | 288 |
| [`src/utils/pages.ts`](src/utils/pages.ts:7-93) | Pages locale utilities | 87 |

### Middleware & Routing
| File | Purpose | Lines |
|------|---------|-------|
| [`src/middleware.js`](src/middleware.js:1-22) | Wuchale catalog loader | 22 |
| [`src/navigation.ts`](src/navigation.ts:1-189) | Locale-aware navigation | 189 |

### Components
| File | Purpose | Lines |
|------|---------|-------|
| [`src/components/common/LocaleSwitcher.astro`](src/components/common/LocaleSwitcher.astro:1-98) | Locale switcher UI | 98 |
| [`src/layouts/Layout.astro`](src/layouts/Layout.astro:1-83) | Root layout with i18n | 83 |
| [`src/layouts/PageLayout.astro`](src/layouts/PageLayout.astro:1-35) | Page layout with locale | 35 |
| [`src/components/common/Metadata.astro`](src/components/common/Metadata.astro:1-69) | OpenGraph metadata | 69 |

### Auto-Generated Files
| File | Purpose | Lines |
|------|---------|-------|
| [`src/locales/data.js`](src/locales/data.js:1-2) | Locale data | 2 |
| [`src/locales/main.loader.js`](src/locales/main.loader.js:1-16) | Main catalog loader | 16 |
| [`src/locales/navigation.loader.server.js`](src/locales/navigation.loader.server.js:1-10) | Navigation catalog loader | 10 |

### Integration Files
| File | Purpose | Lines |
|------|---------|-------|
| [`vendor/integration/index.ts`](vendor/integration/index.ts:25-56) | Virtual module creation | 32 |
| [`vendor/integration/utils/configBuilder.ts`](vendor/integration/utils/configBuilder.ts:124-145) | I18N config builder | 22 |

---

## 13. Summary

### Strengths
1. **Single Source of Truth**: `src/config.yaml` is the primary configuration source
2. **Clear Separation**: Configuration, utilities, middleware, and components are well-separated
3. **Framework Integration**: Leverages Astro's built-in i18n routing effectively
4. **Compile-Time Translation**: Wuchale provides efficient compile-time string extraction
5. **Content Localization**: Content collections organized by locale directory structure

### Weaknesses
1. **Configuration Redundancy**: Multiple sources could drift out of sync
2. **Hardcoded hreflang**: Missing dynamic generation for all locales
3. **Incorrect OpenGraph Locale**: Uses default instead of current locale
4. **Code Duplication**: `getPathWithoutLocale()` duplicated across files
5. **Fragile Extraction**: Navigation string extraction depends on AST structure

### Recommendations
1. Consolidate locale configuration to eliminate redundancy
2. Generate hreflang tags dynamically from `LOCALES` array
3. Fix OpenGraph locale to use current locale
4. Extract `getPathWithoutLocale()` to shared utility
5. Add tests for navigation string extraction heuristic
