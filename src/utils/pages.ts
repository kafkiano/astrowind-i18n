import { getCollection, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { cleanSlug } from './permalinks';
import { LOCALES } from './locales';

const getLangFromPageId = (id: string): string => id.split('/')[0];

export type NormalizedPage = {
  id: string;
  slug: string;
  permalink: string;
  title: string;
  Content: any;
};

const getNormalizedPage = async (page: CollectionEntry<'pages'>): Promise<NormalizedPage> => {
  const { id, data } = page;
  const { Content } = await render(page);

  const { title } = data;

  const slug = cleanSlug(id.split('/').pop() || id);
  const permalink = `/${getLangFromPageId(id)}/pages/${slug}`;

  return {
    id,
    slug,
    permalink,
    title,
    Content,
  };
};

const load = async function (lang?: string): Promise<Array<NormalizedPage>> {
  const pages = await getCollection('pages');
  const normalizedPages = pages.map(async (page) => await getNormalizedPage(page));

  let results = await Promise.all(normalizedPages);

  if (lang) {
    results = results.filter((page) => getLangFromPageId(page.id) === lang);
  }

  return results;
};

let _pages: Array<NormalizedPage>;

/** */
export const fetchPages = async (lang?: string): Promise<Array<NormalizedPage>> => {
  if (!_pages) {
    _pages = await load();
  }

  if (lang) {
    return _pages.filter((page) => getLangFromPageId(page.id) === lang);
  }

  return _pages;
};

/** */
export const findPageBySlug = async (slug: string, lang?: string): Promise<NormalizedPage | undefined> => {
  const pages = await fetchPages(lang);
  return pages.find((page) => page.slug === slug);
};

/** */
export const getStaticPathsPages = async (): Promise<Array<{
  params: { locale: string; pages: string };
  props: { page: NormalizedPage; locale: string };
}>> => {
  const paths: Array<{
    params: { locale: string; pages: string };
    props: { page: NormalizedPage; locale: string };
  }> = [];
  for (const locale of LOCALES) {
    const pages = await load(locale);
    for (const page of pages) {
      paths.push({
        params: {
          locale,
          pages: `pages/${page.slug}`,
        },
        props: { page, locale },
      });
    }
  }
  return paths;
};