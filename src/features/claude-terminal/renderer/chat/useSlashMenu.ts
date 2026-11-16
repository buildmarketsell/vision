import { useState, type KeyboardEvent } from 'react';
import type { MenuItem } from './ComposerMenu';
import type { SlashCommand } from './sessionInfo';

const MAX_SHOWN = 50;
const MAX_DETAIL_CHARS = 120;

/** The command being typed: "/rev" → "rev". Null once there's a space (the command is chosen). */
export function slashQuery(text: string): string | null {
  const match = /^\/(\S*)$/.exec(text);
  return match ? (match[1] ?? '') : null;
}

/** Commands whose name contains the query, the ones that start with it first. */
export function matchCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const needle = query.toLowerCase();
  const hits = commands.filter((command) => command.name.toLowerCase().includes(needle));
  const starts = hits.filter((command) => command.name.toLowerCase().startsWith(needle));
  return [...starts, ...hits.filter((command) => !starts.includes(command))].slice(0, MAX_SHOWN);
}

export interface SlashMenu {
  open: boolean;
  items: MenuItem[];
  active: number;
  setActive: (index: number) => void;
  pick: (item: MenuItem) => void;
  /** True when the key was used by the menu (the composer then ignores it). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** Typing "/" at the start of the message lists Claude Code's slash commands and skills. */
export function useSlashMenu(text: string, commands: SlashCommand[], setText: (text: string) => void): SlashMenu {
  const [active, setActive] = useState(0);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const query = slashQuery(text);
  const open = query !== null && commands.length > 0 && dismissedFor !== text;
  const matches = open ? matchCommands(commands, query) : [];
  const items: MenuItem[] = matches.map((command) => ({
    id: command.name,
    label: `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ''}`,
    detail: command.description.slice(0, MAX_DETAIL_CHARS),
  }));
  const current = Math.min(active, Math.max(0, items.length - 1));

  const pick = (item: MenuItem) => {
    setText(`/${item.id} `);
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent): boolean => {
    if (!open || items.length === 0) return false;
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      setActive((current + step + items.length) % items.length);
    } else if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      const item = items[current];
      if (item) pick(item);
    } else if (event.key === 'Escape') {
      setDismissedFor(text);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };

  return { open: open && items.length > 0, items, active: current, setActive, pick, onKeyDown };
}
