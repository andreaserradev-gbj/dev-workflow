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
