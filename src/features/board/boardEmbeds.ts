/** What a link on a board shows: pure, so it is unit tested without Excalidraw. */

import { videoExtension } from '../../shared/markdownImages';

export type BoardEmbed =
  /** A video file next to the board, played in a native player. `link` is relative to the board's folder. */
  | { kind: 'video'; link: string }
  /** A page shown in a frame, when Excalidraw's own handling would not work in VISION. */
  | { kind: 'frame'; src: string }
  /** Excalidraw's own embed (YouTube, Vimeo, Figma, any website). */
  | { kind: 'default' };

const RE_TWEET = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i;
const RE_REDDIT_POST = /^https?:\/\/(?:www\.)?reddit\.com(\/r\/[\w-]+\/comments\/[\w-]+(?:\/[\w-]*)?)/i;

function isWebLink(link: string): boolean {
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(link);
}

/** A relative path to a video file, as saved by VISION (`videos/clip.mp4`). */
function isLocalVideo(link: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.startsWith('/') && !link.split('/').includes('..') && videoExtension(link) !== null;
}

/** Which pasted or typed links may become an embed: any web page, or a video saved next to the board. */
export function isBoardEmbeddable(link: string): boolean {
  return isWebLink(link) || isLocalVideo(link);
}

export function boardEmbed(link: string): BoardEmbed {
  if (isLocalVideo(link)) return { kind: 'video', link };
  // Excalidraw shows posts from X and Reddit by running their scripts inside the app's own page,
  // which VISION's security policy blocks. Their official embed pages work as plain frames.
  const tweet = RE_TWEET.exec(link);
  if (tweet) return { kind: 'frame', src: `https://platform.twitter.com/embed/Tweet.html?id=${tweet[1]}&dnt=true` };
  const reddit = RE_REDDIT_POST.exec(link);
  if (reddit) return { kind: 'frame', src: `https://embed.reddit.com${reddit[1]}` };
  return { kind: 'default' };
}
