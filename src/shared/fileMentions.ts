/** File names and paths Claude mentions in a chat ("`outputs/page.html`", "`app.ts:42`"), so clicking them opens the file. */

const MAX_MENTION_LENGTH = 400;
/** Ends in a file extension: a dot, then 1-10 letters or digits with at least one letter (so "1.5" is not a file). */
const ENDS_WITH_EXTENSION = /\.(?=[a-z0-9]*[a-z])[a-z0-9]{1,10}$/i;
/** Shell and code characters that never appear in the paths Claude writes, but do in commands and snippets. */
const CODE_CHARACTERS = /[\n`'"*?<>|$;=(){}[\]\\]/;

/** The path inside a mention, without a trailing ":42" / ":42-51" / "#L42", or null when it doesn't look like a file. */
export function fileMention(text: string): string | null {
  const mention = text.trim().replace(/(?::\d+(?:-\d+)?|#L\d+(?:-L?\d+)?)$/, '');
  if (mention === '' || mention.length > MAX_MENTION_LENGTH || mention.startsWith('-')) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(mention) || CODE_CHARACTERS.test(mention)) return null;
  return ENDS_WITH_EXTENSION.test(mention) ? mention : null;
}
