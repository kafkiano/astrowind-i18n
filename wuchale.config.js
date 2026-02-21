import { adapter as astro } from '@wuchale/astro';
import { adapter as vanilla } from 'wuchale/adapter-vanilla';
import { defineConfig } from 'wuchale';
import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'src/config.yaml');
const configContent = fs.readFileSync(configPath, 'utf-8');
const config = yaml.load(configContent);
const locales = config.i18n?.locales || ['en'];
const geminiKey = config.ai?.geminiApiKey;

export default defineConfig({
  locales,
  adapters: {
    // Main astro adapter - uses 'main' catalog
    main: astro(),
    // Navigation adapter
    navigation: vanilla({
      files: {
        include: ['src/navigation.ts'],
        ignore: [],
      },
      catalog: 'navigation',
      loader: 'custom',
      heuristic: (node, context) => {
        // Check if this is a string literal
        if (node.type === 'Literal' || node.type === 'StringLiteral') {
          // Only extract 'text' or 'title' properties from navigation.ts
          const parent = context.parent;
          if (parent && parent.type === 'Property' && (parent.key.name === 'text' || parent.key.name === 'title')) {
            return {
              type: 'script',
              message: node.value,
            };
          }
        }
        return null;
      },
    }),
  },
  writeFiles: {
    compiled: true,
  },
  ...(geminiKey && { ai: { geminiApiKey: geminiKey } }),
});
