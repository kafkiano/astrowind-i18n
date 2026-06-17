import { describe, it, expect } from 'vitest';
import { translateHtml } from '~/i18n/postprocess';
import type { CatalogSet } from '~/i18n/catalog';

const sourceLocale = 'en';
const targetLocale = 'es';

function catalog(data: Record<string, string>): CatalogSet {
  return { [targetLocale]: data };
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

describe('translateHtml', () => {
  it('replaces exact English text nodes with catalog translations', () => {
    const html = '<p>Hello world</p>';
    const result = translateHtml(html, targetLocale, catalog({ 'Hello world': 'Hola mundo' }), sourceLocale);
    expect(result).toContain('Hola mundo');
    expect(result).not.toContain('Hello world');
  });

  it('translates whole-element innerHTML when the catalog key contains inline HTML', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const result = translateHtml(
      html,
      targetLocale,
      catalog({ 'Hello <strong>world</strong>': 'Hola <strong>mundo</strong>' }),
      sourceLocale
    );
    expect(result).toContain('Hola <strong>mundo</strong>');
    expect(result).not.toContain('Hello <strong>world</strong>');
  });

  it('translates alt, aria-label, title, placeholder, and meta content values', () => {
    const html = `
      <img alt="Mountain peak" />
      <input aria-label="Search" placeholder="Type here" />
      <button title="Submit form"></button>
      <meta name="description" content="Welcome page" />
    `;
    const result = translateHtml(
      html,
      targetLocale,
      catalog({
        'Mountain peak': 'Cima montaña',
        Search: 'Buscar',
        'Type here': 'Escribe aquí',
        'Submit form': 'Enviar formulario',
        'Welcome page': 'Página de bienvenida',
      }),
      sourceLocale
    );
    const decoded = decodeHtmlEntities(result);
    expect(decoded).toContain('alt="Cima montaña"');
    expect(decoded).toContain('aria-label="Buscar"');
    expect(decoded).toContain('placeholder="Escribe aquí"');
    expect(decoded).toContain('title="Enviar formulario"');
    expect(decoded).toContain('content="Página de bienvenida"');
  });

  it('does not translate substrings (exact-match only)', () => {
    const html = '<p>Hello world</p>';
    const result = translateHtml(html, targetLocale, catalog({ Hello: 'Hola' }), sourceLocale);
    expect(result).toContain('Hello world');
    expect(result).not.toContain('Hola world');
  });

  it('does not translate URLs, icon identifiers, or numbers in attributes', () => {
    const html = `
      <a href="/home" title="Home">Home</a>
      <img alt="tabler:home" />
      <input placeholder="123" />
    `;
    const result = translateHtml(
      html,
      targetLocale,
      catalog({
        '/home': '/hogar',
        'tabler:home': 'tabler:casa',
        '123': '456',
      }),
      sourceLocale
    );
    expect(result).toContain('href="/home"');
    expect(result).toContain('alt="tabler:home"');
    expect(result).toContain('placeholder="123"');
    expect(result).not.toContain('/hogar');
    expect(result).not.toContain('tabler:casa');
    expect(result).not.toContain('placeholder="456"');
  });

  it('skips <script> tags', () => {
    const html = '<script>const msg = "Hello world";</script>';
    const result = translateHtml(html, targetLocale, catalog({ 'Hello world': 'Hola mundo' }), sourceLocale);
    expect(result).toContain('Hello world');
    expect(result).not.toContain('Hola mundo');
  });
});
