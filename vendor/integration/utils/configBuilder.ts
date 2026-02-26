import merge from 'lodash.merge';

import type { MetaData } from '~/types';

export type Config = {
  site?: SiteConfig;
  metadata?: MetaDataConfig;
  i18n?: I18NConfig;
  apps?: {
    blog?: AppBlogConfig;
  };
  ui?: unknown;
  analytics?: unknown;
  navigation?: NavigationConfig;
};

export interface SiteConfig {
  name: string;
  site?: string;
  base?: string;
  trailingSlash?: boolean;
  googleSiteVerificationId?: string;
}
export interface MetaDataConfig extends Omit<MetaData, 'title'> {
  title?: {
    default: string;
    template: string;
  };
}
export interface I18NConfig {
  language: string;
  textDirection: string;
  locales: string[];
  defaultLocale: string;
  localeNames?: Record<string, string>; // { en: 'English', es: 'Español' }
  dateFormatter?: Intl.DateTimeFormat;
}
export interface AppBlogConfig {
  isEnabled: boolean;
  postsPerPage: number;
  isRelatedPostsEnabled: boolean;
  relatedPostsCount: number;
  post: {
    isEnabled: boolean;
    permalink: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  list: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  category: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
  tag: {
    isEnabled: boolean;
    pathname: string;
    robots: {
      index: boolean;
      follow: boolean;
    };
  };
}
export interface AnalyticsConfig {
  vendors: {
    googleAnalytics: {
      id?: string;
      partytown?: boolean;
    };
  };
}

export interface UIConfig {
  theme: string;
}

export interface NavigationConfig {
  actions?: Array<{ text: string; href: string; target?: string }>;
  footer?: {
    secondaryLinks?: Array<{ text: string; page: string }>;
    footNote?: string;
  };
  blog?: {
    categorySlug?: string;
    tagSlug?: string;
  };
}

const DEFAULT_SITE_NAME = 'Website';

const getSite = (config: Config) => {
  const _default = {
    name: DEFAULT_SITE_NAME,
    site: undefined,
    base: '/',
    trailingSlash: false,

    googleSiteVerificationId: '',
  };

  return merge({}, _default, config?.site ?? {}) as SiteConfig;
};

const getMetadata = (config: Config) => {
  const siteConfig = getSite(config);

  const _default = {
    title: {
      default: siteConfig?.name || DEFAULT_SITE_NAME,
      template: '%s',
    },
    description: '',
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: 'website',
    },
  };

  return merge({}, _default, config?.metadata ?? {}) as MetaDataConfig;
};

const getI18N = (config: Config) => {
  // Validate i18n configuration exists
  if (!config?.i18n) {
    throw new Error('i18n configuration is required in src/config.yaml');
  }

  const i18nConfig = config.i18n;

  // Validate locales array
  if (!Array.isArray(i18nConfig.locales) || i18nConfig.locales.length === 0) {
    throw new Error('i18n.locales must be a non-empty array in src/config.yaml');
  }

  // Validate defaultLocale
  if (!i18nConfig.defaultLocale || typeof i18nConfig.defaultLocale !== 'string') {
    throw new Error('i18n.defaultLocale is required and must be a string in src/config.yaml');
  }

  // Validate defaultLocale is in locales
  if (!i18nConfig.locales.includes(i18nConfig.defaultLocale)) {
    throw new Error(
      `i18n.defaultLocale "${i18nConfig.defaultLocale}" must be included in i18n.locales [${i18nConfig.locales.join(', ')}] in src/config.yaml`
    );
  }

  // Build validated configuration
  const value = {
    language: i18nConfig.language || i18nConfig.defaultLocale,
    textDirection: i18nConfig.textDirection || 'ltr',
    locales: i18nConfig.locales,
    defaultLocale: i18nConfig.defaultLocale,
    localeNames: i18nConfig.localeNames || {},
  };

  // Ensure localeNames has entries for all locales
  const localeNames = value.localeNames;
  value.locales.forEach((locale: string) => {
    if (!localeNames[locale]) {
      localeNames[locale] = locale.toUpperCase(); // Fallback to code
    }
  });
  value.localeNames = localeNames;

  return value as I18NConfig;
};

const getAppBlog = (config: Config) => {
  const _default = {
    isEnabled: false,
    postsPerPage: 6,
    isRelatedPostsEnabled: false,
    relatedPostsCount: 4,
    post: {
      isEnabled: true,
      permalink: '/blog/%slug%',
      robots: {
        index: true,
        follow: true,
      },
    },
    list: {
      isEnabled: true,
      pathname: 'blog',
      robots: {
        index: true,
        follow: true,
      },
    },
    category: {
      isEnabled: true,
      pathname: 'category',
      robots: {
        index: true,
        follow: true,
      },
    },
    tag: {
      isEnabled: true,
      pathname: 'tag',
      robots: {
        index: false,
        follow: true,
      },
    },
  };

  return merge({}, _default, config?.apps?.blog ?? {}) as AppBlogConfig;
};

const getUI = (config: Config) => {
  const _default = {
    theme: 'system',
  };

  return merge({}, _default, config?.ui ?? {});
};

const getAnalytics = (config: Config) => {
  const _default = {
    vendors: {
      googleAnalytics: {
        id: undefined,
        partytown: true,
      },
    },
  };

  return merge({}, _default, config?.analytics ?? {}) as AnalyticsConfig;
};

const getNavigation = (config: Config) => {
  const _default = {
    actions: [],
    footer: {
      secondaryLinks: [],
      footNote: '',
    },
    blog: {
      categorySlug: 'tutorials',
      tagSlug: 'astro',
    },
  };

  return merge({}, _default, config?.navigation ?? {}) as NavigationConfig;
};

export default (config: Config) => ({
  SITE: getSite(config),
  I18N: getI18N(config),
  METADATA: getMetadata(config),
  APP_BLOG: getAppBlog(config),
  UI: getUI(config),
  ANALYTICS: getAnalytics(config),
  NAVIGATION: getNavigation(config),
});
