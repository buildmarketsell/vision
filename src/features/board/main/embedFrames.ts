import { session } from 'electron';
import { allowFraming } from '../embedHeaders';

/**
 * Websites pasted on a board load in frames. Most sites tell browsers not to show them inside
 * another page (X-Frame-Options, CSP frame-ancestors), which only protects sites from being
 * shown on strangers' pages. VISION is a local app showing a page Dan chose, so those two
 * headers are dropped for frames only. The frames stay sandboxed and cross-origin: they can't
 * reach the app or `window.vision`.
 */
export function registerEmbedFrames(): void {
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (details.resourceType !== 'subFrame' || !details.responseHeaders) return callback({});
    callback({ responseHeaders: allowFraming(details.responseHeaders) });
  });
  // YouTube's player refuses to play without a Referer (error 153), and the built app's page is a
  // local file, which sends none. Any https origin satisfies it.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/embed/*', 'https://www.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      const headers = details.requestHeaders;
      if (details.resourceType === 'subFrame' && !headers['Referer']) headers['Referer'] = 'https://vision.app/';
      callback({ requestHeaders: headers });
    },
  );
}
