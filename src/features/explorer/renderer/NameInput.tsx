import { useEffect, useRef, useState } from 'react';

interface NameInputProps {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/** Inline name box for creating or renaming. Enter saves, Escape or clicking away cancels. */
export function NameInput({ initial, onSubmit, onCancel }: NameInputProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    const dot = initial.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const finish = (submit: boolean) => {
    if (done.current) return;
    done.current = true;
    const trimmed = value.trim();
    if (submit && trimmed !== '' && trimmed !== initial) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      className="text-input"
      value={value}
      spellCheck={false}
      aria-label="Name"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      }}
    />
  );
}
