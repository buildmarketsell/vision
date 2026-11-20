import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** How long the check mark stays after copying. Code blocks (Markdown.tsx) use the same. */
export const COPY_FEEDBACK_MS = 1500;

/** A small copy icon that turns into a check mark, like VS Code's. `getText` runs at click time. */
export function CopyButton({ getText, label, className = '' }: { getText: () => string; label: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const title = state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label;
  return (
    <button
      type="button"
      className={`copy-button ${className}`}
      data-state={state}
      title={title}
      aria-label={title}
      onClick={() => navigator.clipboard.writeText(getText()).then(() => setState('copied'), () => setState('failed'))}
    >
      {state === 'copied' ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
    </button>
  );
}
