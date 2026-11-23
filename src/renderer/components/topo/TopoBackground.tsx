import { useEffect, useRef, type ReactNode } from 'react';
import { startTopo } from './topoRenderer';

/** A slowly drifting contour map behind `children`: move the mouse to raise a hill, click for a ripple. */
export function TopoBackground({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return undefined;
    return startTopo(root, canvas, ctx);
  }, []);

  return (
    <div className="topo" ref={rootRef}>
      <canvas className="topo-canvas" ref={canvasRef} aria-hidden />
      {children}
    </div>
  );
}
