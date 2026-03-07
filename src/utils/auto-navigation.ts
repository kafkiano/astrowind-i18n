import { getCollection } from 'astro:content';
import { getPermalink, getPagePermalink } from './permalinks';
import { I18N, NAVIGATION } from 'astrowind:config';
import type { AutoNavConfig, NavigationData, FooterData, NavigationLink, Links } from '~/types';

/**
 * Extract route path from a file path
 * e.g., /src/pages/[locale]/homes/saas.astro -> /homes/saas
 * e.g., /src/pages/[locale]/homes/index.astro -> /homes
 */
function extractRoutePath(filePath: string): string {
  // Remove /src/pages/[locale]/ prefix
  const relativePath = filePath.replace(/^\/src\/pages\/\[locale\]/, '');
  // Remove file extension
  const withoutExt = relativePath.replace(/\.(astro|md|mdx)$/, '');
  // Handle index files at any level (e.g., /index -> /, /homes/index -> /homes)
  const segments = withoutExt.split('/').filter(Boolean);

  // Remove 'index' segment if present
  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

/**
 * Scan pages for navigation generation and build hierarchical structure
 * @param locale - The locale to generate permalinks for
 * @param visibility - Filter by visibility ('header', 'footer', or undefined for all)
 * @param options - Additional options
 * @returns Hierarchical NavigationLink array
 */
function scanPages(locale: string, visibility?: 'header' | 'footer'): NavigationLink[] {
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

  // Second, group top-level pages by their 'group' field
  const groupedPages = new Map<string, { title: string; href: string; order: number }[]>();
  const ungroupedLinks: NavigationLink[] = [];

  for (const page of leafPages) {
    // Skip if belongs to directory-based group
    let belongsToDirGroup = false;
    for (const groupPath of groupsByDirectory.keys()) {
      if (page.path.startsWith(groupPath + '/')) {
        belongsToDirGroup = true;
        break;
      }
    }
    if (belongsToDirGroup) continue;

    const groupName = page.navigation?.group;
    if (groupName) {
      if (!groupedPages.has(groupName)) groupedPages.set(groupName, []);
      groupedPages.get(groupName)!.push({
        title: page.title,
        href: page.href,
        order: page.navigation?.order ?? 999,
      });
    } else {
      ungroupedLinks.push({ title: page.title, href: page.href });
    }
  }

  // Convert grouped pages to NavigationLink format
  const explicitGroupLinks: NavigationLink[] = Array.from(groupedPages.entries()).map(([title, items]) => ({
    title,
    links: items.sort((a, b) => a.order - b.order).map(({ title, href }) => ({ title, href })),
  }));

  // Sort ungrouped links by order
  const sortedUngrouped = sortPageMeta(
    ungroupedLinks.map((link) => ({
      path: link.href || '',
      title: link.title,
      href: link.href || '',
      navigation: { order: 0 },
    }))
  ).map((item) => ({
    title: item.title,
    href: item.href,
  }));

  // Return combined: blog group, directory groups, explicit groups, ungrouped links
  return [...blogGroupLinks, ...groupLinks, ...explicitGroupLinks, ...sortedUngrouped];
}

/**
 * Scan markdown pages from content collection for navigation generation
 * @param locale - The locale to generate permalinks for
 * @param visibility - Filter by visibility ('header', 'footer', or undefined for all)
 * @returns Hierarchical NavigationLink array grouped by 'group' frontmatter
 */
async function scanMarkdownPages(locale: string, visibility?: 'header' | 'footer'): Promise<NavigationLink[]> {
  const pages = await getCollection('pages', ({ id }) => id.startsWith(`${locale}/`));

  const groups = new Map<string, { title: string; href: string; order: number }[]>();

  for (const page of pages) {
    const { showIn = 'footer', order = 999, group } = page.data;
    if (visibility && showIn !== visibility) continue;

    const slug =
      page.id
        .split('/')
        .pop()
        ?.replace(/\.(md|mdx)$/, '') || page.id;
    const href = `/${locale}/${slug}`;

    const groupName = group || 'Pages';
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName)!.push({ title: page.data.title, href, order });
  }

  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    links: items.sort((a, b) => a.order - b.order).map(({ title, href }) => ({ title, href })),
  }));
}

/**
 * Generate navigation data for a specific locale
 */
export async function generateNavigation(locale: string = I18N.defaultLocale): Promise<NavigationData> {
  // Scan pages for header navigation - returns hierarchical structure directly
  const routeLinks = scanPages(locale, 'header');
  const markdownLinks = await scanMarkdownPages(locale, 'header');

  // Merge route and markdown links
  const allLinks = [...routeLinks, ...markdownLinks];

  const result: NavigationData = {
    links: allLinks,
    actions: NAVIGATION.actions || [],
  };

  return result;
}

/**
 * Generate footer data for a specific locale
 */
export async function generateFooterData(locale: string = I18N.defaultLocale): Promise<FooterData> {
  // Scan pages for footer navigation - returns hierarchical structure directly
  const navLinks = scanPages(locale, 'footer');
  const markdownLinks = await scanMarkdownPages(locale, 'footer');

  // Merge navLinks and markdownLinks
  const allLinks = [...navLinks, ...markdownLinks];

  // Convert NavigationLink[] to Links[] format for footer
  const links: Links[] = [];

  for (const navLink of allLinks) {
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
export const getHeaderData = async (locale: string = I18N.defaultLocale) => await generateNavigation(locale);

/**
 * Get footer navigation data (wrapper for backward compatibility)
 */
export const getFooterData = async (locale: string = I18N.defaultLocale) => await generateFooterData(locale);
