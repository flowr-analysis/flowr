import { describe, expect, test } from 'vitest';
import { argsOf, matchArgs, parseSpec } from '../../../src/project/sigdb/spec-query';
import { SignatureQueryDefinition } from '../../../src/queries/catalog/signature-query/signature-query-format';

describe('sigdb spec query', () => {
	test('a trailing ... does not count unless named', () => {
		const spec = parseSpec('p*([alias]) [invisible]');
		expect(matchArgs(spec.args ?? [], argsOf('x:alias|forced,...:value|forced'))).toBe(true);
		expect(matchArgs(parseSpec('f([alias],...)').args ?? [], argsOf('x:alias,y'))).toBe(false);
	});
	test('the line parser turns a spec into a flowr query', () => {
		const out = { stdout: () => undefined, stderr: () => undefined, formatter: undefined } as never;
		const { query } = SignatureQueryDefinition.fromLine(out, ['p*([alias])', '[invisible]'], {} as never);
		expect(query).toEqual([{ type: 'signature', package: '*', flowr: 'p*([alias]) [invisible]' }]);
	});
});
