import { getPermalink, getBlogPermalink, getPagePermalink } from './permalinks';
import { DEFAULT_LOCALE } from './locales';
import type { AutoNavPage, AutoNavConfig, NavigationData, FooterData, NavigationLink, Links } from '~/types';
import { APP_BLOG } from 'astrowind:config';

/**
 * Check if a path segment is a rest parameter (starts with [...])
 * This excludes structural dynamic segments like [category] and [tag]
 */
function isDynamicSegment(segment: string): boolean {
  return segment.startsWith('[...');
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
  const lastSegment = segments[segments.length - 1];
  return lastSegment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Sort pages by navigation.order (ascending), with alphabetical order as tie-breaker
 */
function sortPages(pages: AutoNavPage[]): AutoNavPage[] {
  return pages.sort((a, b) => {
    const aOrder = a.navigation?.order ?? Infinity;
    const bOrder = b.navigation?.order ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  });
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
 * Transform NavigationLink[] to Links[] for footer consumption
 * Maps parent nodes to footer sections (Links) and child nodes to footer links (Link)
 */
function navigationLinksToFooterLinks(navLinks: NavigationLink[]): Links[] {
  return navLinks.map((section) => ({
    title: section.text || section.title || '',
    links: (section.links || []).map((link) => ({
      text: link.text || '',
      href: link.href || '#',
    })),
  }));
}

/**
 * Generate navigation data for a specific locale
 */
export function generateNavigation(locale: string = DEFAULT_LOCALE): NavigationData {
  // Scan all pages
  const pageModules = import.meta.glob<{
    navigation?: AutoNavConfig; // Now includes title
  }>('/src/pages/[locale]/**/*.astro', { eager: true });

  const pages: AutoNavPage[] = [];

  for (const [filePath, module] of Object.entries(pageModules)) {
    const routePath = extractRoutePath(filePath);

    // Skip index.astro (home page) from navigation
    if (routePath === '/' || routePath === '/index') {
      continue;
    }

    // Extract navigation
    const navigation = module.navigation;
    const title = navigation?.title;

    // Skip pages without navigation.title
    if (!title) {
      console.warn(`Page ${routePath} omitted from navigation: missing navigation.title`);
      continue;
    }

    // Check if page should be shown in header
    if (navigation?.showIn && !navigation.showIn.includes('header')) {
      continue;
    }

    // Generate href based on route path
    const href = getPermalink(routePath, 'page', locale);

    pages.push({
      path: routePath,
      title,
      href,
      navigation,
    });
  }

  // Sort pages by order before building navigation tree
  const sortedPages = sortPages(pages);

  // Build navigation tree
  const links = buildNavigationTree(sortedPages);

  // Add blog section only if blog is enabled
  if (APP_BLOG?.isEnabled) {
    const blogLinks: NavigationLink[] = [
      {
        text: 'Blog List',
        href: getBlogPermalink(locale),
      },
    ];

    // Add category link if categories are enabled
    if (APP_BLOG.category?.isEnabled) {
      blogLinks.push({
        text: 'Categories',
        href: getPermalink('tutorials', 'category', locale),
      });
    }

    // Add tag link if tags are enabled
    if (APP_BLOG.tag?.isEnabled) {
      blogLinks.push({
        text: 'Tags',
        href: getPermalink('astro', 'tag', locale),
      });
    }

    links.push({
      text: 'Blog',
      links: blogLinks,
    });
  }

  const result: NavigationData = {
    links,
    actions: [{ text: 'Download', href: 'https://github.com/arthelokyo/astrowind', target: '_blank' }],
  };

  return result;
}

/**
 * Generate footer data for a specific locale
 */
export function generateFooterData(locale: string = DEFAULT_LOCALE): FooterData {
  // Scan all pages for footer links
  const pageModules = import.meta.glob<{
    navigation?: AutoNavConfig; // Now includes title
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

    // Extract navigation
    const navigation = module.navigation;
    const title = navigation?.title;

    // Skip pages without navigation.title
    if (!title) {
      console.warn(`Page ${routePath} omitted from footer: missing navigation.title`);
      continue;
    }

    // Check if page should be shown in footer
    if (navigation?.showIn && !navigation.showIn.includes('footer')) {
      continue;
    }

    // Generate href
    const href = getPermalink(routePath, 'page', locale);

    footerPages.push({
      path: routePath,
      title,
      href,
      navigation,
    });
  }

  // Build footer links using automatic grouping (same as header)
  const sortedFooterPages = sortPages(footerPages);
  const navLinks = buildNavigationTree(sortedFooterPages);
  const links = navigationLinksToFooterLinks(navLinks);

  const result: FooterData = {
    links,
    secondaryLinks: [
      { text: 'Terms', href: getPagePermalink('terms', locale) },
      { text: 'Privacy Policy', href: getPagePermalink('privacy', locale) },
    ],
    /* @wc-ignore */
    footNote: `
      Made by <a class="text-blue-600 underline dark:text-muted" href="https://github.com/arthelokyo"> Arthelokyo</a> · All rights reserved.
    `,
  };

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
