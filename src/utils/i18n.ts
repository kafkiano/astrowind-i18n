import { LOCALES } from './locales';

export const getStaticPathsForLocale = () =>
  LOCALES.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));