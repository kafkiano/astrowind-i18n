import { getPermalink, getPagePermalink, trimSlash } from './permalinks';
import { I18N, NAVIGATION } from 'astrowind:config';
import type { AutoNavPage, AutoNavConfig, NavigationData, FooterData, NavigationLink, Links, Link } from '~/types';

/**
 * Check if a path segment is a rest parameter (starts with [...])
 * This excludes structural dynamic segments like [category] and [tag]
 */
function isDynamicSegment(segment: string): boolean {
  return segment.startsWith('[...');
}

/**
 * Extract route path from a file path
 * e.g., /src/pages/[locale]/homes/saas.astro -> /homes/saas
 * e.g., /src/pages/[locale]/homes/index.astro -> /homes
 */
function extractRoutePath(filePath: string): string {
  // Remove /src/pages/[locale]/ prefix
  const withoutPrefix = filePath.replace(/^\/src\/pages\/\[locale\]/, '');
  // Remove file extension
  const withoutExt = withoutPrefix.replace(/\.(astro|md|mdx)$/, '');
  // Handle index files at any level (e.g., /index -> /, /homes/index -> /homes)
  const segments = withoutExt.split('/').filter(Boolean);
  if (segments.length > 0 && segments[segments.length - 1] === 'index') {
    segments.pop(); // Remove 'index' segment
    const pathWithoutIndex = segments.join('/');
    return pathWithoutIndex === '' ? '/' : trimSlash(pathWithoutIndex);
  }
  if (withoutExt === '' || withoutExt === '/') {
    return '/';
  }
  return trimSlash(withoutExt);
}

/**
 * Scan pages for navigation generation and build hierarchical structure
 * @param locale - The locale to generate permalinks for
 * @param visibility - Filter by visibility ('header', 'footer', or undefined for all)
 * @param options - Additional options
 * @returns Hierarchical NavigationLink array
 */
function scanPages(
  locale: string,
  visibility?: 'header' | 'footer',
  options?: { skipDynamic?: boolean }
): NavigationLink[] {
  const { skipDynamic = false } = options ?? {};

  // Vite requires LITERAL glob patterns - no variables allowed
  // Single pattern covers all file types: {astro,md,mdx}
  const pageModules = import.meta.glob<{
    navigation?: AutoNavConfig;
  }>('/src/pages/[locale]/**/*.{astro,md,mdx}', { eager: true });

  // Flat array with all pages and their metadata
  type PageWithMeta = {
    path: string;
    title: string;
    href: string;
    navigation: AutoNavConfig;
    isGroup?: boolean;
  };

  let pages: PageWithMeta[] = [];

  for (const [filePath, module] of Object.entries(pageModules)) {
    const routePath = extractRoutePath(filePath);

    // Skip index.astro (home page) from navigation
    if (routePath === '/' || routePath === '/index') {
      continue;
    }

    // Skip dynamic routes if requested
    if (skipDynamic) {
      const segments = routePath.split('/').filter(Boolean);
      const hasDynamicSegment = segments.some(isDynamicSegment);
      if (hasDynamicSegment) {
        continue;
      }
    }

    // Extract navigation
    const navigation = module.navigation;

    // Skip pages without navigation export
    if (!navigation) {
      continue;
    }

    const title = navigation.title;

    // Skip pages without navigation.title
    if (!title) {
      console.warn(`Page ${routePath} omitted from navigation: missing navigation.title`);
      continue;
    }

    // Check visibility filter
    const showIn = navigation?.showIn;
    const shouldShow = !showIn || showIn === visibility;
    if (visibility && !shouldShow) {
      continue;
    }

    // Determine type and slug
    const type = navigation?.type ?? 'page';
    const slug = navigation?.slug ?? routePath;

    // Validation: category and tag types require a slug
    if ((type === 'category' || type === 'tag') && !slug) {
      console.warn(`Page ${routePath} omitted from navigation: ${type} requires a slug`);
      continue;
    }

    // Generate href with locale awareness
    const href = getPermalink(slug, type, locale);

    pages.push({
      path: routePath,
      title,
      href,
      navigation,
      isGroup: type === 'group',
    });
  }

  // Helper: sort pages by order and title
  function sortPageMeta(items: PageWithMeta[]): PageWithMeta[] {
    return [...items].sort((a, b) => {
      const aOrder = a.navigation?.order ?? Infinity;
      const bOrder = b.navigation?.order ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.title.localeCompare(b.title);
    });
  }

  // Type-based grouping for blog pages
  // Blog page acts as parent for category and tag pages
  const blogPage = pages.find((p) => p.navigation?.type === 'blog');
  const blogChildren = pages.filter((p) => p.navigation?.type === 'category' || p.navigation?.type === 'tag');

  // Build blog group if blog page exists and has children
  const blogGroupLinks: NavigationLink[] = [];
  if (blogPage && blogChildren.length > 0) {
    const sortedChildren = sortPageMeta(blogChildren);
    blogGroupLinks.push({
      title: blogPage.title,
      href: blogPage.href, // Keep parent clickable
      links: sortedChildren.map((child) => ({
        title: child.title,
        href: child.href,
      })),
    });
    // Remove blogPage and its children from further processing
    pages = pages.filter((p) => p !== blogPage && !blogChildren.includes(p));
  }

  // Post-processing: Build hierarchical structure
  // Separate groups from leaf pages
  const groups = pages.filter((p) => p.isGroup);
  const leafPages = pages.filter((p) => !p.isGroup);

  // Build a Map of groups keyed by their directory path
  // For a group at path /homes, its directory is /homes
  const groupsByDirectory = new Map<string, PageWithMeta>();
  for (const group of groups) {
    // Group directory is the path itself (e.g., /homes)
    groupsByDirectory.set(group.path, group);
  }

  // For each group, find its children (pages whose path starts with group.path + '/')
  const groupLinks: NavigationLink[] = [];

  // First, create group nodes with their children (sorted by group order)
  for (const group of sortPageMeta(groups)) {
    const groupDir = group.path + '/';
    const children = leafPages.filter((page) => page.path.startsWith(groupDir));

    // Only include group if it has visible children
    if (children.length > 0) {
      // Sort children by order
      const sortedChildren = sortPageMeta(children);

      groupLinks.push({
        title: group.title,
        links: sortedChildren.map((child) => ({
          title: child.title,
          href: child.href,
        })),
      });
    }
  }

  // Second, add top-level pages (leaf pages not belonging to any group)
  const topLevelLinks: NavigationLink[] = [];

  for (const page of leafPages) {
    // Check if this page belongs to any group
    let belongsToGroup = false;
    for (const groupPath of groupsByDirectory.keys()) {
      if (page.path.startsWith(groupPath + '/')) {
        belongsToGroup = true;
        break;
      }
    }

    // If not part of any group, add as top-level link
    if (!belongsToGroup) {
      topLevelLinks.push({
        title: page.title,
        href: page.href,
      });
    }
  }

  // Sort top-level links by order
  const sortedTopLevel = sortPageMeta(
    topLevelLinks.map((link) => ({
      path: link.href || '',
      title: link.title,
      href: link.href || '',
      navigation: { order: 0 },
    }))
  ).map((item) => ({
    title: item.title,
    href: item.href,
  }));

  // Return combined: blog group first, then other groups, then top-level pages
  return [...blogGroupLinks, ...groupLinks, ...sortedTopLevel];
}

/**
 * Generate navigation data for a specific locale
 */
export function generateNavigation(locale: string = I18N.defaultLocale): NavigationData {
  // Scan pages for header navigation - returns hierarchical structure directly
  const links = scanPages(locale, 'header', { skipDynamic: false });

  const result: NavigationData = {
    links,
    actions: NAVIGATION.actions || [],
  };

  return result;
}

/**
 * Generate footer data for a specific locale
 */
export function generateFooterData(locale: string = I18N.defaultLocale): FooterData {
  // Scan pages for footer navigation - returns hierarchical structure directly
  const navLinks = scanPages(locale, 'footer', { skipDynamic: true });

  // Convert NavigationLink[] to Links[] format for footer
  const links: Links[] = [];

  for (const navLink of navLinks) {
    if (navLink.links && navLink.links.length > 0) {
      // Group: convert children to Link[] format
      links.push({
        title: navLink.title,
        links: navLink.links.map((child) => ({
          text: child.title,
          href: child.href,
        })),
      });
    } else if (navLink.href) {
      // Top-level page: add as a standalone link group
      links.push({
        title: '',
        links: [{ text: navLink.title, href: navLink.href }],
      });
    }
  }

  return {
    links,
    secondaryLinks: (NAVIGATION.footer?.secondaryLinks || []).map((link: { text: string; page: string }) => ({
      text: link.text,
      href: getPagePermalink(link.page, locale),
    })),
    /* @wc-ignore */
    footNote: NAVIGATION.footer?.footNote || '',
  };
}

/**
 * Get header navigation data (wrapper for backward compatibility)
 */
export const getHeaderData = (locale: string = I18N.defaultLocale) => generateNavigation(locale);

/**
 * Get footer navigation data (wrapper for backward compatibility)
 */
export const getFooterData = (locale: string = I18N.defaultLocale) => generateFooterData(locale);
