import { getPermalink, getBlogPermalink, getPagePermalink, getAsset } from './permalinks';
import { DEFAULT_LOCALE } from './locales';
import type { AutoNavPage, AutoNavConfig, NavigationData, FooterData, NavigationLink } from '~/types';

// Cache for navigation data per locale
const navigationCache = new Map<string, NavigationData>();
const footerCache = new Map<string, FooterData>();

/**
 * Check if a path segment is dynamic (contains [ or ])
 */
function isDynamicSegment(segment: string): boolean {
  return segment.includes('[') || segment.includes(']');
}

/**
 * Extract the route path from a file path
 * e.g., /src/pages/[locale]/homes/saas.astro -> /homes/saas
 */
function extractRoutePath(filePath: string): string {
  // Remove /src/pages/[locale]/ prefix
  const withoutPrefix = filePath.replace(/^\/src\/pages\/\[locale\]/, '');
  // Remove file extension
  const withoutExt = withoutPrefix.replace(/\.(astro|md|mdx)$/, '');
  // Handle index files
  if (withoutExt === '/index' || withoutExt === 'index') {
    return '/';
  }
  return withoutExt;
}

/**
 * Format a title from a filename or path
 * e.g., 'mobile-app' -> 'Mobile App', 'about' -> 'About'
 */
function formatTitle(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || 'Home';
  return lastSegment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a navigation tree from flat page list
 */
function buildNavigationTree(pages: AutoNavPage[]): NavigationLink[] {
  const tree: Map<string, NavigationLink> = new Map();
  const rootLinks: NavigationLink[] = [];

  // Group pages by their parent directory
  for (const page of pages) {
    const segments = page.path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      // Root page (index)
      continue;
    }

    if (segments.length === 1) {
      // Top-level page
      rootLinks.push({
        text: page.title,
        href: page.href,
      });
    } else {
      // Nested page - group under parent
      const parentKey = segments[0];
      const parentTitle = formatTitle(parentKey);

      if (!tree.has(parentKey)) {
        const parentLink: NavigationLink = {
          text: parentTitle,
          links: [],
        };
        tree.set(parentKey, parentLink);
        rootLinks.push(parentLink);
      }

      const parent = tree.get(parentKey)!;
      if (parent.links) {
        parent.links.push({
          text: page.title,
          href: page.href,
        });
      }
    }
  }

  // Sort links by order if specified, otherwise by title
  const sortLinks = (links: NavigationLink[]): NavigationLink[] => {
    return links.sort((a, b) => {
      // If both have order, sort by order
      // Otherwise, sort alphabetically by text or title
      const aText = a.text || a.title || '';
      const bText = b.text || b.title || '';
      return aText.localeCompare(bText);
    });
  };

  // Sort root links and their children
  const sortedRootLinks = sortLinks(rootLinks);
  for (const link of sortedRootLinks) {
    if (link.links) {
      link.links = sortLinks(link.links);
    }
  }

  return sortedRootLinks;
}

/**
 * Generate navigation data for a specific locale
 */
export function generateNavigation(locale: string = DEFAULT_LOCALE): NavigationData {
  // Check cache
  if (navigationCache.has(locale)) {
    return navigationCache.get(locale)!;
  }

  // Scan all pages
  const pageModules = import.meta.glob<{
    metadata?: { title?: string };
    navigation?: AutoNavConfig;
  }>('/src/pages/[locale]/**/*.{astro,md,mdx}', { eager: true });

  const pages: AutoNavPage[] = [];

  for (const [filePath, module] of Object.entries(pageModules)) {
    const routePath = extractRoutePath(filePath);

    // Skip dynamic routes (except index pages in dynamic directories)
    const segments = routePath.split('/').filter(Boolean);
    const hasDynamicSegment = segments.some(isDynamicSegment);
    if (hasDynamicSegment) {
      continue;
    }

    // Skip index.astro (home page) from navigation
    if (routePath === '/' || routePath === '/index') {
      continue;
    }

    // Extract metadata
    const metadata = (module.metadata as { title?: string }) || {};
    const navigation = module.navigation;
    const title = metadata.title || formatTitle(routePath);

    // Check if page should be shown in header
    if (navigation?.showIn && !navigation.showIn.includes('header')) {
      continue;
    }

    // Generate href based on route path
    let href: string;
    if (routePath.startsWith('/homes/')) {
      href = getPermalink(routePath, 'page', locale);
    } else if (routePath.startsWith('/landing/')) {
      href = getPermalink(routePath, 'page', locale);
    } else if (routePath.startsWith('/pages/')) {
      // Handle pages like /pages/terms
      const slug = routePath.replace('/pages/', '');
      href = getPagePermalink(slug, locale);
    } else {
      href = getPermalink(routePath, 'page', locale);
    }

    pages.push({
      path: routePath,
      title,
      href,
      navigation,
    });
  }

  // Build navigation tree
  const links = buildNavigationTree(pages);

  // Add blog section
  const blogLinks: NavigationLink[] = [
    {
      text: 'Blog List',
      href: getBlogPermalink(locale),
    },
    {
      text: 'Article',
      href: getPermalink('get-started-website-with-astro-tailwind-css', 'post', locale),
    },
    {
      text: 'Article (with MDX)',
      href: getPermalink('markdown-elements-demo-post', 'post', locale),
    },
    {
      text: 'Category Page',
      href: getPermalink('tutorials', 'category', locale),
    },
    {
      text: 'Tag Page',
      href: getPermalink('astro', 'tag', locale),
    },
  ];

  links.push({
    text: 'Blog',
    links: blogLinks,
  });

  const result: NavigationData = {
    links,
    actions: [{ text: 'Download', href: 'https://github.com/arthelokyo/astrowind', target: '_blank' }],
  };

  // Cache result
  navigationCache.set(locale, result);

  return result;
}

/**
 * Generate footer data for a specific locale
 */
export function generateFooterData(locale: string = DEFAULT_LOCALE): FooterData {
  // Check cache
  if (footerCache.has(locale)) {
    return footerCache.get(locale)!;
  }

  // Scan all pages for footer links
  const pageModules = import.meta.glob<{
    metadata?: { title?: string };
    navigation?: AutoNavConfig;
  }>('/src/pages/[locale]/**/*.{astro,md,mdx}', { eager: true });

  const footerPages: AutoNavPage[] = [];

  for (const [filePath, module] of Object.entries(pageModules)) {
    const routePath = extractRoutePath(filePath);

    // Skip dynamic routes
    const segments = routePath.split('/').filter(Boolean);
    const hasDynamicSegment = segments.some(isDynamicSegment);
    if (hasDynamicSegment) {
      continue;
    }

    // Skip index.astro
    if (routePath === '/' || routePath === '/index') {
      continue;
    }

    // Extract metadata
    const metadata = (module.metadata as { title?: string }) || {};
    const navigation = module.navigation;
    const title = metadata.title || formatTitle(routePath);

    // Check if page should be shown in footer
    if (navigation?.showIn && !navigation.showIn.includes('footer')) {
      continue;
    }

    // Generate href
    let href: string;
    if (routePath.startsWith('/pages/')) {
      const slug = routePath.replace('/pages/', '');
      href = getPagePermalink(slug, locale);
    } else {
      href = getPermalink(routePath, 'page', locale);
    }

    footerPages.push({
      path: routePath,
      title,
      href,
      navigation,
    });
  }

  // Build footer links (grouped by category)
  const links: NavigationLink[] = [];

  // Product section
  links.push({
    title: 'Product',
    links: [
      { text: 'Features', href: '#' },
      { text: 'Security', href: '#' },
      { text: 'Team', href: '#' },
      { text: 'Enterprise', href: '#' },
      { text: 'Customer stories', href: '#' },
      { text: 'Pricing', href: '#' },
      { text: 'Resources', href: '#' },
    ],
  });

  // Platform section
  links.push({
    title: 'Platform',
    links: [
      { text: 'Developer API', href: '#' },
      { text: 'Partners', href: '#' },
      { text: 'Atom', href: '#' },
      { text: 'Electron', href: '#' },
      { text: 'AstroWind Desktop', href: '#' },
    ],
  });

  // Support section
  links.push({
    title: 'Support',
    links: [
      { text: 'Docs', href: '#' },
      { text: 'Community Forum', href: '#' },
      { text: 'Professional Services', href: '#' },
      { text: 'Skills', href: '#' },
      { text: 'Status', href: '#' },
    ],
  });

  // Company section
  links.push({
    title: 'Company',
    links: [
      { text: 'About', href: '#' },
      { text: 'Blog', href: '#' },
      { text: 'Careers', href: '#' },
      { text: 'Press', href: '#' },
      { text: 'Inclusion', href: '#' },
      { text: 'Social Impact', href: '#' },
      { text: 'Shop', href: '#' },
    ],
  });

  const result: FooterData = {
    links,
    secondaryLinks: [
      { text: 'Terms', href: getPagePermalink('terms', locale) },
      { text: 'Privacy Policy', href: getPagePermalink('privacy', locale) },
    ],
    socialLinks: [
      { ariaLabel: 'X', icon: 'tabler:brand-x', href: '#' },
      { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
      { ariaLabel: 'Facebook', icon: 'tabler:brand-facebook', href: '#' },
      { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
      { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/arthelokyo/astrowind' },
    ],
    /* @wc-ignore */
    footNote: `
      Made by <a class="text-blue-600 underline dark:text-muted" href="https://github.com/arthelokyo"> Arthelokyo</a> · All rights reserved.
    `,
  };

  // Cache result
  footerCache.set(locale, result);

  return result;
}

/**
 * Get header navigation data (wrapper for backward compatibility)
 */
export const getHeaderData = (locale: string = DEFAULT_LOCALE) => generateNavigation(locale);

/**
 * Get footer navigation data (wrapper for backward compatibility)
 */
export const getFooterData = (locale: string = DEFAULT_LOCALE) => generateFooterData(locale);
