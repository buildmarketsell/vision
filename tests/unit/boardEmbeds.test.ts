import { describe, expect, it } from 'vitest';
import { boardEmbed, isBoardEmbeddable } from '../../src/features/board/boardEmbeds';
import { allowFraming } from '../../src/features/board/embedHeaders';

describe('isBoardEmbeddable', () => {
  it('accepts any web page and videos saved next to the board', () => {
    expect(isBoardEmbeddable('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isBoardEmbeddable('https://nurve.es/products/x')).toBe(true);
    expect(isBoardEmbeddable('videos/my-board-20261119-120000.mp4')).toBe(true);
    expect(isBoardEmbeddable('videos/Clip Final.MOV')).toBe(true);
  });

  it('refuses other schemes, absolute or escaping paths and non-video files', () => {
    expect(isBoardEmbeddable('javascript:alert(1)')).toBe(false);
    expect(isBoardEmbeddable('file:///etc/passwd')).toBe(false);
    expect(isBoardEmbeddable('/Users/dan/clip.mp4')).toBe(false);
    expect(isBoardEmbeddable('../secret/clip.mp4')).toBe(false);
    expect(isBoardEmbeddable('notes/readme.md')).toBe(false);
    expect(isBoardEmbeddable('just some text')).toBe(false);
  });
});

describe('boardEmbed', () => {
  it('shows Instagram posts and reels through their embed page, whatever share link was copied', () => {
    const reel = { kind: 'frame', src: 'https://www.instagram.com/reel/DAbc-12_x/embed/' };
    expect(boardEmbed('https://www.instagram.com/reel/DAbc-12_x/?igsh=MWQ1ZGUxMzBkMA==')).toEqual(reel);
    expect(boardEmbed('https://instagram.com/reels/DAbc-12_x/')).toEqual(reel);
    expect(boardEmbed('https://www.instagram.com/some.creator/reel/DAbc-12_x/')).toEqual(reel);
    expect(boardEmbed('https://www.instagram.com/p/C9xyz/')).toEqual({ kind: 'frame', src: 'https://www.instagram.com/p/C9xyz/embed/' });
  });

  it('plays saved videos natively', () => {
    expect(boardEmbed('videos/a.webm')).toEqual({ kind: 'video', link: 'videos/a.webm' });
  });

  it('shows X and Reddit posts through their embed pages', () => {
    expect(boardEmbed('https://x.com/someone/status/1859000000000000000?s=20')).toEqual({
      kind: 'frame',
      src: 'https://platform.twitter.com/embed/Tweet.html?id=1859000000000000000&dnt=true',
    });
    expect(boardEmbed('https://www.reddit.com/r/skincare/comments/abc123/my_routine/')).toEqual({
      kind: 'frame',
      src: 'https://embed.reddit.com/r/skincare/comments/abc123/my_routine',
    });
  });

  it("leaves YouTube and plain websites to Excalidraw", () => {
    expect(boardEmbed('https://youtu.be/abc')).toEqual({ kind: 'default' });
    expect(boardEmbed('https://www.instagram.com/accounts/login/')).toEqual({ kind: 'default' });
    expect(boardEmbed('https://example.com')).toEqual({ kind: 'default' });
  });
});

describe('allowFraming', () => {
  it('drops X-Frame-Options and frame-ancestors, keeps the rest', () => {
    const result = allowFraming({
      'X-Frame-Options': ['DENY'],
      'Content-Security-Policy': ["default-src 'self'; frame-ancestors 'none'; img-src *"],
      'Content-Type': ['text/html'],
    });
    expect(result).toEqual({
      'Content-Security-Policy': ["default-src 'self'; img-src *"],
      'Content-Type': ['text/html'],
    });
  });

  it('removes a policy that only had frame-ancestors', () => {
    expect(allowFraming({ 'content-security-policy': ["frame-ancestors 'self'"] })).toEqual({});
  });
});
