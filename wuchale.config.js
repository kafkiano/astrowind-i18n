import { adapter as astro } from '@wuchale/astro';
import { adapter as vanilla } from 'wuchale/adapter-vanilla';
import { defineConfig } from 'wuchale';

export default defineConfig({
  locales: ['en', 'es'],
  adapters: {
    // Main astro adapter - uses 'main' catalog
    main: astro(),
    // Navigation adapter - also uses 'main' catalog (shared)
    // Use custom loader to avoid catalog lookup errors
    navigation: vanilla({
      files: {
        include: ['src/navigation.ts'],
        ignore: []
      },
      catalog: 'main',
      // Use custom loader that reuses main catalog infrastructure
      loader: 'custom',
      // Configure heuristic to extract string literals from object properties
      heuristic: (node, context) => {
        // Check if this is a string literal that's a value of a 'text' or 'title' property
        if (node.type === 'Literal' || node.type === 'StringLiteral') {
          // Look at parent to see if this is a property value
          const parent = context.parent;
          if (parent && parent.type === 'Property' && 
              (parent.key.name === 'text' || parent.key.name === 'title')) {
            return {
              type: 'script',
              message: node.value
            };
          }
        }
        return null;
      }
    }),
  },
});
