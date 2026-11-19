import { describe, expect, it } from 'vitest';
import { isHtmlFile, isPreviewableFile, previewUrl } from '../../src/shared/htmlPreview';

describe('HTML preview rules', () => {
  it('previews .html and .htm files', () => {
    expect(isHtmlFile('/w/site/index.html')).toBe(true);
    expect(isHtmlFile('/w/old/PAGE.HTM')).toBe(true);
    expect(isHtmlFile('/w/notes.md')).toBe(false);
  });

  it('serves web files and never hidden files or other types', () => {
    expect(isPreviewableFile('/w/site/style.css')).toBe(true);
    expect(isPreviewableFile('/w/site/fonts/Inter.woff2')).toBe(true);
    expect(isPreviewableFile('/w/.env')).toBe(false);
    expect(isPreviewableFile('/w/.git/config')).toBe(false);
    expect(isPreviewableFile('/w/.secret/app.js')).toBe(false);
    expect(isPreviewableFile('/w/site/notes.md')).toBe(false);
    expect(isPreviewableFile('/w/site/Makefile')).toBe(false);
    expect(isPreviewableFile('/w/site.v2/Makefile')).toBe(false);
  });

  it('builds a preview address that keeps spaces and emoji folders working', () => {
    expect(previewUrl('/Users/d/BUSINESS OS/🛒 NURVE/index.html')).toBe('vision-preview://local/Users/d/BUSINESS%20OS/%F0%9F%9B%92%20NURVE/index.html');
  });
});
