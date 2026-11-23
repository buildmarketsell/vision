import { PERMISSION_MODES, type PermissionMode } from '../../../../shared/claudeChat';
import type { SessionInfo } from '../../../../shared/chat/sessionInfo';

/** The "/" menu in the message box, like Claude Code's in VS Code (Dan, 2026-11-20). */

export type ActionSection = 'Context' | 'Model' | 'Permissions' | 'Slash commands';

export type ActionKind =
  | { kind: 'attachImage' }
  | { kind: 'mentionFile' }
  | { kind: 'newChat' }
  | { kind: 'model'; value: string }
  | { kind: 'mode'; value: PermissionMode }
  | { kind: 'command'; name: string };

export interface ActionItem {
  id: string;
  section: ActionSection;
  label: string;
  detail?: string;
  checked?: boolean;
  action: ActionKind;
}

export const MODE_LABELS: Record<PermissionMode, string> = {
  auto: 'Auto (never ask)',
  default: 'Ask before edits',
  acceptEdits: 'Edit automatically',
  plan: 'Plan first',
};

const MAX_DETAIL_CHARS = 120;

/** Every action, in menu order. The model and mode in use are checked. */
export function buildActions(info: SessionInfo, model: string, mode: PermissionMode): ActionItem[] {
  return [
    { id: 'attach', section: 'Context', label: 'Attach image…', action: { kind: 'attachImage' } },
    { id: 'mention', section: 'Context', label: 'Mention a file…', detail: 'Its path goes in your message', action: { kind: 'mentionFile' } },
    { id: 'new', section: 'Context', label: 'New chat', detail: '⌘T', action: { kind: 'newChat' } },
    ...info.models.map((option): ActionItem => ({
      id: `model:${option.value}`,
      section: 'Model',
      label: option.displayName,
      detail: option.description,
      checked: option.value === model,
      action: { kind: 'model', value: option.value },
    })),
    ...PERMISSION_MODES.map((value): ActionItem => ({ id: `mode:${value}`, section: 'Permissions', label: MODE_LABELS[value], checked: value === mode, action: { kind: 'mode', value } })),
    ...info.commands.map((command): ActionItem => ({
      id: `command:${command.name}`,
      section: 'Slash commands',
      label: `/${command.name}`,
      detail: command.description.slice(0, MAX_DETAIL_CHARS),
      action: { kind: 'command', name: command.name },
    })),
  ];
}

/** Actions whose label, detail or section contains every word typed in "Filter actions…". */
export function filterActions(items: ActionItem[], query: string): ActionItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const text = `${item.section} ${item.label} ${item.detail ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
