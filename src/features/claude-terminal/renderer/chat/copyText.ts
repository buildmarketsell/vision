/**
 * Text copied from the chat, ready for a document: each paragraph break becomes exactly one empty line.
 * A browser selection puts two or more empty lines between blocks (paragraphs, lists, headings), and Google Docs
 * turns every one of them into an empty paragraph (Dan, 2026-11-19: "inside the actual doc i want only one line").
 */
export function textForDocument(selected: string): string {
  return selected
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
