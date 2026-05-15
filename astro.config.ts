import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';
import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

import { wuchale } from '@wuchale/vite-plugin';
import { markdownPlugin } from './src/utils/markdown-vite-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read i18n config directly from config.yaml for Astro config
const configPath = path.join(__dirname, 'src/config.yaml');
const configContent = fs.readFileSync(configPath, 'utf-8');

interface AstroConfig {
  i18n: {
    locales: string[];
    defaultLocale: string;
  };
}

const config = yaml.load(configContent) as AstroConfig;
const i18nConfig = config.i18n;

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  output: 'static',

  vite: {
    plugins: [
      wuchale(),
      markdownPlugin({
        sourceDir: 'src/data/pages',
        outputDir: '.wuchale-content/pages',
        localesDir: 'src/locales',
        locales: i18nConfig.locales,
        sourceLocale: i18nConfig.defaultLocale,
        translatableFrontmatterKeys: ['title', 'description', 'excerpt'],
      }),
      markdownPlugin({
        sourceDir: 'src/data/post',
        outputDir: '.wuchale-content/posts',
        localesDir: 'src/locales',
        locales: i18nConfig.locales,
        sourceLocale: i18nConfig.defaultLocale,
        translatableFrontmatterKeys: ['title', 'excerpt', 'category'],
      }),
      markdownPlugin({
        sourceDir: 'src/data/snippets',
        outputDir: '.wuchale-content/snippets',
        localesDir: 'src/locales',
        locales: i18nConfig.locales,
        sourceLocale: i18nConfig.defaultLocale,
        translatableFrontmatterKeys: ['title'],
      }),
    ],
  },

  i18n: {
    locales: i18nConfig.locales,
    defaultLocale: i18nConfig.defaultLocale,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),
    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),
    compress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),
    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    domains: ['cdn.pixabay.com'],
  },

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },
});
