import { describe, expect, test } from 'vitest';
import { EventEmitter } from 'events';
import type readline from 'readline';
import { FlowrConfig } from '../../../../src/config';
import { type GhostHintIO, ghostHintClearSequence, ghostHintEnabled, installGhostHint, ghostHintShowSequence } from '../../../../src/cli/repl/ghost-hint';
import { completionSuggestion, replCompleter } from '../../../../src/cli/repl/core';
import { label } from '../../_helper/label';

describe('REPL ghost hint', () => {
	const tty = { isTTY: true };
	const notTty = { isTTY: false };
	const config = (hints: boolean) => FlowrConfig.amend(FlowrConfig.default(), c => {
		c.repl.hints = hints;
	});

	function harness(columns = 200, suggest?: (line: string) => string) {
		const stdin = Object.assign(new EventEmitter(), { isTTY: true });
		const writes: string[] = [];
		const stdout = { isTTY: true, columns, write: (s: string) => (writes.push(s), true) };
		const rl = { line: '' };
		const cfg = config(true);
		const controller = installGhostHint(rl as unknown as readline.Interface, cfg, { hint: 'HINT', suggest }, { stdin, stdout } as unknown as GhostHintIO);
		return { stdin, writes, rl, controller, cfg };
	}

	test(label('is enabled only on an interactive, color-capable terminal with hints on', [], ['other']), () => {
		expect(ghostHintEnabled(config(true), {}, tty, tty)).toBe(true);
		expect(ghostHintEnabled(config(false), {}, tty, tty)).toBe(false);
		expect(ghostHintEnabled(config(true), {}, notTty, tty)).toBe(false);
		expect(ghostHintEnabled(config(true), {}, tty, notTty)).toBe(false);
		expect(ghostHintEnabled(config(true), { NO_COLOR: '1' }, tty, tty)).toBe(false);
		expect(ghostHintEnabled(config(true), { TERM: 'dumb' }, tty, tty)).toBe(false);
	});

	test(label('draws dimmed and restores the cursor, clearing to end of line', [], ['other']), () => {
		expect(ghostHintShowSequence('hi')).toBe('\x1b7\x1b[2mhi\x1b[0m\x1b8');
		expect(ghostHintClearSequence).toBe('\x1b[0K');
	});

	test(label('shows on the empty prompt, hides on input, and re-shows when cleared back to empty', [], ['other']), () => {
		const { stdin, writes, rl, controller } = harness();
		controller.show();
		expect(writes.at(-1)).toContain('HINT');

		rl.line = ':';
		stdin.emit('keypress');
		expect(writes.at(-1)).toBe(ghostHintClearSequence);

		rl.line = '';
		stdin.emit('keypress');
		expect(writes.at(-1)).toContain('HINT');
	});

	test(label('erases the hint on submit (Enter) and does not redraw it', [], ['other']), () => {
		const { stdin, writes, controller } = harness();
		controller.show();
		expect(writes.at(-1)).toContain('HINT');
		stdin.emit('keypress', undefined, { name: 'return' });
		expect(writes.at(-1)).toBe(ghostHintClearSequence);
	});

	test(label('previews the best completion inline while typing', [], ['other']), () => {
		const { stdin, writes, rl } = harness(200, line => line === ':que' ? 'ry ' : '');
		rl.line = ':que';
		stdin.emit('keypress');
		expect(writes.at(-1)).toBe(ghostHintShowSequence('ry '));
	});

	test(label('never draws when it would not fit the terminal width', [], ['other']), () => {
		const { writes, controller } = harness(4);
		controller.show();
		expect(writes).toHaveLength(0);
	});

	test(label('stops drawing immediately when hints are turned off in the (mutated) config', [], ['other']), () => {
		const { writes, controller, cfg } = harness();
		(cfg.repl as { hints: boolean }).hints = false;
		controller.show();
		expect(writes).toHaveLength(0);
	});

	test(label('suggests the remaining text of the best completion', [], ['other']), () => {
		const cfg = config(true);
		expect(completionSuggestion(':hel', cfg)).toBe('p ');
		expect(completionSuggestion(':query ', cfg)).toBe('help ');
		expect(completionSuggestion('hel', cfg)).toBe('');
	});

	test(label('Tab offers every matching option and completes only when one remains', [], ['other']), () => {
		const cfg = config(true);
		// ambiguous prefixes keep the full menu instead of committing the first item
		expect(replCompleter(':', cfg)[0].length).toBeGreaterThan(1);
		expect(replCompleter(':', cfg)[0]).toContain(':help ');
		expect(replCompleter(':query ', cfg)[0].length).toBeGreaterThan(1);
		expect(replCompleter(':query ', cfg)[0]).toContain('help ');
		expect(replCompleter('', cfg)[0].length).toBeGreaterThan(1);
		// a unique prefix still resolves to a single completion
		expect(replCompleter(':bench', cfg)).toEqual([[':benchmark '], ':bench']);
	});

	test(label('only code commands suggest a file path argument', [], ['other']), () => {
		const cfg = config(true);
		expect(completionSuggestion(':dataflow ', cfg)).toBe('file://');
		expect(completionSuggestion(':help ', cfg)).toBe('');
		expect(completionSuggestion(':version ', cfg)).toBe('');
	});
});
