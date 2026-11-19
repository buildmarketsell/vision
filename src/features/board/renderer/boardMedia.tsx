import { CaptureUpdateAction, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { imageUrl, resolveLocalPath, videoExtension } from '../../../shared/markdownImages';
import { boardEmbed } from '../boardEmbeds';

const VIDEO_WIDTH = 480;
const METADATA_TIMEOUT_MS = 3000;

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'));
}

export function videoFiles(files: FileList | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => videoExtension(file.name) !== null);
}

/** Saves the video next to the board (a file already in the board's folder stays where it is); returns its link. */
async function videoLink(boardPath: string, file: File): Promise<{ link: string } | { error: string }> {
  const boardDir = dirOf(boardPath);
  const source = window.vision.app.pathForFile(file);
  if (source.startsWith(`${boardDir}/`)) return { link: source.slice(boardDir.length + 1) };
  const ext = videoExtension(file.name) ?? 'mp4';
  const saved = await window.vision.fs.saveVideo(boardPath, source || new Uint8Array(await file.arrayBuffer()), ext);
  return saved.ok ? { link: saved.value.slice(boardDir.length + 1) } : { error: saved.error };
}

/** The video's own shape, so a phone video stays tall. Falls back to 16:9. */
function videoSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const fallback = { width: VIDEO_WIDTH, height: Math.round((VIDEO_WIDTH * 9) / 16) };
    const timer = setTimeout(() => resolve(fallback), METADATA_TIMEOUT_MS);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const { videoWidth, videoHeight } = video;
      resolve(videoWidth && videoHeight ? { width: VIDEO_WIDTH, height: Math.round((VIDEO_WIDTH * videoHeight) / videoWidth) } : fallback);
    };
    video.onerror = () => {
      clearTimeout(timer);
      resolve(fallback);
    };
    video.src = url;
  });
}

/** Adds video files to the board as players, side by side, centered on a scene point. Returns an error to show, if any. */
export async function addVideos(api: ExcalidrawImperativeAPI, boardPath: string, files: File[], at: { x: number; y: number }): Promise<string | null> {
  let x = at.x;
  for (const file of files) {
    const saved = await videoLink(boardPath, file);
    if ('error' in saved) return `Could not add ${file.name}: ${saved.error}`;
    const { width, height } = await videoSize(localVideoUrl(boardPath, saved.link));
    // restoreElements fills in every field Excalidraw needs for a new element.
    const [element] = restoreElements([{ type: 'embeddable', id: crypto.randomUUID(), x: x - width / 2, y: at.y - height / 2, width, height, link: saved.link } as never], null);
    if (!element) continue;
    x += width + 20;
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), element],
      appState: { selectedElementIds: { [element.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }
  return null;
}

function localVideoUrl(boardPath: string, link: string): string {
  return imageUrl(resolveLocalPath(dirOf(boardPath), link) ?? '');
}

/** Draws embeds Excalidraw can't show in VISION on its own; null leaves the rest to Excalidraw. */
export function renderBoardEmbed(boardPath: string, element: NonDeleted<ExcalidrawEmbeddableElement>) {
  const embed = boardEmbed(element.link ?? '');
  if (embed.kind === 'video') return <video className="board-video" src={localVideoUrl(boardPath, embed.link)} controls preload="metadata" />;
  if (embed.kind === 'frame') {
    return (
      <iframe
        className="excalidraw__embeddable"
        src={embed.src}
        title="Embedded post"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    );
  }
  return null;
}
