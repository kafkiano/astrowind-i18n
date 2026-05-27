import slugify from 'limax';

import { SITE, APP_BLOG } from 'astrowind:config';

import { trim } from '~/utils/utils';
import { getPathWithoutLocale } from '~/utils/i18n';

export const trimSlash = (s: string) => trim(trim(s, '/'));
const createPath = (...params: string[]) => {
  const paths = params
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
  return '/' + paths + (SITE.trailingSlash && paths ? '/' : '');
};

const BASE_PATHNAME = SITE.base || '/';
const BASE_TRIMMED = trimSlash(BASE_PATHNAME);
const stripBase = (s: string) =>
  BASE_TRIMMED && s.startsWith(`/${BASE_TRIMMED}/`)
    ? s.slice(BASE_TRIMMED.length + 1) || '/'
    : BASE_TRIMMED && s === `/${BASE_TRIMMED}`
      ? '/'
      : s;

export const cleanSlug = (text = '') =>
  trimSlash(text)
    .split('/')
    .map((slug) => slugify(slug))
    .join('/');

export const BLOG_BASE = cleanSlug(APP_BLOG?.list?.pathname);
export const CATEGORY_BASE = cleanSlug(APP_BLOG?.category?.pathname);
export const TAG_BASE = cleanSlug(APP_BLOG?.tag?.pathname) || 'tag';

export const POST_PERMALINK_PATTERN = trimSlash(APP_BLOG?.post?.permalink || `${BLOG_BASE}/%slug%`);

/** */
export const getCanonical = (path = ''): string | URL => {
  const url = String(new URL(path, SITE.site));
  if (SITE.trailingSlash == false && path && url.endsWith('/')) {
    return url.slice(0, -1);
  } else if (SITE.trailingSlash == true && path && !url.endsWith('/')) {
    return url + '/';
  }
  return url;
};

/** */
export const getPermalink = (rawSlug = '', type = 'page', locale?: string): string => {
  let permalink: string;

  if (
    rawSlug.startsWith('https://') ||
    rawSlug.startsWith('http://') ||
    rawSlug.startsWith('://') ||
    rawSlug.startsWith('#') ||
    rawSlug.startsWith('javascript:')
  ) {
    return rawSlug;
  }

  // Strip base path prefix (prevents double-base when slug comes from Astro.url.pathname)
  const slug = stripBase(rawSlug);

  // Strip any existing locale prefix (allows '/en/about' → '/es/about')
  const slugWithoutLocale = getPathWithoutLocale(slug);

  switch (type) {
    case 'home':
      return getHomePermalink(locale);

    case 'blog':
      return getBlogPermalink(locale);

    case 'asset':
      permalink = getAsset(slugWithoutLocale);
      break;

    case 'category':
      permalink = createPath(CATEGORY_BASE, slugWithoutLocale);
      break;

    case 'tag':
      permalink = createPath(TAG_BASE, slugWithoutLocale);
      break;

    case 'post':
      permalink = createPath(slugWithoutLocale);
      break;

    case 'page':
    default:
      permalink = createPath(slugWithoutLocale);
      break;
  }

  const prefixed = locale ? `/${locale}${permalink}` : permalink;
  return definitivePermalink(prefixed);
};

/** */
export const getHomePermalink = (locale?: string): string => getPermalink('/', 'page', locale);

/** */
export const getBlogPermalink = (locale?: string): string => getPermalink(BLOG_BASE, 'page', locale);

/** */
export const getPagePermalink = (slug: string, locale?: string): string => getPermalink(slug, 'page', locale);

/** */
export const getAsset = (path: string): string => {
  const parts = [trimSlash(BASE_PATHNAME), trimSlash(path)].filter(Boolean);
  return '/' + parts.join('/');
};

/** */
const definitivePermalink = (permalink: string): string => createPath(BASE_PATHNAME, permalink);
