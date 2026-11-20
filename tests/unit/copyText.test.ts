import { describe, expect, it } from 'vitest';
import { isLastTextOfAnswer, textForDocument } from '../../src/features/claude-terminal/renderer/chat/copyText';

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

describe('reply copy icon', () => {
  const user = (key: string) => ({ kind: 'user' as const, key, text: 'hi' });
  const text = (key: string) => ({ kind: 'text' as const, key, text: 'ok', streaming: false });
  const tool = (key: string) => ({ kind: 'tool' as const, key, toolId: key });

  it('sits under the last text of each answer only', () => {
    const items = [user('u1'), text('t1'), tool('x1'), text('t2'), user('u2'), text('t3'), tool('x2')];
    expect(items.map((_, index) => isLastTextOfAnswer(items, index))).toEqual([false, false, false, true, false, true, false]);
  });
});
