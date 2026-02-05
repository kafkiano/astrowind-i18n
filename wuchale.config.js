import { adapter as astro } from '@wuchale/astro';
import { defineConfig, gemini } from 'wuchale';

export default defineConfig({
  locales: ['en', 'es'],
  adapters: {
    main: astro(),
  },
  ai: gemini({
    model: 'gemini-3-flash-preview',
    batchSize: 40,
    parallel: 5,
    think: true, // default: false
  }),
});
