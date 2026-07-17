import { assert, describe, test } from 'vitest';
import {
	SharedSliceFlags,
	StaticSliceFlags,
	criteriaQueryCompleter,
	sliceDirectionParser,
	sliceQueryOptionsParser,
	warnAboutSliceFlags
} from '../../../../src/cli/repl/parser/slice-query-parser';
import type { SliceFlag } from '../../../../src/cli/repl/parser/slice-query-parser';
import { DiceQueryDefinition } from '../../../../src/queries/catalog/dice-query/dice-query-format';
import { FlowrConfig } from '../../../../src/config';
import { SliceDirection } from '../../../../src/util/slice-direction';
import { voidFormatter } from '../../../../src/util/text/ansi';
import type { ReplOutput } from '../../../../src/cli/repl/commands/repl-main';

/** everything `warnAboutSliceFlags` prints for the given argument */
function warnedFor(argument: string, flags: readonly SliceFlag[]): string {
	const lines: string[] = [];
	const output = { formatter: voidFormatter, stdout: () => {}, stderr: (m: string) => lines.push(m) } as ReplOutput;
	warnAboutSliceFlags(output, argument, flags);
	return lines.join('\n');
}

/** the flags the completer offers for `argument`, reduced to the flag character it would append */
function offered(argument: string, completer = criteriaQueryCompleter): string[] {
	return completer([argument], false, FlowrConfig.default()).completions.map(c => c.slice(argument.length));
}

/** the flags the dice completer offers, dice shares them with the slice query */
function diceOffered(argument: string): string[] {
	return offered(argument, DiceQueryDefinition.completer);
}

describe('Slice query flags', () => {
	test('the flag suffix yields the shared options', () => {
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)'), {});
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)i'), { inlineSources: true });
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)I'), { inlineFull: true });
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)IB'), { inlineFull: 'banner' });
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)c'), { includeCallees: true });
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)fIBc'),
			{ inlineFull: 'banner', includeCallees: true }, 'the flag order must not matter');
	});

	test('the lowercase b does not request banners', () => {
		assert.deepStrictEqual(sliceQueryOptionsParser('(2@x)Ib'), { inlineFull: true });
	});

	test('only the slice query knows the direction flag', () => {
		assert.strictEqual(sliceDirectionParser('(2@x)fI'), SliceDirection.Forward);
		assert.strictEqual(sliceDirectionParser('(2@x)I'), SliceDirection.Backward);
	});

	test('the flags are offered once the criteria are closed, never twice', () => {
		assert.deepStrictEqual(offered('(2@x)'), ['f', 'i', 'c', 'I', ' '], 'B needs I first');
		assert.deepStrictEqual(offered('(2@x)f'), ['i', 'c', 'I', ' ']);
		assert.deepStrictEqual(offered('(2@x)fc'), ['i', 'I', ' ']);
	});

	test('a space is offered to move on to the code', () => {
		assert.include(offered('(2@x)'), ' ');
		assert.include(offered('(2@x)fiB'), ' ', 'the code may follow any flag');
	});

	test('the banner flag is only offered together with I', () => {
		assert.deepStrictEqual(offered('(2@x)I'), ['f', 'c', 'B', ' ']);
		assert.deepStrictEqual(offered('(2@x)IB'), ['f', 'c', ' ']);
	});

	test('inlining sources and inlining all files are never offered together', () => {
		assert.notInclude(offered('(2@x)i'), 'I', 'iI makes no sense');
		assert.notInclude(offered('(2@x)i'), 'B', 'iB makes no sense either, B needs I');
		assert.notInclude(offered('(2@x)I'), 'i');
	});

	test('an unclosed criterion is completed, not flagged', () => {
		assert.deepStrictEqual(offered('(2'), ['@'], 'the criterion has to be completed first');
	});

	test('an unknown flag is warned about, a known one is not', () => {
		assert.include(warnedFor('(2@x)Z', StaticSliceFlags), '\'Z\'');
		assert.strictEqual(warnedFor('(2@x)fIBc', StaticSliceFlags), '', 'every known flag must stay silent');
		assert.strictEqual(warnedFor('(2@x)', StaticSliceFlags), '');
	});

	test('the warning names every unknown flag once and lists what is known', () => {
		const warned = warnedFor('(2@x)ZZY', StaticSliceFlags);
		assert.strictEqual(warned.match(/'Z'/g)?.length, 1, 'a repeated flag is reported once');
		assert.include(warned, '\'Y\'');
		assert.include(warned, 'slice forward', 'the known flags are listed with their description');
	});

	test('conflicting flags are warned about, as the last one silently wins', () => {
		const warned = warnedFor('(2@x)iI', StaticSliceFlags);
		assert.include(warned, '\'i\'');
		assert.include(warned, '\'I\'');
		assert.strictEqual(warned.split('\n').length, 1, 'the pair is reported once, not from both sides');
	});
});

describe('Dice query flags', () => {
	test('dice offers the shared flags, but not the direction', () => {
		assert.deepStrictEqual(diceOffered('(1@x->2@y)'), ['i', 'c', 'I', ' '], 'a dice fixes both directions, so no f');
		assert.deepStrictEqual(diceOffered('(1@x->2@y)i'), ['c', ' ']);
		assert.deepStrictEqual(diceOffered('(1@x->2@y)I'), ['c', 'B', ' ']);
	});

	test('the dice criteria are completed before the flags', () => {
		assert.deepStrictEqual(diceOffered('(1'), ['@']);
		assert.deepStrictEqual(diceOffered('(1@x'), ['->']);
	});

	test('the direction flag is unknown to a dice, so it warns instead of being ignored', () => {
		const warned = warnedFor('(1@x->2@y)f', SharedSliceFlags);
		assert.include(warned, '\'f\'');
		assert.notInclude(warned, 'slice forward', 'a dice must not advertise the direction flag');
		assert.strictEqual(warnedFor('(1@x->2@y)IBc', SharedSliceFlags), '');
	});
});
