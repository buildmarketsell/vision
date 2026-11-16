#!/usr/bin/env node
// Stands in for the `claude` CLI in tests, so they cost nothing.
// Terminal mode (no -p): names the conversation like Claude Code does, then echoes input.
// Chat mode (-p, stream-json): answers each message with streamed text; "edit" asks for
// permission first, "ask" asks a question, "slow" waits until interrupted.
import { createInterface } from 'node:readline';

const SESSION = '11111111-2222-4333-8444-555555555555';
const out = (event) => process.stdout.write(`${JSON.stringify({ session_id: SESSION, ...event })}\n`);

if (!process.argv.includes('-p')) {
  process.stdout.write('\u001b]0;✳ Test conversation\u0007');
  process.stdout.write(`Fake Claude ready in ${process.cwd()}\n`);
  process.stdin.pipe(process.stdout);
} else {
  let pending = null;
  let turn = 0;
  const reply = (text) => {
    const id = `msg_${++turn}`;
    out({ type: 'stream_event', api_message_id: id, event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } });
    for (const word of text.split(' ')) out({ type: 'stream_event', api_message_id: id, event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${word} ` } } });
    out({ type: 'assistant', message: { id, content: [{ type: 'text', text }] } });
    out({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.29, resetsAt: 1900000000 }, seven_day: { utilization: 0.4, resetsAt: 1900500000 } } } });
    out({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.001 });
  };
  const askTool = (name, input, then) => {
    const id = `msg_${++turn}`;
    out({ type: 'assistant', message: { id, content: [{ type: 'tool_use', id: `tool_${turn}`, name, input }] } });
    pending = { requestId: `req_${turn}`, toolId: `tool_${turn}`, then };
    out({ type: 'control_request', request_id: pending.requestId, request: { subtype: 'can_use_tool', tool_name: name, input, tool_use_id: `tool_${turn}` } });
  };
  createInterface({ input: process.stdin }).on('line', (line) => {
    const message = JSON.parse(line);
    if (message.type === 'control_request' && message.request.subtype === 'initialize') {
      out({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: {} } });
    } else if (message.type === 'control_request' && message.request.subtype === 'interrupt') {
      out({ type: 'user', message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } });
      out({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0 });
    } else if (message.type === 'control_response' && pending) {
      const { toolId, then } = pending;
      const answer = message.response.response;
      pending = null;
      out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: toolId, content: answer.behavior === 'allow' ? 'ok' : 'denied', is_error: answer.behavior !== 'allow' } ] } });
      then(answer);
    } else if (message.type === 'user') {
      const content = message.message.content;
      const blocks = Array.isArray(content) ? content : [];
      const images = blocks.filter((block) => block.type === 'image').length;
      const words = Array.isArray(content) ? blocks.filter((block) => block.type === 'text').map((block) => block.text).join(' ') : String(content);
      const text = images > 0 ? `${words} (${images} image)` : words;
      out({ type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-test' });
      out({ type: 'system', subtype: 'status', status: 'requesting' });
      if (text.includes('edit')) askTool('Write', { file_path: `${process.cwd()}/notes.txt`, content: 'hello\n' }, (answer) => reply(answer.behavior === 'allow' ? 'I wrote **notes.txt**.' : 'Okay, I left it.'));
      else if (text.includes('ask')) askTool('AskUserQuestion', { questions: [{ question: 'Red or Blue?', header: 'Color', multiSelect: false, options: [{ label: 'Red', description: '' }, { label: 'Blue', description: '' }] }] }, (answer) => reply(`You picked ${answer.updatedInput.answers['Red or Blue?']}.`));
      else if (!text.includes('slow')) reply(`Hello from fake Claude. You said: ${text}`);
    }
  });
}
