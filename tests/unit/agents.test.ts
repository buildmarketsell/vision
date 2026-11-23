import { describe, expect, it } from 'vitest';
import {
  agentMood,
  applyAgentChange,
  agentSystemPrompt,
  faceFromName,
  FACE_COLOURS,
  FACE_SHAPES,
  newAgent,
  normalizeAgents,
  trustFlags,
  waitingCount,
  type Agent,
} from '../../src/shared/agents';
import { applyRoutineInput, describeSchedule, dueRoutines, nextRunAt, normalizeRoutines, type Routine } from '../../src/shared/routines';

const base = (): Agent => newAgent({ name: 'Nurve', job: 'Runs the Nurve store ads.', folder: '/Users/dan/BUSINESS OS' }, 'a1', 'aaaaaaaa-1111-4222-8333-444444444444', 1000);

describe('agents', () => {
  it('a new agent starts at Auto trust, Claude Code default model, unpinned, with a face from its name', () => {
    const agent = base();
    expect(agent).toMatchObject({ id: 'a1', name: 'Nurve', trust: 'auto', model: 'default', pinned: false, handoffNote: null });
    expect(agent.face).toEqual(faceFromName('Nurve'));
  });

  it('a face from a name is stable and always a real shape and colour', () => {
    for (const name of ['Nurve', 'Kilo', 'Content', 'Life', '', 'ñ']) {
      const face = faceFromName(name);
      expect(face).toEqual(faceFromName(name));
      expect(FACE_SHAPES).toContain(face.shape);
      expect(face.colour).toBeGreaterThanOrEqual(0);
      expect(face.colour).toBeLessThan(FACE_COLOURS.length);
    }
  });

  it('trust levels map onto Claude Code permission flags', () => {
    expect(trustFlags('ask')).toEqual({ mode: 'default', skipPermissions: false });
    expect(trustFlags('edits')).toEqual({ mode: 'acceptEdits', skipPermissions: false });
    expect(trustFlags('auto')).toEqual({ mode: 'auto', skipPermissions: false });
    expect(trustFlags('never')).toEqual({ mode: 'default', skipPermissions: true });
  });

  it('normalizing keeps good agents and drops broken ones, without throwing', () => {
    const good = base();
    const list = normalizeAgents([good, { ...good, id: 'a2', trust: 'bogus', face: { shape: 'nope', colour: 99 } }, { id: 3 }, null, 'x']);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(good);
    expect(list[1]?.trust).toBe('auto');
    expect(list[1]?.face).toEqual(faceFromName('Nurve'));
    expect(normalizeAgents('not a list')).toEqual([]);
  });

  it('normalizing drops agents whose folder is not an absolute path', () => {
    expect(normalizeAgents([{ ...base(), folder: 'relative/path' }])).toEqual([]);
  });

  it('the system prompt carries the name, job and handoff note, and nothing when there is nothing to say', () => {
    const agent = { ...base(), role: 'Ads', handoffNote: 'Campaign A paused; waiting on new creatives.' };
    const prompt = agentSystemPrompt(agent);
    expect(prompt).toContain('You are Nurve');
    expect(prompt).toContain('Runs the Nurve store ads.');
    expect(prompt).toContain('Campaign A paused');
    expect(agentSystemPrompt({ ...base(), job: '', handoffNote: null })).toBe('You are Nurve, one of Dan\'s agents in VISION.');
  });

  it('mood: needs you beats working beats failed beats done (unread reply) beats idle', () => {
    expect(agentMood({ phase: 'working', needsYou: 1, failed: false, unread: false })).toBe('waiting');
    expect(agentMood({ phase: 'working', needsYou: 0, failed: false, unread: true })).toBe('working');
    expect(agentMood({ phase: 'idle', needsYou: 0, failed: true, unread: true })).toBe('failed');
    expect(agentMood({ phase: 'idle', needsYou: 0, failed: false, unread: true })).toBe('done');
    expect(agentMood({ phase: 'off', needsYou: 0, failed: false, unread: false })).toBe('idle');
  });

  it('waiting count adds up every agent that needs Dan', () => {
    expect(waitingCount({ a: { needsYou: 2 }, b: { needsYou: 0 }, c: { needsYou: 1 } })).toBe(3);
  });
});

// 2026-11-23 is a Monday. Local time, like Dan's Mac.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const routine = (change: Partial<Routine> = {}): Routine => ({
  id: 'r1', agentId: 'a1', prompt: 'Check yesterday', repeat: 'daily', time: '09:00', weekday: 1, enabled: true, createdAt: at(22, 12), lastRunAt: null, ...change,
});

describe('routines', () => {
  it('daily runs at the next time of day', () => {
    expect(nextRunAt(routine(), at(23, 8))).toBe(at(23, 9));
    expect(nextRunAt(routine(), at(23, 9))).toBe(at(24, 9));
  });

  it('weekdays skip Saturday and Sunday', () => {
    expect(nextRunAt(routine({ repeat: 'weekdays' }), at(27, 10))).toBe(at(30, 9)); // Friday after 9 → Monday
  });

  it('weekly runs on its weekday', () => {
    expect(nextRunAt(routine({ repeat: 'weekly', weekday: 3 }), at(23, 10))).toBe(at(25, 9)); // Monday → Wednesday
  });

  it('a routine is due once its next run has come, counting from the last run or its creation', () => {
    expect(dueRoutines([routine()], at(23, 8, 59))).toEqual([]);
    expect(dueRoutines([routine()], at(23, 9))).toHaveLength(1);
    expect(dueRoutines([routine({ lastRunAt: at(23, 9) })], at(23, 15))).toEqual([]);
  });

  it('runs missed while VISION was closed fire once, not once per missed day', () => {
    const due = dueRoutines([routine({ lastRunAt: at(10, 9) })], at(23, 15));
    expect(due).toHaveLength(1);
  });

  it('paused routines are never due', () => {
    expect(dueRoutines([routine({ enabled: false })], at(30, 9))).toEqual([]);
  });

  it('describes its schedule in plain words', () => {
    expect(describeSchedule(routine())).toBe('Every day at 09:00');
    expect(describeSchedule(routine({ repeat: 'weekdays' }))).toBe('Weekdays at 09:00');
    expect(describeSchedule(routine({ repeat: 'weekly', weekday: 5 }))).toBe('Fridays at 09:00');
  });

  it('normalizing drops routines with a bad time or no prompt', () => {
    const list = normalizeRoutines([routine(), routine({ id: 'r2', time: '25:00' }), routine({ id: 'r3', prompt: '  ' }), 7]);
    expect(list.map((item) => item.id)).toEqual(['r1']);
  });
});

describe('changes from the window', () => {
  it('an agent change keeps only allowed fields and rejects invalid results', () => {
    const agent = base();
    expect(applyAgentChange(agent, { name: 'Ads', id: 'hijack', sessionId: 'x' })).toMatchObject({ id: 'a1', name: 'Ads', sessionId: agent.sessionId });
    expect(applyAgentChange(agent, { folder: 'relative' })).toBeNull();
    expect(applyAgentChange(agent, { trust: 'never' })?.trust).toBe('never');
  });

  it('a routine input adds a new routine or changes one, and a changed time counts from now', () => {
    const added = applyRoutineInput([], { agentId: 'a1', prompt: 'Check ads', time: '08:30', repeat: 'weekdays' }, 'r9', at(23, 7));
    expect(added).toEqual([expect.objectContaining({ id: 'r9', agentId: 'a1', time: '08:30', repeat: 'weekdays', enabled: true, lastRunAt: null })]);
    const moved = applyRoutineInput(added, { id: 'r9', time: '07:00' }, 'unused', at(23, 7, 30));
    expect(moved[0]?.lastRunAt).toBe(at(23, 7, 30));
    expect(dueRoutines(moved, at(23, 7, 45))).toEqual([]);
    expect(applyRoutineInput(added, { prompt: '' }, 'r10', at(23, 7))).toBe(added);
  });
});
