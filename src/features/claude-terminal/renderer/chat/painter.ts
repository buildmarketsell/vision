/** Draws one frame of a chat background in CSS pixels; `clear` is the width of the reading column kept empty in the middle. */
export interface Painter {
  draw: (seconds: number, width: number, height: number, clear: number, color: string) => void;
  dispose: () => void;
}
