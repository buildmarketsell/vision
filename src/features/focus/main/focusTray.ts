import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import type { Glance } from '../../../shared/glance';
import { TRAY_ICON_1X, TRAY_ICON_2X } from './trayIcon';
import { trayMenu, trayTitle, type TrayItem, type TrayRun } from './trayMenu';

let tray: Tray | null = null;
let lastTitle: string | null = null;
let lastMenu = '';

function icon() {
  const image = nativeImage.createFromDataURL(TRAY_ICON_1X);
  image.addRepresentation({ scaleFactor: 2, dataURL: TRAY_ICON_2X });
  image.setTemplateImage(true);
  return image;
}

function toTemplate(items: TrayItem[], run: (what: TrayRun) => void): MenuItemConstructorOptions[] {
  return items.map((item): MenuItemConstructorOptions => {
    if ('separator' in item) return { type: 'separator' };
    const { label, run: what, submenu } = item;
    if (submenu) return { label, submenu: toTemplate(submenu, run) };
    return what ? { label, click: () => run(what) } : { label, enabled: false };
  });
}

/** The menu bar item: always there (the eye), with the clock and task while a focus or heads-up runs. */
export function createFocusTray(run: (what: TrayRun) => void): { update: (glance: Glance, island: boolean) => void; popUp: () => void } {
  tray = new Tray(icon());
  tray.setToolTip('VISION focus');
  const update = (glance: Glance, island: boolean) => {
    if (!tray) return;
    const title = trayTitle(glance, !island);
    // Digits keep their width, so the text doesn't jiggle every second.
    if (title !== lastTitle) tray.setTitle(title, { fontType: 'monospacedDigit' });
    lastTitle = title;
    const items = trayMenu(glance);
    const key = JSON.stringify(items);
    // Rebuilt only when it changes: a menu replaced every second closes under the pointer.
    if (key !== lastMenu) tray.setContextMenu(Menu.buildFromTemplate(toTemplate(items, run)));
    lastMenu = key;
  };
  return { update, popUp: () => tray?.popUpContextMenu() };
}
