import type { Command } from './feature';

const registry = new Map<string, Command>();

export function registerCommands(commands: Command[]): void {
  for (const command of commands) registry.set(command.id, command);
}

export function runCommand(id: string): void {
  void registry.get(id)?.run();
}

/** Turns a key press into the shortcut format used by commands, e.g. "Mod+Shift+.". */
export function shortcutFromEvent(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'code' | 'key'>): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('Mod');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  const { code } = event;
  let key = event.key.toUpperCase();
  if (code.startsWith('Key')) key = code.slice(3);
  else if (code.startsWith('Digit')) key = code.slice(5);
  else if (code === 'Period') key = '.';
  else if (code === 'Comma') key = ',';
  parts.push(key);
  return parts.join('+');
}

/**
 * Handles command shortcuts for the whole window. Runs in the capture phase so it works
 * even when the editor or terminal has focus.
 */
export function installKeybindings(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.metaKey && !event.ctrlKey) return;
    const shortcut = shortcutFromEvent(event);
    for (const command of registry.values()) {
      if (command.shortcut === shortcut) {
        event.preventDefault();
        event.stopPropagation();
        void command.run();
        return;
      }
    }
  };
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
