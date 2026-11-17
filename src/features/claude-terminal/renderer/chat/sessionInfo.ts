import { MCP_STATUS_REQUEST_ID } from '../../../../shared/claudeChat';
import { asArr, asObj, asStr, type Obj } from './eventParsing';

/**
 * What Claude Code tells VISION about the session, outside the conversation itself:
 * models and slash commands (from the reply to `initialize`) and how full the context window is.
 */

export interface ModelOption {
  value: string;
  displayName: string;
  description: string;
  /** Whether this model takes an effort level (Haiku doesn't). */
  supportsEffort: boolean;
}

/** An MCP server and how its connection stands: connected, pending, needs-auth, failed or disabled. */
export interface McpServer {
  name: string;
  status: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  argumentHint: string;
}

export interface SessionInfo {
  models: ModelOption[];
  commands: SlashCommand[];
  /** From the latest `mcp_status` reply; empty until the first one arrives. */
  mcpServers: McpServer[];
  /** Tokens in the context after the latest reply (input, cached and output). */
  contextUsed: number;
  contextWindow: number;
}

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export function emptySessionInfo(): SessionInfo {
  return { models: [], commands: [], mcpServers: [], contextUsed: 0, contextWindow: DEFAULT_CONTEXT_WINDOW };
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function parseModels(raw: unknown): ModelOption[] {
  return asArr(raw).flatMap((item) => {
    const model = asObj(item);
    const value = asStr(model?.['value']);
    if (!value) return [];
    return [{ value, displayName: asStr(model?.['displayName']) ?? value, description: asStr(model?.['description']) ?? '', supportsEffort: model?.['supportsEffort'] === true }];
  });
}

function parseCommands(raw: unknown): SlashCommand[] {
  return asArr(raw).flatMap((item) => {
    const command = asObj(item);
    const name = asStr(command?.['name']);
    return name ? [{ name, description: asStr(command?.['description']) ?? '', argumentHint: asStr(command?.['argumentHint']) ?? '' }] : [];
  });
}

function parseMcpServers(raw: unknown): McpServer[] {
  return asArr(raw).flatMap((item) => {
    const server = asObj(item);
    const name = asStr(server?.['name']);
    const status = asStr(server?.['status']);
    return name && status ? [{ name, status }] : [];
  });
}

function fromControlResponse(info: SessionInfo, event: Obj): SessionInfo {
  const response = asObj(event['response']);
  const reply = asObj(response?.['response']);
  if (response?.['request_id'] === MCP_STATUS_REQUEST_ID) {
    const mcpServers = parseMcpServers(reply?.['mcpServers']);
    return JSON.stringify(mcpServers) === JSON.stringify(info.mcpServers) ? info : { ...info, mcpServers };
  }
  if (!reply || (!('models' in reply) && !('commands' in reply))) return info;
  return { ...info, models: parseModels(reply['models']), commands: parseCommands(reply['commands']) };
}

/** Context in use = everything sent in plus the reply, from the main conversation (not subagents). */
function fromAssistant(info: SessionInfo, event: Obj): SessionInfo {
  if (event['parent_tool_use_id']) return info;
  const usage = asObj(asObj(event['message'])?.['usage']);
  if (!usage) return info;
  const used = num(usage['input_tokens']) + num(usage['cache_creation_input_tokens']) + num(usage['cache_read_input_tokens']) + num(usage['output_tokens']);
  return used > 0 && used !== info.contextUsed ? { ...info, contextUsed: used } : info;
}

function fromResult(info: SessionInfo, event: Obj): SessionInfo {
  const windows = Object.values(asObj(event['modelUsage']) ?? {}).map((usage) => num(asObj(usage)?.['contextWindow']));
  const contextWindow = Math.max(0, ...windows);
  return contextWindow > 0 && contextWindow !== info.contextWindow ? { ...info, contextWindow } : info;
}

/** Returns the same object when nothing changed, so the composer doesn't re-render on every streamed word. */
export function reduceSessionInfo(info: SessionInfo, event: Obj): SessionInfo {
  switch (event['type']) {
    case 'control_response':
      return fromControlResponse(info, event);
    case 'assistant':
      return fromAssistant(info, event);
    case 'result':
      return fromResult(info, event);
    default:
      return info;
  }
}
