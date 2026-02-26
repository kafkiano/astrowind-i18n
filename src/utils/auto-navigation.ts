import { getPermalink, getPagePermalink, cleanSlug, trimSlash } from './permalinks';
import { I18N, NAVIGATION } from 'astrowind:config';
import type { AutoNavPage, AutoNavConfig, NavigationData, FooterData, NavigationLink, Links } from '~/types';

/**
 * Normalize showIn to array for consistent handling
 * Handles both string ('header') and array (['header', 'footer']) formats
 */
function normalizeShowIn(showIn?: string | string[]): string[] {
  if (!showIn) return [];
  return Array.isArray(showIn) ? showIn : [showIn];
}

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
  return trimSlash(withoutExt);
}

/**
 * Format a title from a filename or path
 * e.g., 'mobile-app' -> 'Mobile App', 'about' -> 'About'
 */
function formatTitle(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const cleaned = cleanSlug(lastSegment);
  return cleaned
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Sort pages by navigation.order (ascending), with alphabetical order as tie-breaker
 */
function sortPages(pages: AutoNavPage[]): AutoNavPage[] {
  return [...pages].sort((a, b) => {
    const aOrder = a.navigation?.order ?? Infinity;
    const bOrder = b.navigation?.order ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Inject virtual parent nodes for directories containing multiple pages
 * Groups pages by first path segment and creates parent nodes for groups with >1 page
 */
function injectDirectoryNodes(pages: AutoNavPage[]): AutoNavPage[] {
  // Group pages by first path segment
  const groups = new Map<string, AutoNavPage[]>();

  for (const page of pages) {
    const segments = page.path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    const firstSegment = segments[0];
    if (!groups.has(firstSegment)) {
      groups.set(firstSegment, []);
    }
    groups.get(firstSegment)!.push(page);
  }

  const result: AutoNavPage[] = [];

  for (const [segment, groupPages] of groups.entries()) {
    if (groupPages.length === 1) {
      // Single page - add directly
      result.push(groupPages[0]);
    } else {
      // Multiple pages - create virtual parent node
      const parentPage: AutoNavPage = {
        path: segment,
        title: formatTitle(segment),
        href: '#', // Virtual parent - no actual page
        navigation: {
          title: formatTitle(segment),
          showIn: ['header'],
        },
      };
      result.push(parentPage);
      // Add child pages
      result.push(...groupPages);
    }
  }

  return result;
}

/**
 * Convert Map-based tree structure to array format
 * Recursively converts _childMap to links array
 */
function convertMapToArray(node: NavigationLink): NavigationLink {
  if (node._childMap && node._childMap.size > 0) {
    node.links = Array.from(node._childMap.values());
    // Recursively convert children
    for (const child of node.links) {
      convertMapToArray(child);
    }
  }
  return node;
}

/**
 * Build a navigation tree from flat page list
 * Supports N-level nesting through recursive tree building
 */
function buildNavigationTree(pages: AutoNavPage[]): NavigationLink[] {
  // Tree structure: Map<pathSegment, NavigationLink>
  const tree: Map<string, NavigationLink> = new Map();

  for (const page of pages) {
    const segments = page.path.split('/').filter(Boolean);

    if (segments.length === 0) {
      // Root page (index) - skip
      continue;
    }

    // Build path recursively
    let currentLevel = tree;
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = i === segments.length - 1;

      if (!currentLevel.has(segment)) {
        // Create new node
        const node: NavigationLink = {
          title: isLeaf ? page.title : formatTitle(segment),
        };

        if (isLeaf) {
          node.href = page.href;
        } else {
          node.links = [];
        }

        currentLevel.set(segment, node);
      } else if (isLeaf) {
        // Update existing leaf node with page data
        const existingNode = currentLevel.get(segment)!;
        existingNode.title = page.title;
        existingNode.href = page.href;
      }

      // Move to next level
      if (!isLeaf) {
        const node = currentLevel.get(segment)!;
        if (!node.links) {
          node.links = [];
        }
        // Create or retrieve child Map for this node to maintain hierarchy
        if (!node._childMap) {
          node._childMap = new Map<string, NavigationLink>();
        }
        currentLevel = node._childMap;
      }
    }
  }

  // Convert tree to array and sort
  const sortLinks = (links: NavigationLink[]): NavigationLink[] => {
    return [...links].sort((a, b) => {
      return a.title.localeCompare(b.title);
    });
  };

  const sortedLinks = sortLinks(Array.from(tree.values()));

  // Convert Map structure to array format
  for (const link of sortedLinks) {
    convertMapToArray(link);
  }

  // Recursively sort children
  const sortChildren = (link: NavigationLink) => {
    if (link.links) {
      link.links = sortLinks(link.links);
      for (const child of link.links) {
        sortChildren(child);
      }
    }
  };

  for (const link of sortedLinks) {
    sortChildren(link);
  }

  return sortedLinks;
}

/**
 * Collapse intermediate nodes that have no href and exactly one child
 * This flattens unnecessary nesting (e.g., Category → Categories)
 */
function collapseSingleChildNodes(links: NavigationLink[]): NavigationLink[] {
  const result: NavigationLink[] = [];

  for (const link of links) {
    // Recursively collapse children first
    if (link.links && link.links.length > 0) {
      link.links = collapseSingleChildNodes(link.links);
    }

    // If this node has no href and exactly one child, merge with child
    if (!link.href && link.links?.length === 1) {
      const child = link.links[0];
      // Merge: keep child's title, href, and links
      result.push({
        title: child.title,
        href: child.href,
        links: child.links,
        _childMap: child._childMap,
      });
    } else {
      result.push(link);
    }
  }

  return result;
}

/**

/**
 * Transform NavigationLink[] to Links[] for footer consumption
 * Maps parent nodes to footer sections (Links) and child nodes to footer links (Link)
 */
function navigationLinksToFooterLinks(navLinks: NavigationLink[]): Links[] {
  return navLinks.map((section) => ({
    title: section.title,
    links: (section.links || []).map((link) => ({
      title: link.title,
      href: link.href,
    })),
  }));
}

/**
 * Scan pages for navigation generation
 * @param locale - The locale to generate permalinks for
 * @param visibility - Filter by visibility ('header', 'footer', or undefined for all)
 * @param options - Additional options
 * @returns Array of pages matching the criteria
 */
function scanPages(
  locale: string,
  visibility?: 'header' | 'footer',
  options?: { skipDynamic?: boolean }
): AutoNavPage[] {
  const { skipDynamic = false } = options ?? {};

  // Vite requires LITERAL glob patterns - no variables allowed
  // Single pattern covers all file types: {astro,md,mdx} already includes .astro
  const pageModules = import.meta.glob<{
    navigation?: AutoNavConfig;
  }>('/src/pages/[locale]/**/*.{astro,md,mdx}', { eager: true });

  const pages: AutoNavPage[] = [];

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
    const title = navigation?.title;

    // Skip pages marked for exclusion
    if (navigation?.exclude) {
      continue;
    }

    // Skip pages without navigation.title
    if (!title) {
      console.warn(`Page ${routePath} omitted from navigation: missing navigation.title`);
      continue;
    }

    // Check visibility filter
    const showInArray = normalizeShowIn(navigation?.showIn);
    const shouldShow = showInArray.length === 0 || showInArray.includes(visibility ?? '');
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
    });
  }

  return pages;
}

/**
 * Generate navigation data for a specific locale
 */
export function generateNavigation(locale: string = I18N.defaultLocale): NavigationData {
  // Scan pages for header navigation
  const pages = scanPages(locale, 'header', { skipDynamic: false });

  // Inject virtual parent nodes for directories
  const pagesWithParents = injectDirectoryNodes(pages);

  // Sort pages by order before building navigation tree
  const sortedPages = sortPages(pagesWithParents);

  // Build navigation tree
  const links = buildNavigationTree(sortedPages);

  // Collapse single-child nodes to flatten unnecessary nesting
  const collapsedLinks = collapseSingleChildNodes(links);

  const result: NavigationData = {
    links: collapsedLinks,
    actions: NAVIGATION.actions || [],
  };

  return result;
}

/**
 * Generate footer data for a specific locale
 */
export function generateFooterData(locale: string = I18N.defaultLocale): FooterData {
  // Scan pages for footer navigation
  const footerPages = scanPages(locale, 'footer', { skipDynamic: true });

  // Build footer links using automatic grouping (same as header)
  const sortedFooterPages = sortPages(footerPages);
  const navLinks = buildNavigationTree(sortedFooterPages);
  const links = navigationLinksToFooterLinks(navLinks);

  const result: FooterData = {
    links,
    secondaryLinks: (NAVIGATION.footer?.secondaryLinks || []).map((link: { title: string; page: string }) => ({
      title: link.title,
      href: getPagePermalink(link.page, locale),
    })),
    /* @wc-ignore */
    footNote: NAVIGATION.footer?.footNote || '',
  };

  return result;
}

/**
 * Get header navigation data (wrapper for backward compatibility)
 */
export const getHeaderData = (locale: string = I18N.defaultLocale) => generateNavigation(locale);

/**
 * Get footer navigation data (wrapper for backward compatibility)
 */
export const getFooterData = (locale: string = I18N.defaultLocale) => generateFooterData(locale);
