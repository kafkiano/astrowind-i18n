import { getCollection } from 'astro:content';
import { getPermalink, getPagePermalink } from './permalinks';
import { I18N, NAVIGATION } from 'astrowind:config';
import type { AutoNavConfig, NavigationData, FooterData, NavigationLink, Links } from '~/types';

/**
 * Unified page type for all navigation sources
 */
type Page = {
  title: string;
  href: string;
  showIn: 'header' | 'footer' | 'all' | 'none';
  order: number;
  group?: string;
  type: 'page'; // Only 'page' needed for permalink generation
  path: string; // For directory-based grouping
};

/**
 * Scan all pages from file-based routes
 */
function scanFilePages(locale: string): Page[] {
  const pageModules = import.meta.glob<{
    navigation?: AutoNavConfig;
  }>('/src/pages/[locale]/**/*.astro', { eager: true });

  const pages: Page[] = [];

  for (const [filePath, module] of Object.entries(pageModules)) {
    const routePath =
      filePath
        .replace(/^\/src\/pages\/\[locale\]/, '')
        .replace(/\.astro$/, '')
        .replace(/\/index$/, '/') || '/';

    // Skip home page
    if (routePath === '/') continue;

    const navigation = module.navigation;
    if (!navigation?.title) continue;

    const showIn = navigation.showIn ?? 'none';
    if (showIn === 'none') continue;

    const type = 'page';
    const slug = navigation.slug ?? routePath;

    pages.push({
      title: navigation.title,
      href: getPermalink(slug, 'page', locale),
      showIn,
      order: navigation.order ?? 999,
      group: navigation.group,
      type,
      path: routePath,
    });
  }

  return pages;
}

/**
 * Scan all pages from content collections
 */
async function scanContentPages(locale: string): Promise<Page[]> {
  const pages = await getCollection('pages', ({ id }) => id.startsWith(`${locale}/`));

  return pages.map((page) => ({
    title: page.data.title,
    href: `/${locale}/${page.id
      .split('/')
      .pop()
      ?.replace(/\.(md|mdx)$/, '')}`,
    showIn: page.data.showIn ?? 'footer',
    order: page.data.order ?? 999,
    group: page.data.group,
    type: 'page',
    path: '',
  }));
}

/**
 * Scan all pages (translations handled by post-processing integration)
 */
async function scanAllPages(locale: string): Promise<Page[]> {
  const filePages = scanFilePages(locale);
  const contentPages = await scanContentPages(locale);
  return [...filePages, ...contentPages];
}

/**
 * Filter pages by showIn value
 */
function filterByShowIn(pages: Page[], target: 'header' | 'footer'): Page[] {
  return pages.filter((p) => p.showIn === target || p.showIn === 'all');
}

/**
 * Sort pages by order and title
 */
function sortPages(pages: Page[]): Page[] {
  return [...pages].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Group pages by explicit group field
 */
function groupPages(pages: Page[]): NavigationLink[] {
  const sorted = sortPages(pages);

  // Explicit group field grouping
  const explicitGroups = new Map<string, Page[]>();
  const standalone: NavigationLink[] = [];

  for (const page of sorted) {
    if (page.group) {
      if (!explicitGroups.has(page.group)) explicitGroups.set(page.group, []);
      explicitGroups.get(page.group)!.push(page);
    } else {
      standalone.push({ title: page.title, href: page.href });
    }
  }

  const explicitGroupLinks: NavigationLink[] = Array.from(explicitGroups.entries()).map(([title, items]) => ({
    title,
    links: sortPages(items).map((p) => ({ title: p.title, href: p.href })),
  }));

  return [...explicitGroupLinks, ...standalone];
}

/**
 * Generate navigation data for a specific locale
 */
export async function generateNavigation(locale: string = I18N.defaultLocale): Promise<NavigationData> {
  const pages = await scanAllPages(locale);
  const filtered = filterByShowIn(pages, 'header');
  const grouped = groupPages(filtered);

  return {
    links: grouped,
    actions: NAVIGATION.actions || [],
  };
}

/**
 * Generate footer data for a specific locale
 */
export async function generateFooterData(locale: string = I18N.defaultLocale): Promise<FooterData> {
  const pages = await scanAllPages(locale);
  const filtered = filterByShowIn(pages, 'footer');
  const grouped = groupPages(filtered);

  const links: Links[] = grouped.map((navLink) => {
    if (navLink.links && navLink.links.length > 0) {
      return {
        title: navLink.title,
        links: navLink.links.map((child) => ({
          text: child.title,
          href: child.href,
        })),
      };
    }
    return {
      title: '',
      links: [{ text: navLink.title, href: navLink.href || '' }],
    };
  });

  return {
    links,
    secondaryLinks: (NAVIGATION.footer?.secondaryLinks || []).map((link: { text: string; page: string }) => ({
      text: link.text,
      href: getPagePermalink(link.page, locale),
    })),

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
