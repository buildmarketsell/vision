import { describe, expect, it } from 'vitest';
import { chatBanners } from '../../src/features/claude-terminal/renderer/chat/chatBanners';
import { reduceSessionInfo, emptySessionInfo } from '../../src/features/claude-terminal/renderer/chat/sessionInfo';
import { MCP_STATUS_REQUEST_ID } from '../../src/shared/claudeChat';

const now = new Date('2026-11-17T20:00').getTime();
const inHours = (hours: number) => now + hours * 3_600_000;

describe('Chat banners', () => {
  it('warns only when Claude says a limit is close, and says so when it is hit', () => {
    const banners = chatBanners(
      [
        { key: 'five_hour', utilization: 0.92, resetsAt: inHours(2), status: 'allowed_warning' },
        { key: 'seven_day', utilization: 0.5, resetsAt: inHours(48), status: 'allowed' },
        { key: 'seven_day_fable', utilization: 1, resetsAt: inHours(48), status: 'rejected' },
        { key: 'seven_day_opus', utilization: 0.95, resetsAt: now - 1, status: 'allowed_warning' },
      ],
      [],
      now,
    );
    expect(banners.map((banner) => banner.tone)).toEqual(['warning', 'error']);
    expect(banners[0]?.text).toMatch(/^You've used 92% of your 5-hour limit · resets at /);
    expect(banners[1]?.text).toMatch(/^You've hit your Fable limit · resets \w+ /);
  });
  it('groups connection problems, shows the browser link, and stays quiet about sign-ins', () => {
    const banners = chatBanners(
      [],
      [
        { name: 'claude-in-chrome', status: 'connected' },
        { name: 'claude.ai Gmail', status: 'needs-auth' },
        { name: 'whop-api', status: 'needs-auth' },
        { name: 'openchatcut', status: 'failed' },
        { name: 'claude.ai Notion', status: 'pending' },
      ],
      now,
    );
    expect(banners.map((banner) => banner.text)).toEqual([
      'Browser connected',
      'Failed to connect: openchatcut',
    ]);
  });
  it('reads the mcp_status reply and ignores other replies', () => {
    const reply = (requestId: string) => ({
      type: 'control_response',
      response: { subtype: 'success', request_id: requestId, response: { mcpServers: [{ name: 'whop-docs', status: 'connected', tools: [] }, { name: 7 }] } },
    });
    expect(reduceSessionInfo(emptySessionInfo(), reply(MCP_STATUS_REQUEST_ID)).mcpServers).toEqual([{ name: 'whop-docs', status: 'connected' }]);
    expect(reduceSessionInfo(emptySessionInfo(), reply('vision-init')).mcpServers).toEqual([]);
  });
});
