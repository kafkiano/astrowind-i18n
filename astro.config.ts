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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read i18n config directly from config.yaml for Astro config
const configPath = path.join(__dirname, 'src/config.yaml');
const configContent = fs.readFileSync(configPath, 'utf-8');
const config = yaml.load(configContent) as any;
const i18nConfig = config.i18n || { locales: ['en'], defaultLocale: 'en' };

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  output: 'static',
  
  vite: {
    plugins: [wuchale()],
  },
  i18n: {
    locales: i18nConfig.locales || ['en'],
    defaultLocale: i18nConfig.defaultLocale || 'en',
    routing: {
      prefixDefaultLocale: true,
    },
  },

  integrations: [tailwind({
    applyBaseStyles: false,
  }), sitemap(), mdx(), icon({
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
  }), ...whenExternalScripts(() =>
    partytown({
      config: { forward: ['dataLayer.push'] },
    })
  ), compress({
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
  }), astrowind({
    config: './src/config.yaml',
  })],

  image: {
    domains: ['cdn.pixabay.com'],
  },

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },

});
