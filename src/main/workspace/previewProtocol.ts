import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { isPreviewableFile, PREVIEW_SCHEME } from '../../shared/htmlPreview';
import { isInsideFolder } from '../paths';
import { allWindowContexts } from '../windows';

/** Must run before the app is ready (together with the image scheme: Electron allows one call). */
export const previewSchemePrivileges = {
  scheme: PREVIEW_SCHEME,
  // corsEnabled + the header below let module scripts and fetch() work from the sandboxed (originless) frame.
  privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
};

/** Serves web files (HTML, CSS, JS, images, fonts) from inside an open folder to HTML previews. Anything else is refused. */
export function registerPreviewProtocol(): void {
  protocol.handle(PREVIEW_SCHEME, async (request) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const allowed = isPreviewableFile(path) && allWindowContexts().some(({ folder }) => folder !== null && isInsideFolder(folder, path));
    if (!allowed) return new Response(null, { status: 403 });
    const response = await net.fetch(pathToFileURL(path).toString(), { headers: request.headers });
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    // Always the file as it is now: the preview reloads after every save.
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  });
}
