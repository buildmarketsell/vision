import { lazy, Suspense, useEffect, useState } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { TabParams } from '../../../renderer/core/feature';
import { parseBoardText, type BoardScene } from '../boardFile';

const BoardCanvas = lazy(() => import('./BoardCanvas'));

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; text: string; scene: BoardScene | null }
  | { status: 'error'; title: string; detail?: string };

async function loadBoard(path: string): Promise<Loaded> {
  const result = await window.vision.fs.readFile(path);
  if (result.kind === 'tooLarge') return { status: 'error', title: 'This board is too large to open.', detail: 'Boards up to 5 MB open here. Big pasted images make boards heavy.' };
  if (result.kind === 'binary') return { status: 'error', title: "This file isn't a board." };
  if (result.kind !== 'text') return { status: 'error', title: "This board can't be read.", detail: result.message };
  const parsed = parseBoardText(result.content);
  if (parsed.kind === 'invalid') return { status: 'error', title: "This board can't be opened.", detail: `${parsed.message} It was left untouched.` };
  return { status: 'ready', text: result.content, scene: parsed.kind === 'scene' ? parsed.scene : null };
}

function Message({ title, detail, busy }: { title: string; detail?: string; busy?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="title">{title}</div>
      {detail && <div className="max-w-sm text-(--color-text-muted)">{detail}</div>}
      {busy && <div className="spinner" />}
    </div>
  );
}

/** A board tab: an Excalidraw canvas that saves itself to its `.excalidraw` file. */
export function BoardPanel({ params }: IDockviewPanelProps<TabParams>) {
  return <Board path={params.path ?? ''} />;
}

/** The canvas for one board file; used by board tabs and by the Boards page. */
export function Board({ path }: { path: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadBoard(path).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loaded.status === 'loading') return <Message title="Opening board…" busy />;
  if (loaded.status === 'error') return <Message title={loaded.title} detail={loaded.detail} />;
  return (
    <div className="board-canvas h-full bg-(--color-card)">
      <Suspense fallback={<Message title="Loading board…" busy />}>
        <BoardCanvas path={path} initialText={loaded.text} initialScene={loaded.scene} />
      </Suspense>
    </div>
  );
}
