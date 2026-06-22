import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translateFrontmatterYaml, translateContent } from '~/i18n/markdown';
import { fakeProvider } from './helpers';

const virtualFs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  dirs: new Set<string>(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: async (path: string, _encoding?: string) => {
    if (!virtualFs.files.has(path)) throw new Error(`ENOENT: ${path}`);
    return virtualFs.files.get(path)!;
  },
  writeFile: async (path: string, content: string, _encoding?: string) => {
    virtualFs.files.set(path, content);
  },
  mkdir: async (path: string, _options?: { recursive?: boolean }) => {
    virtualFs.dirs.add(path);
  },
}));

vi.mock('tinyglobby', () => ({
  glob: async (_pattern: string, options: { cwd: string }) => {
    const prefix = `${options.cwd}/`;
    return [...virtualFs.files.keys()].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
  },
}));

vi.mock('~/i18n/manifest', () => ({
  loadManifest: async () => ({ markdown: {}, catalogs: {} }),
  saveManifest: async () => {},
  needsTranslation: async () => true,
  markTranslated: async (manifest: { markdown: Record<string, string> }) => manifest,
}));

function setFile(path: string, content: string) {
  virtualFs.files.set(path, content);
}

function getFile(path: string): string | undefined {
  return virtualFs.files.get(path);
}

describe('translateFrontmatterYaml', () => {
  it('translates only translatable string leaves and skips protected keys and values', async () => {
    const frontmatter = `
title: Hello World
href: /about
src: ~/assets/images/photo.jpg
slug: hello-world
pathname: /hello
icon: tabler:home
email: hi@example.com
phone: +1 234 567
number: 42
tailwind: text-red-500
url: https://example.com
`;
    const result = await translateFrontmatterYaml(frontmatter, fakeProvider, 'es', 'en');
    expect(result).not.toBeNull();
    expect(result).toContain("title: '[Hello World]'");
    expect(result).toContain('href: /about');
    expect(result).toContain('src: ~/assets/images/photo.jpg');
    expect(result).toContain('slug: hello-world');
    expect(result).toContain('pathname: /hello');
    expect(result).toContain('icon: tabler:home');
    expect(result).toContain('email: hi@example.com');
    expect(result).toContain('phone: +1 234 567');
    expect(result).toContain('number: 42');
    expect(result).toContain('tailwind: text-red-500');
    expect(result).toContain('url: https://example.com');
  });

  it('preserves original quoting style from source frontmatter', async () => {
    const frontmatter = `
title: 'Markdown Page'
group: 'Demos'
excerpt: 'A short summary'
`;
    const result = await translateFrontmatterYaml(frontmatter, fakeProvider, 'es', 'en');
    expect(result).not.toBeNull();
    // Source had single quotes — translated output must keep them
    expect(result).toContain("title: '[Markdown Page]'");
    expect(result).toContain("group: '[Demos]'");
    expect(result).toContain("excerpt: '[A short summary]'");
  });

  it('preserves YAML structure and key order', async () => {
    const frontmatter = `
title: Hello
metadata:
  description: A description
items:
  - name: First
    label: One
  - name: Second
    label: Two
`;
    const result = await translateFrontmatterYaml(frontmatter, fakeProvider, 'es', 'en');
    expect(result).not.toBeNull();

    // Keys should stay in source order.
    expect(result!.indexOf('title:')).toBeLessThan(result!.indexOf('metadata:'));
    expect(result!.indexOf('metadata:')).toBeLessThan(result!.indexOf('items:'));

    // Only translatable leaves are wrapped.
    expect(result).toContain("title: '[Hello]'");
    expect(result).toContain("description: '[A description]'");
    expect(result).toContain('name: First');
    expect(result).toContain("label: '[One]'");
    expect(result).toContain('name: Second');
    expect(result).toContain("label: '[Two]'");
  });
});

describe('translateContent', () => {
  beforeEach(() => {
    virtualFs.files.clear();
    virtualFs.dirs.clear();
  });

  it('translates body text as a single block', async () => {
    const srcPath = 'src/data/pages/en/vitest-body.md';
    const outPath = 'src/data/pages/es/vitest-body.md';
    const source = `---\ntitle: Page\n---\n\nHello world.\n\nSecond paragraph.\n`;
    setFile(srcPath, source);

    await translateContent(fakeProvider, ['en', 'es'], 'en');

    const output = getFile(outPath);
    expect(output).toBeDefined();
    expect(output).toContain("title: '[Page]'");
    expect(output).toContain('[Hello world.\n\nSecond paragraph.]');
  });
});
