import { assert, describe, test } from 'vitest';
import { SupportedQueries } from '../../../../../src/queries/query';
import { assertReplCompletions, assertReplParser, discardingReplOutput } from '../../../_helper/repl';
import { FlowrConfig } from '../../../../../src/config';
import { replCompleter } from '../../../../../src/cli/repl/core';
import { queryCommand } from '../../../../../src/cli/repl/commands/repl-query';

describe('Config Query REPL Parser', () => {
	const parser = SupportedQueries['config'].fromLine;
	/** the parser rejects `line`, printing an error containing `contains` and producing no query (so nothing runs) */
	function rejects(label: string, line: string[], contains: string) {
		test(label, () => {
			const printed: string[] = [];
			const parsed = parser({ ...discardingReplOutput, stdout: s => printed.push(s) }, line, FlowrConfig.default());
			assert.isUndefined(parsed.query, `expected no query, got ${JSON.stringify(parsed.query)}`);
			assert.include(printed.join('\n'), contains);
		});
	}
	assertReplParser({ parser,
		label:         'empty line',
		line:          [],
		expectedParse: {
			query: [{
				type: 'config',
			}],
		},
	});
	rejects('incomplete line shows the syntax hint', ['+'], 'Invalid config update syntax');

	/** the paths a glob inspects, in order */
	function inspectsOf(line: string): (readonly string[])[] {
		const parsed = parser(discardingReplOutput, [line], FlowrConfig.default());
		const queries = Array.isArray(parsed.query) ? parsed.query : parsed.query ? [parsed.query] : [];
		return queries.map(q => q.inspect ?? []);
	}

	test('a `**` glob inspects matching keys at any depth', () => {
		assert.deepStrictEqual(inspectsOf('**.enabled'), [['solver', 'sigdb', 'enabled']]);
	});

	test('a `*` glob stays within one segment, `**` spans them', () => {
		const single = inspectsOf('solver.*').map(p => p.join('.'));
		const deep = inspectsOf('solver.**').map(p => p.join('.'));
		assert.include(single, 'solver.sigdb');
		assert.notInclude(single, 'solver.sigdb.enabled', '`*` must not reach into a nested object');
		assert.include(deep, 'solver.sigdb.enabled');
	});

	test('a glob matches within a segment', () => {
		assert.deepStrictEqual(inspectsOf('solver.sigdb.eagerly*').map(p => p.join('.')),
			['solver.sigdb.eagerlyLoad', 'solver.sigdb.eagerlyLoadExports']);
	});

	rejects('a glob matching nothing is reported', ['**.doesNotExist'], 'No config key matches');
	test('a glob offers a schema-known but unset key, shallowest first', () => {
		assert.deepStrictEqual(inspectsOf('**.implicitSources').map(p => p.join('.')), ['project.implicitSources']);
	});
	rejects('setting rejects a glob, it is inspection only', ['+solver.*=true'], 'Unknown config key');
	assertReplParser({ parser,
		label:         'valid update',
		line:          ['+solver.sigdb.downloadRepo=my/repo'],
		expectedParse: {
			query: [{
				type:   'config',
				update: { solver: { sigdb: { downloadRepo: 'my/repo' } } },
			}],
		},
	});
	assertReplParser({ parser,
		label:         'valid boolean update parses the value',
		line:          ['+solver.sigdb.enabled=false'],
		expectedParse: {
			query: [{
				type:   'config',
				update: { solver: { sigdb: { enabled: false } } },
			}],
		},
	});
	rejects('invalid update line (no value)', ['+solver.sigdb.enabled'], 'Invalid config update syntax');
	// an unknown key must be rejected, not silently created (regression: `+si=x` used to set a bogus `si` field)
	rejects('rejects an unknown config key on update', ['+si=x'], 'Unknown config key');
	// a plain path (no `+` sigil) inspects that part of the config
	assertReplParser({ parser,
		label:         'a plain path inspects that part of the config',
		line:          ['solver.sigdb.enabled'],
		expectedParse: { query: [{ type: 'config', inspect: ['solver', 'sigdb', 'enabled'] }] },
	});
	assertReplParser({ parser,
		label:         'a plain section path inspects the whole section',
		line:          ['solver.sigdb'],
		expectedParse: { query: [{ type: 'config', inspect: ['solver', 'sigdb'] }] },
	});
	rejects('rejects an unknown plain path', ['nope'], 'Unknown config key');
	// a value that does not fit the schema type is rejected (boolean field, non-boolean value)
	rejects('rejects a value of the wrong type', ['+solver.sigdb.enabled=x'], 'expects a boolean');
	assertReplParser({ parser,
		label:         'a double-quoted array value parses as JSON',
		line:          ['+project.implicitSources=["s.R"]'],
		expectedParse: { query: [{ type: 'config', update: { project: { implicitSources: ['s.R'] } } }] },
	});
	assertReplParser({ parser,
		label:         'a single-quoted array value is accepted too',
		line:          ["+project.implicitSources=['s.R']"],
		expectedParse: { query: [{ type: 'config', update: { project: { implicitSources: ['s.R'] } } }] },
	});
	assertReplParser({ parser,
		label:         '+reset produces a reset query',
		line:          ['+reset'],
		expectedParse: { query: [{ type: 'config', reset: true }] },
	});
});

describe('Config Query REPL argument parsing', () => {
	test('@config keeps a JSON array value untouched, quotes included', () => {
		const { remaining } = queryCommand.argsParser('@config +project.implicitSources=["s.R"]');
		assert.deepStrictEqual(remaining, ['@config', '+project.implicitSources=["s.R"]']);
	});
	test('@config with no arguments still parses', () => {
		const { remaining } = queryCommand.argsParser('@config');
		assert.deepStrictEqual(remaining, ['@config']);
	});
});

describe('Config Query REPL Completions', () => {
	const completer = SupportedQueries['config'].completer;
	test('empty arguments offer + (labeled) and the inspectable root keys (bare, no ?)', () => {
		const result = completer?.([], true, FlowrConfig.default());
		const completions = result?.completions ?? [];
		assert.strictEqual(completions[0], '+', '+ starts an update and comes first');
		assert.match(result?.labels?.get('+') ?? '', /change config value/, 'the + hint explains it writes the config');
		assert.includeMembers(completions, ['solver', 'linter', 'repl'], 'root keys are offered bare, for inspect');
		assert.isFalse(completions.some(c => c.startsWith('?')), 'the ? sigil is gone');
	});
	/* the completions come from the schema, not from the config value: an unset optional option is offered too */
	assertReplCompletions({ completer,
		label:               'provides completion for a partial root node',
		startingNewArg:      false,
		splitLine:           ['+a'],
		expectedCompletions: ['+abstractInterpretation'],
	});
	/* a fragment with no prefix match falls back to a fuzzy (subsequence) match, so `sg` still tab-completes */
	assertReplCompletions({ completer,
		label:               'fuzzy-completes a key with no prefix match',
		startingNewArg:      false,
		splitLine:           ['+sg'],
		expectedCompletions: ['+specializeConfig'],
	});
	assertReplCompletions({ completer,
		label:               'adds a dot after a full root node',
		startingNewArg:      false,
		splitLine:           ['+repl'],
		expectedCompletions: ['+repl.']
	});
	assertReplCompletions({ completer,
		label:               'all second level nodes, including the ones no default sets',
		startingNewArg:      false,
		splitLine:           ['+repl.'],
		expectedCompletions: ['+repl.quickStats', '+repl.dfProcessorHeat', '+repl.hints', '+repl.plugins', '+repl.autoUseFileProtocol', '+repl.queryStats', '+repl.showPlugins'],
	});
	assertReplCompletions({ completer,
		label:               'provides completion for a partial second level node',
		startingNewArg:      false,
		splitLine:           ['+repl.auto'],
		expectedCompletions: ['+repl.autoUseFileProtocol'],
	});
	// a free-form field completes only up to `=`; its `<type>` is a display-only hint, never inserted on Tab
	assertReplCompletions({ completer,
		label:               'adds an equals sign after a full path of a free-form field',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.downloadRepo'],
		expectedCompletions: ['+solver.sigdb.downloadRepo='],
	});
	test('a free-form value type is shown as a hint, not an inserted completion', () => {
		const c = completer(['+solver.sigdb.downloadRepo='], false, FlowrConfig.default());
		assert.deepEqual(c.completions, []);
		assert.deepEqual(c.hints, ['+solver.sigdb.downloadRepo=<string>']);
	});
	// an unknown key is not a settable leaf, so it must not be completed with a trailing `=`
	assertReplCompletions({ completer,
		label:               'does not append = to an unknown key',
		startingNewArg:      false,
		splitLine:           ['+semantics.s'],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'no completions after equals sign',
		startingNewArg:      false,
		splitLine:           ['+someConfigThing='],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'no completions after config update string',
		startingNewArg:      true,
		splitLine:           ['+someConfigThing', 'abc'],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'offers both booleans for a boolean field',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled'],
		expectedCompletions: ['+solver.sigdb.enabled=true', '+solver.sigdb.enabled=false'],
	});
	assertReplCompletions({ completer,
		label:               'still offers the booleans right after the equals sign',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled='],
		expectedCompletions: ['+solver.sigdb.enabled=true', '+solver.sigdb.enabled=false'],
	});
	assertReplCompletions({ completer,
		label:               'filters the value by what is already typed',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled=t'],
		expectedCompletions: ['+solver.sigdb.enabled=true'],
	});
	assertReplCompletions({ completer,
		label:               'inspecting a boolean field (bare path) never assigns a value',
		startingNewArg:      false,
		splitLine:           ['solver.sigdb.enabled'],
		expectedCompletions: ['solver.sigdb.enabled'],
	});
	assertReplCompletions({ completer,
		label:               'does not re-complete a fully typed boolean value',
		startingNewArg:      false,
		splitLine:           ['+solver.sigdb.enabled=true'],
		expectedCompletions: [],
	});
	assertReplCompletions({ completer,
		label:               'offers an enum member bare (like true/false), stopping once it is fully typed',
		startingNewArg:      false,
		splitLine:           ['+solver.variables='],
		expectedCompletions: ['+solver.variables=disabled', '+solver.variables=alias', '+solver.variables=builtin'],
	});
	assertReplCompletions({ completer,
		label:               'does not re-complete a fully typed enum value',
		startingNewArg:      false,
		splitLine:           ['+solver.variables=disabled'],
		expectedCompletions: [],
	});
});

describe('Config Query REPL completion', () => {
	/* the repl filters a completer's output against the typed fragment, so this must be tested through replCompleter */
	function completionsFor(line: string): string[] {
		const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
		return replCompleter(line, FlowrConfig.default())[0].map(c => c.replace(ansi, '').split('  ')[0]);
	}

	test('a glob completes to the keys it matches, which share no prefix with it', () => {
		assert.deepStrictEqual(completionsFor(':query @config **.enab'), ['solver.sigdb.enabled']);
	});

	test('a `*` glob completes to direct children only', () => {
		const got = completionsFor(':query @config solver.*');
		assert.include(got, 'solver.sigdb');
		assert.notInclude(got, 'solver.sigdb.enabled');
	});

	test('a glob matching nothing completes to nothing', () => {
		assert.isEmpty(completionsFor(':query @config **.doesNotExist'));
	});

	test('setting does not expand a glob', () => {
		assert.isEmpty(completionsFor(':query @config +solver.*'));
	});

	test('a pattern-keyed section completes to its permitted keys', () => {
		assert.deepStrictEqual(completionsFor(':query @config specializeConfig.pack'), ['specializeConfig.package']);
	});

	test('a plain path still completes by prefix', () => {
		assert.deepStrictEqual(completionsFor(':query @config solver.sigdb.enab'), ['solver.sigdb.enabled']);
	});
});
