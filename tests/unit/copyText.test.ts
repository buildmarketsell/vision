import { describe, expect, it } from 'vitest';
import { textForDocument } from '../../src/features/claude-terminal/renderer/chat/copyText';

describe('copying chat text into a document', () => {
  it('leaves exactly one empty line between paragraphs', () => {
    expect(textForDocument('First.\n\n\n\nSecond.\n\nThird.')).toBe('First.\n\nSecond.\n\nThird.');
  });

  it('treats lines of only spaces as empty and keeps single line breaks', () => {
    expect(textForDocument('A\n  \n  \n\nB\nC')).toBe('A\n\nB\nC');
  });

  it('drops empty lines at the start and end, and Windows line endings', () => {
    expect(textForDocument('\n\nHello\r\n\r\n\r\nWorld\n\n')).toBe('Hello\n\nWorld');
  });
});
