import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { IMAGE_SCHEME, imageExtension } from '../../shared/markdownImages';
import { isInsideFolder } from '../paths';
import { allWindowContexts } from '../windows';

/** Must run before the app is ready. */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true } }]);
}

/** Serves image files from inside an open folder to Markdown previews. Anything else is refused. */
export function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, (request) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    const allowed =
      imageExtension(path) !== null &&
      allWindowContexts().some(({ folder }) => folder !== null && isInsideFolder(folder, path));
    return allowed ? net.fetch(pathToFileURL(path).toString()) : new Response(null, { status: 403 });
  });
}
