// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, renderInline } from '../src/client/lib/markdown.js';

describe('render (block)', () => {
  it('produces an h2, ol, and inline code from typical PRD markdown', () => {
    const html = render('## Heading\n1. first item\n2. `code` item');

    expect(html).toContain('<h2');
    expect(html).toContain('Heading');
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    expect(html).toContain('<code');
    expect(html).toContain('code');
  });

  it('preserves bold and inline code in a paragraph', () => {
    const html = render('Use **marked** with `parseInline` for spans.');
    expect(html).toContain('<strong');
    expect(html).toContain('marked');
    expect(html).toContain('<code');
    expect(html).toContain('parseInline');
  });

  it('returns an empty string for empty input', () => {
    expect(render('')).toBe('');
  });
});

describe('renderInline (no <p> wrap)', () => {
  it('does not wrap output in a <p>', () => {
    const html = renderInline('**bold** and `code`');
    expect(html.startsWith('<p>')).toBe(false);
    expect(html.startsWith('<p ')).toBe(false);
    expect(html).toContain('<strong');
    expect(html).toContain('<code');
  });

  it('renders inline links and emphasis', () => {
    const html = renderInline('see [docs](https://example.com) and *note*');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<em');
  });

  it('returns an empty string for empty input', () => {
    expect(renderInline('')).toBe('');
  });
});

describe('sanitization (XSS vectors)', () => {
  it('strips javascript: hrefs in block markdown', () => {
    const html = render('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('strips javascript: hrefs in inline markdown', () => {
    const html = renderInline('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('click');
  });

  it('strips data: URLs in inline markdown', () => {
    const html = renderInline('[click](data:text/html,<script>alert(1)</script>)');
    expect(html).not.toContain('data:');
    expect(html).not.toContain('<script');
  });

  it('strips <script> elements', () => {
    expect(render('<script>alert(1)</script>')).not.toContain('script');
    expect(renderInline('<script>alert(1)</script>')).not.toContain('script');
  });

  it('strips event handlers from raw HTML', () => {
    const html = render('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror');
    expect(html).toContain('<img');
  });

  it('restricts exotic URI schemes via the allowed-uri regexp', () => {
    const html = render('[a](vbscript:msgbox)');
    expect(html).not.toContain('vbscript:');
  });

  it('keeps http(s), mailto, and relative links', () => {
    const html = render('[a](https://ok.com) [b](mailto:x@y.z) [c](/rel)');
    expect(html).toContain('https://ok.com');
    expect(html).toContain('mailto:x@y.z');
    expect(html).toContain('/rel');
  });

  it('preserves legitimate formatting end to end', () => {
    const html = render('## H\n1. **bold** item\n2. `code`');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong');
    expect(html).toContain('<code');
  });
});
