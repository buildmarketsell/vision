import { useLayoutEffect, useRef } from 'react';

/** The latest value, for effects and event handlers that must not re-run when it changes. Set after render: writing a ref during render is unsafe in React. */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
