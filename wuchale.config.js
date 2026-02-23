import { adapter as astro } from '@wuchale/astro';
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
  },
  writeFiles: {
    compiled: true,
  },
  ...(geminiKey && { ai: { geminiApiKey: geminiKey } }),
});
