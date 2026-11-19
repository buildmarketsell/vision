import { describe, expect, it } from 'vitest';
import { normalizePages, withDescendants, type Block, type Page } from '../../src/shared/pages';
import { createPage, endsList, indentBlock, listNumbers, moveBlock, nextBlockAfter, pagePath, shortcutFor, visibleBlocks } from '../../src/shared/pageOps';

const block = (id: string, type: Block['type'] = 'text', indent = 0, extra: Partial<Block> = {}): Block => ({ id, type, text: id, indent, ...extra });
const ids = (blocks: Block[]) => blocks.map((item) => item.id);
let n = 0;
const page = (id: string, parentId: string | null = null): Page => ({ ...createPage(parentId, () => `x${(n += 1)}`, 1), id });

describe('shortcutFor', () => {
  it('turns Notion markdown into blocks', () => {
    expect(shortcutFor('# ')).toEqual({ type: 'h1', text: '' });
    expect(shortcutFor('## Plan')).toEqual({ type: 'h2', text: 'Plan' });
    expect(shortcutFor('[] buy milk')).toEqual({ type: 'todo', text: 'buy milk' });
    expect(shortcutFor('1. ')).toEqual({ type: 'numbered', text: '' });
    expect(shortcutFor('> ')).toEqual({ type: 'toggle', text: '' });
    expect(shortcutFor('---')).toEqual({ type: 'divider', text: '' });
    expect(shortcutFor('#hashtag ')).toBeNull();
    expect(shortcutFor('hello - world')).toBeNull();
  });
});

describe('Enter', () => {
  it('continues lists, nests inside an open toggle, and ends an empty list item', () => {
    expect(nextBlockAfter(block('a', 'todo', 1))).toEqual({ type: 'todo', indent: 1 });
    expect(nextBlockAfter(block('a', 'toggle', 0, { open: true }))).toEqual({ type: 'text', indent: 1 });
    expect(nextBlockAfter(block('a', 'h1'))).toEqual({ type: 'text', indent: 0 });
    expect(endsList({ ...block('a', 'bullet'), text: '' })).toBe(true);
    expect(endsList(block('a', 'bullet'))).toBe(false);
  });
});

describe('blocks', () => {
  const blocks = [block('t', 'toggle'), block('in1', 'text', 1), block('in2', 'bullet', 2), block('after')];

  it('hides what a closed toggle holds', () => {
    expect(ids(visibleBlocks(blocks))).toEqual(['t', 'after']);
    expect(ids(visibleBlocks([{ ...block('t', 'toggle'), open: true }, ...blocks.slice(1)]))).toEqual(['t', 'in1', 'in2', 'after']);
  });

  it('moves a block with everything nested under it', () => {
    expect(ids(moveBlock(blocks, 't', null))).toEqual(['after', 't', 'in1', 'in2']);
    expect(moveBlock(blocks, 't', 'in2')).toBe(blocks);
  });

  it('indents at most one level deeper than the block above', () => {
    expect(indentBlock(blocks, 'after', 1).at(-1)?.indent).toBe(1);
    expect(indentBlock([block('first')], 'first', 1)[0]?.indent).toBe(0);
  });

  it('numbers lists and restarts after other blocks', () => {
    const list = [block('a', 'numbered'), block('b', 'numbered'), block('c', 'numbered', 1), block('d', 'numbered'), block('x'), block('e', 'numbered')];
    expect([...listNumbers(list).values()]).toEqual([1, 2, 1, 3, 1]);
  });
});

describe('pages', () => {
  const tree = [page('root'), page('child', 'root'), page('grandchild', 'child'), page('other')];

  it('finds a page with everything under it, for deleting', () => {
    expect([...withDescendants(tree, 'root')].sort()).toEqual(['child', 'grandchild', 'root']);
  });

  it('builds the breadcrumb from the top', () => {
    expect(pagePath(tree, 'grandchild').map((item) => item.id)).toEqual(['root', 'child', 'grandchild']);
  });

  it('makes orphans top-level and drops bad covers', () => {
    const [fixed] = normalizePages([{ ...page('lost', 'gone'), cover: 'javascript:alert(1)' }]);
    expect(fixed?.parentId).toBeNull();
    expect(fixed?.cover).toBe('');
  });
});
