import { assert, describe, test } from 'vitest';
import { FlowrConfig } from '../../../../../src/config';
import { SupportedQueries } from '../../../../../src/queries/query';
import type { SupportedQueryTypes } from '../../../../../src/queries/query';
import { discardingReplOutput } from '../../../_helper/repl';
import { label } from '../../../_helper/label';

/** The code every parser has to hand on untouched, split the way the repl splits its line. */
const Code = ['x', '<-', '1;', 'print(x)'];
const Joined = Code.join(' ');

/** The tokens each parser consumes before the code starts. */
const Prefixes: Partial<Record<SupportedQueryTypes, readonly string[]>> = {
	'absint':               ['df-shape'],
	'does-call':            ['(1@x:print)'],
	'origin':               ['(1@x)'],
	'input-sources':        ['(1@x)'],
	'provenance':           ['(1@x)'],
	'resolve-value':        ['(1@x)'],
	'static-slice':         ['(1@x)'],
	'dice':                 ['(1@x->1@x)'],
	'location-map':         ['(1@x)'],
	'inspect-exception':    ['(1@x)'],
	'inspect-higher-order': ['(1@x)'],
	'inspect-recursion':    ['(1@x)']
};

/** The parsers reading no criteria at all, which take the code from the very first token. */
const WithoutPrefix: readonly SupportedQueryTypes[] = ['location-map', 'inspect-exception', 'inspect-higher-order', 'inspect-recursion'];

describe('The repl hands every query its complete code', () => {
	for(const [type, query] of Object.entries(SupportedQueries)) {
		const fromLine = (query as { fromLine?: (...args: never[]) => { rCode?: string } }).fromLine;
		const prefix = Prefixes[type as SupportedQueryTypes];
		if(fromLine === undefined || prefix === undefined) {
			continue;
		}
		test(label(`${type} keeps the code`, ['name-normal'], ['other']), () => {
			const parse = (line: readonly string[]) =>
				(fromLine as (o: unknown, l: readonly string[], c: FlowrConfig) => { rCode?: string })(discardingReplOutput, line, FlowrConfig.default());
			assert.strictEqual(parse([...prefix, ...Code]).rCode, Joined, 'with the leading arguments');
			if(WithoutPrefix.includes(type as SupportedQueryTypes)) {
				assert.strictEqual(parse(Code).rCode, Joined, 'without them');
			}
		});
	}
});
