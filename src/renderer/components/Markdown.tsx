import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Links open in the browser (the main process routes new windows there).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Markdown as formatted text: Claude's replies and the .md preview. HTML in the source is sanitized. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true, breaks: false })), [text]);
  return <div className={`markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
