import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { convertEmbeds, imageUrl, resolveLocalPath } from '../../shared/markdownImages';
import { fileMention } from '../../shared/fileMentions';
import { openFile } from '../core/dockActions';
import { revealInFiles } from '../core/reveal';
import { COPY_FEEDBACK_MS } from './CopyButton';
import { afterSingleClick, cancelSingleClick, FileLinkMenu, type FileLinkTarget } from './FileLinkMenu';

// Web links open in the browser (the main process routes new windows there); file links are caught in Markdown's onClick.
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
      const path = resolveLocalPath(baseDir, token.href);
      if (path) token.href = imageUrl(path);
    },
  });
  const source = baseDir ? convertEmbeds(text) : text;
  return DOMPurify.sanitize(marked.parse(source, { async: false }), { ALLOWED_URI_REGEXP: ALLOWED_URI });
}

// Lucide's copy and check icons as markup: code blocks are built outside React.
const SVG = (shape: string) =>
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
const COPY_ICON = SVG('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const CHECK_ICON = SVG('<path d="M20 6 9 17l-5-5"/>');

function setCopyState(button: HTMLButtonElement, state: 'idle' | 'copied' | 'failed'): void {
  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy code';
  button.dataset['state'] = state;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = state === 'copied' ? CHECK_ICON : COPY_ICON;
}

/** Puts a small copy icon in each code block's top-right corner, like VS Code; it shows on hover. */
function addCopyButtons(root: HTMLElement): void {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-button copy-code';
    setCopyState(button, 'idle');
    let timer: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent ?? '').then(
        () => setCopyState(button, 'copied'),
        () => setCopyState(button, 'failed'),
      );
      clearTimeout(timer);
      timer = setTimeout(() => setCopyState(button, 'idle'), COPY_FEEDBACK_MS);
    });
    wrap.append(pre, button);
  });
}

/** Inline code that names a file or folder (`outputs/page.html`, `outputs/images/`) becomes a button that opens or reveals it. */
function markFileMentions(root: HTMLElement): void {
  root.querySelectorAll(':not(pre) > code').forEach((code) => {
    if (code.classList.contains('file-mention') || !fileMention(code.textContent ?? '')) return;
    code.classList.add('file-mention');
    code.setAttribute('role', 'button');
    code.setAttribute('tabindex', '0');
    code.setAttribute('title', 'Open (double-click for more)');
  });
}

/** Finds the mentioned file or folder; marks the mention when it isn't in the folder. */
async function locateMention(code: HTMLElement) {
  const found = await window.vision.fs.locate(code.textContent ?? '');
  if (!found) {
    code.dataset['missing'] = 'true';
    code.setAttribute('title', 'Not found in this folder');
  }
  return found;
}

/** Opens the mentioned file in a tab, or shows the folder in the files panel. */
async function openMention(code: HTMLElement): Promise<void> {
  const found = await locateMention(code);
  if (found?.isDirectory) revealInFiles(found.path);
  else if (found) openFile(found.path);
}

/**
 * Markdown as formatted text: Claude's replies and the .md preview. HTML in the source is sanitized.
 * With `baseDir` (the note's folder, or Claude's working folder), relative images and Obsidian
 * `![[embeds]]` show the local file, and links to local files open them in a tab.
 */
export function Markdown({ text, className = '', baseDir }: { text: string; className?: string; baseDir?: string }) {
  const html = useMemo(() => toHtml(text, baseDir), [text, baseDir]);
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<FileLinkTarget | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    addCopyButtons(ref.current);
    if (baseDir) markFileMentions(ref.current);
  }, [html, baseDir]);
  const openLocalLink = (event: MouseEvent<HTMLDivElement>) => {
    const mention = (event.target as Element).closest<HTMLElement>('code.file-mention');
    if (mention) {
      afterSingleClick(event, () => void openMention(mention));
      return;
    }
    const href = (event.target as Element).closest('a')?.getAttribute('href');
    const path = baseDir && href ? resolveLocalPath(baseDir, href) : null;
    if (!path) return;
    event.preventDefault();
    openFile(path);
  };
  const openMentionWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const mention = (event.target as Element).closest<HTMLElement>('code.file-mention');
    if (!mention || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    void openMention(mention);
  };
  /** Double-click or right-click on a file name: Show in Files, Open, Reveal in Finder, Copy Path. */
  const showMentionMenu = (event: MouseEvent<HTMLDivElement>) => {
    const mention = (event.target as Element).closest<HTMLElement>('code.file-mention');
    if (!mention) return;
    event.preventDefault();
    cancelSingleClick();
    // A double-click would otherwise also select the word under it.
    window.getSelection()?.removeAllRanges();
    const { clientX: x, clientY: y } = event;
    void locateMention(mention).then((found) => found && setMenu({ ...found, x, y }));
  };
  return (
    <>
      <div
        ref={ref}
        className={`markdown ${className}`}
        onClick={openLocalLink}
        onDoubleClick={showMentionMenu}
        onContextMenu={showMentionMenu}
        onKeyDown={openMentionWithKeys}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {menu && <FileLinkMenu target={menu} onClose={() => setMenu(null)} />}
    </>
  );
}
