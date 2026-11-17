import { describe, expect, it } from 'vitest';
import { convertEmbeds, imageExtension, imageUrl, pastedImageName, relativeImageLink, resolveLocalPath } from '../../src/shared/markdownImages';

describe('markdown images', () => {
  it('resolves relative links against the note folder and skips web links', () => {
    expect(resolveLocalPath('/w/notes', 'images/a.png')).toBe('/w/notes/images/a.png');
    expect(resolveLocalPath('/w/notes', '../b%20c.png')).toBe('/w/b c.png');
    expect(resolveLocalPath('/w/notes', './x.png?v=1')).toBe('/w/notes/x.png');
    expect(resolveLocalPath('/w/notes', 'https://e.com/a.png')).toBeNull();
    expect(resolveLocalPath('/w/notes', 'data:image/png;base64,AA')).toBeNull();
    expect(resolveLocalPath('/w', '%F0%9F%91%A4%20CLIENTS/brief.md#L42')).toBe('/w/👤 CLIENTS/brief.md');
    expect(resolveLocalPath('/w', '#heading')).toBeNull();
  });

  it('turns Obsidian embeds into Markdown images', () => {
    expect(convertEmbeds('see ![[my pic.png|300]] and ![[b.jpg]]')).toBe('see ![](<my pic.png>) and ![](<b.jpg>)');
  });

  it('writes links relative to the note, with brackets when needed', () => {
    expect(relativeImageLink('/w/notes', '/w/notes/images/a.png')).toBe('images/a.png');
    expect(relativeImageLink('/w/notes/deep', '/w/shared/b.png')).toBe('../../shared/b.png');
    expect(relativeImageLink('/w', '/w/🧠 CONTEXT/c.png')).toBe('<🧠 CONTEXT/c.png>');
  });

  it('names pasted images after the note and the time', () => {
    expect(pastedImageName('My Note.md', new Date(2026, 10, 16, 23, 5, 9), 'png')).toBe('my-note-20261116-230509.png');
    expect(pastedImageName('🧠.md', new Date(2026, 0, 2, 3, 4, 5), 'jpg')).toBe('image-20260102-030405.jpg');
  });

  it('knows image files and encodes local URLs', () => {
    expect(imageExtension('/a/B.PNG')).toBe('png');
    expect(imageExtension('/a/notes.md')).toBeNull();
    expect(imageUrl('/w/🧠 x/a.png')).toBe('vision-file://local/w/%F0%9F%A7%A0%20x/a.png');
  });
});
