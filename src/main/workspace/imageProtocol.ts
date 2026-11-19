import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { IMAGE_SCHEME, imageExtension, videoExtension } from '../../shared/markdownImages';
import { isInsideFolder } from '../paths';
import { allWindowContexts } from '../windows';
import { previewSchemePrivileges } from './previewProtocol';

/** Must run before the app is ready. Registers the preview scheme too: Electron takes only one call. */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, stream: true } }, previewSchemePrivileges]);
}

/** Serves image and video files from inside an open folder (Markdown previews, boards). Anything else is refused. */
export function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, (request) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const allowed =
      (imageExtension(path) !== null || videoExtension(path) !== null) &&
      allWindowContexts().some(({ folder }) => folder !== null && isInsideFolder(folder, path));
    // The Range header lets video players seek without loading the whole file.
    return allowed ? net.fetch(pathToFileURL(path).toString(), { headers: request.headers }) : new Response(null, { status: 403 });
  });
}
