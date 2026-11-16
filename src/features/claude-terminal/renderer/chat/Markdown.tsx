import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Links in Claude's replies open in the browser (the main process routes new windows there).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Claude's reply as formatted text. HTML from the model is sanitized before it is shown. */
export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true, breaks: false })), [text]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
