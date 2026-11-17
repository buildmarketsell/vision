import { useEffect, useMemo, useRef } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { convertEmbeds, imageUrl, resolveImagePath } from '../../shared/markdownImages';

// Links open in the browser (the main process routes new windows there).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// DOMPurify's default list plus vision-file:, the scheme local images are served on.
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|vision-file):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

function toHtml(text: string, baseDir: string | undefined): string {
  const marked = new Marked({
    gfm: true,
    breaks: false,
    walkTokens: (token) => {
      if (token.type !== 'image' || !baseDir) return;
      const path = resolveImagePath(baseDir, token.href);
      if (path) token.href = imageUrl(path);
    },
  });
  const source = baseDir ? convertEmbeds(text) : text;
  return DOMPurify.sanitize(marked.parse(source, { async: false }), { ALLOWED_URI_REGEXP: ALLOWED_URI });
}

const COPY_LABEL = 'Copy';
const COPY_FEEDBACK_MS = 1500;

/** Wraps each code block with a Copy button that copies the whole block, like VS Code. */
function addCopyButtons(root: HTMLElement): void {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = COPY_LABEL;
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent ?? '').then(
        () => (button.textContent = 'Copied'),
        () => (button.textContent = 'Copy failed'),
      );
      setTimeout(() => (button.textContent = COPY_LABEL), COPY_FEEDBACK_MS);
    });
    wrap.append(pre, button);
  });
}

/**
 * Markdown as formatted text: Claude's replies and the .md preview. HTML in the source is sanitized.
 * With `baseDir` (the note's folder), relative images and Obsidian `![[embeds]]` show the local file.
 */
export function Markdown({ text, className = '', baseDir }: { text: string; className?: string; baseDir?: string }) {
  const html = useMemo(() => toHtml(text, baseDir), [text, baseDir]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) addCopyButtons(ref.current);
  }, [html]);
  return <div ref={ref} className={`markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
