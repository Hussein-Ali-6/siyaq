// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { capWords, extractArticle } from '@/lib/dom/article';

describe('capWords', () => {
  it('keeps the first N words', () => {
    expect(capWords('one two three four', 2)).toBe('one two');
    expect(capWords('one two', 5)).toBe('one two');
  });
});

describe('extractArticle', () => {
  it('returns the main text, title and site name', () => {
    const paragraph = 'This is a reasonably long sentence about something interesting that happened yesterday evening. '.repeat(6);
    document.head.innerHTML = '<meta property="og:site_name" content="Example News">';
    document.title = 'Big Story | Example News';
    document.body.innerHTML =
      `<nav><a href="#">Home</a></nav><article><h1>Big Story</h1>` +
      Array.from({ length: 8 }, () => `<p>${paragraph}</p>`).join('') +
      `</article><footer>© Example</footer>`;
    const article = extractArticle(document);
    expect(article.siteName).toBe('Example News');
    expect(article.title).toContain('Big Story');
    expect(article.text).toContain('reasonably long sentence');
    expect(article.text).not.toContain('Home');
  });

  it('keeps paragraph and line breaks in the extracted text', () => {
    const filler = 'This sentence is here to make the paragraph long enough for Readability to keep it around. '.repeat(4);
    document.head.innerHTML = '';
    document.title = 'Breaks';
    document.body.innerHTML =
      `<article><p>${filler}First block ends here.</p><p>${filler}Second block.<br><br>After a line break.</p>` +
      Array.from({ length: 4 }, () => `<p>${filler}</p>`).join('') +
      '</article>';
    const text = extractArticle(document).text;
    expect(text).toMatch(/First block ends here\.\n/);
    expect(text).toMatch(/Second block\.\n+After a line break\./);
  });

  it('uses the first heading when the page has no title', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<h1>Heading Only</h1><div>Just a few words here.</div>';
    expect(extractArticle(document).title).toBe('Heading Only');
  });

  it('falls back to the body text on a page without an article', () => {
    document.head.innerHTML = '';
    document.title = 'Tiny';
    document.body.innerHTML = '<div>Just a few words here.</div>';
    const article = extractArticle(document);
    expect(article.text).toContain('Just a few words here.');
    expect(article.siteName).toBe('localhost');
  });
});
