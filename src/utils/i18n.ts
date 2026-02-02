import { LOCALES } from './blog';

export const getStaticPathsForLocale = () =>
  LOCALES.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));