/** "Show this folder in the files panel": the chat asks, the files panel (explorer feature) answers. */

let revealHandler: ((path: string) => void) | null = null;

export function setRevealHandler(handler: (path: string) => void): void {
  revealHandler = handler;
}

export function revealInFiles(path: string): void {
  revealHandler?.(path);
}
