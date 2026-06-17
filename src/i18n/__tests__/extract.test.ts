import { describe, it, expect } from 'vitest';
import { extractFromAstro, extractFromConfig } from '~/i18n/extract';

function msgids(results: Awaited<ReturnType<typeof extractFromAstro>>): string[] {
  return results.map((r) => r.msgid);
}

describe('extractFromAstro', () => {
  it('extracts plain text nodes from markup', async () => {
    const html = `
      ---
      ---
      <p>Hello world</p>
      <div>Another sentence.</div>
    `;
    const results = await extractFromAstro(html, 'src/components/Test.astro');
    expect(msgids(results)).toContain('Hello world');
    expect(msgids(results)).toContain('Another sentence.');
  });

  it('extracts quoted attribute values such as title and alt', async () => {
    const html = `
      ---
      ---
      <img alt="Photo of a mountain" title="Sunset over peaks" src="~/assets/images/mtn.jpg" />
    `;
    const results = await extractFromAstro(html, 'src/components/Test.astro');
    expect(msgids(results)).toContain('Photo of a mountain');
    expect(msgids(results)).toContain('Sunset over peaks');
  });

  it('extracts string literals from expression props like items={["Foo", "Bar"]}', async () => {
    const html = `
      ---
      ---
      <Widget items={['Foo', 'Bar']} />
    `;
    const results = await extractFromAstro(html, 'src/components/Test.astro');
    expect(msgids(results)).toContain('Foo');
    expect(msgids(results)).toContain('Bar');
  });

  it('merges inline phrasing content into a single key', async () => {
    const html = `
      ---
      ---
      <p>Text <span class="x">bold</span> more.</p>
    `;
    const results = await extractFromAstro(html, 'src/components/Test.astro');
    const ids = msgids(results);

    // Should be a single merged key, not three fragments.
    expect(ids).toContain('Text <span class="x">bold</span> more.');
    expect(ids.filter((id) => id === 'Text' || id === 'bold' || id === 'more.')).toHaveLength(0);
  });

  it('classifies frontmatter script strings correctly', async () => {
    const html = `---
const label = 'Click me';
const url = '/about';
const apiKey = 'ABCD-1234';
---
<button>{label}</button>
`;
    const results = await extractFromAstro(html, 'src/components/Test.astro');
    const ids = msgids(results);

    expect(ids).toContain('Click me');
    expect(ids).not.toContain('/about');
    expect(ids).not.toContain('ABCD-1234');
  });
});

describe('extractFromConfig', () => {
  it('returns expected strings and skips URLs, icon names, and identifier keys', () => {
    const config = {
      title: 'My Site',
      description: 'A great website',
      navigation: {
        links: [
          { label: 'Home', href: '/home', icon: 'tabler:home' },
          { label: 'Contact us', href: 'mailto:hi@example.com' },
        ],
      },
      i18n: {
        provider: 'gemini',
        defaultLocale: 'en',
        locales: ['en', 'es'],
      },
    };

    const strings = extractFromConfig(config);

    expect(strings).toContain('My Site');
    expect(strings).toContain('A great website');
    expect(strings).toContain('Home');
    expect(strings).toContain('Contact us');

    expect(strings).not.toContain('/home');
    expect(strings).not.toContain('mailto:hi@example.com');
    expect(strings).not.toContain('tabler:home');
    expect(strings).not.toContain('gemini');
    expect(strings).not.toContain('en');
    expect(strings).not.toContain('es');
  });
});
