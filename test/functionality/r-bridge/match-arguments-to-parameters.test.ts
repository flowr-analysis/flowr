import { afterAll, describe, expect, test } from 'vitest';
import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { signatureParameterNames, type SigParameter } from '../../../src/project/sigdb/decode';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import { cleanupSigTmpDirs, expFn, sigTmpDir, ver, writeAndOpen } from '../_helper/sigdb';
import { argumentForParameter, matchArgumentsToSignature } from '../../../src/project/sigdb/signature-match';
import type { FunctionArgument } from '../../../src/dataflow/graph/graph';

/** minimal named argument (`name = value`); only `name.content` is read by the matcher */
const named = (name: string): PotentiallyEmptyRArgument => ({ name: { content: name } } as unknown as PotentiallyEmptyRArgument);
/** minimal positional (unnamed) argument */
const pos = (): PotentiallyEmptyRArgument => ({ name: undefined } as unknown as PotentiallyEmptyRArgument);

const match = (args: readonly PotentiallyEmptyRArgument[], params: readonly string[]) =>
	RFunctionCall.matchArgsToParams(args, params);

describe('RFunctionCall.matchArgumentsToParameters (R argument matching)', () => {
	test('exact name match', () => {
		const a = named('foo');
		const m = match([a], ['foo', 'bar']);
		expect(m.get('foo')).toBe(a);
		expect(m.size).toBe(1);
	});

	test('partial (pmatch) match on a unique prefix', () => {
		const a = named('ver');   // unique prefix of `verbose` (not `value`)
		expect(match([a], ['verbose', 'value']).get('verbose')).toBe(a);
	});

	test('an ambiguous prefix is rejected (not matched)', () => {
		const a = named('v');   // prefix of both `verbose` and `value`
		const m = match([a], ['verbose', 'value']);
		expect(m.size).toBe(0);
	});

	test('exact name wins over a partial match to another formal', () => {
		const a = named('a');   // exact-matches `a`, must not pmatch to `ab`
		const m = match([a], ['a', 'ab']);
		expect(m.get('a')).toBe(a);
		expect(m.get('ab')).toBeUndefined();
	});

	test('unnamed arguments fill the remaining formals left-to-right', () => {
		const a = pos(), b = pos();
		const m = match([a, b], ['x', 'y', 'z']);
		expect(m.get('x')).toBe(a);
		expect(m.get('y')).toBe(b);
		expect(m.get('z')).toBeUndefined();
	});

	test('a named match reserves its formal; positional args skip it', () => {
		// f(y = Y, X) with formals (x, y): y is named, X fills the still-free x
		const y = named('y'), x = pos();
		const m = match([y, x], ['x', 'y']);
		expect(m.get('y')).toBe(y);
		expect(m.get('x')).toBe(x);
	});

	test('exact, then pmatch, then positional together', () => {
		// f(col = COL, 1, ver = VER) with formals (color, count, verbose); `co` would be ambiguous (color/count)
		const col = named('col'), one = pos(), ver = named('ver');
		const m = match([col, one, ver], ['color', 'count', 'verbose']);
		expect(m.get('color')).toBe(col);    // pmatch: `col` -> color (unique)
		expect(m.get('verbose')).toBe(ver);  // pmatch: `ver` -> verbose (unique)
		expect(m.get('count')).toBe(one);    // positional fills the remaining formal
	});

	test('a named argument matching no formal stays unbound', () => {
		const m = match([named('nope')], ['x', 'y']);
		expect(m.size).toBe(0);
	});

	test('extra positional arguments beyond the formals stay unbound', () => {
		const a = pos(), b = pos();
		const m = match([a, b], ['x']);
		expect(m.get('x')).toBe(a);
		expect(m.size).toBe(1);
	});

	test('duplicate names bind the first occurrence only', () => {
		const first = named('x'), second = named('x');
		const m = match([first, second], ['x']);
		expect(m.get('x')).toBe(first);
	});

	test('empty arguments (a(1, , 3)) are skipped, not bound to a formal', () => {
		const a = pos(), c = pos();
		const m = match([a, EmptyArgument, c], ['x', 'y', 'z']);
		expect(m.get('x')).toBe(a);
		expect(m.get('y')).toBe(c);
		expect(m.get('z')).toBeUndefined();
	});
});

describe('signatureParameterNames', () => {
	test('excludes the `...` parameter (keeps the rest, in order)', () => {
		const names = signatureParameterNames([
			{ name: 'x', forced: true, optional: false },
			{ name: '...', forced: false, optional: true },
			{ name: 'na.rm', forced: false, optional: true }
		]);
		expect(names).toEqual(['x', 'na.rm']);
	});

	test('feeds the matcher so a call binds to a known signature (pmatch)', () => {
		const params = signatureParameterNames([
			{ name: 'x', forced: true, optional: false },
			{ name: 'na.rm', forced: false, optional: true }
		]);
		const naArg = named('na');   // unique prefix of `na.rm`
		expect(match([pos(), naArg], params).get('na.rm')).toBe(naArg);
	});
});

describe('matchArgumentsToSignature / argumentForParameter (pMatch against a sigdb signature)', () => {
	// ggplot(data, mapping, ..., environment) -- the parameters as the signature database records them
	const ggplotSig = [
		{ name: 'data' }, { name: 'mapping' }, { name: '...' }, { name: 'environment' }
	] as unknown as SigParameter[];
	const nArg = (name: string, id: string): FunctionArgument => ({ name, nodeId: id } as unknown as FunctionArgument);
	const pArg = (id: string): FunctionArgument => ({ nodeId: id } as unknown as FunctionArgument);

	test('positional: ggplot(mtcars, aes(x)) -> data = mtcars, mapping = aes', () => {
		const args = [pArg('mtcars'), pArg('aes')];
		expect(argumentForParameter(args, ggplotSig, 'data')).toEqual(['mtcars']);
		expect(argumentForParameter(args, ggplotSig, 'mapping')).toEqual(['aes']);
	});

	test('named: ggplot(data = mtcars, aes(x)) -> data by name, aes fills mapping positionally', () => {
		const args = [nArg('data', 'mtcars'), pArg('aes')];
		const m = matchArgumentsToSignature(args, ggplotSig);
		expect(m.get('data')).toEqual(['mtcars']);
		expect(m.get('mapping')).toEqual(['aes']);
	});

	test('pmatch: ggplot(d = mtcars) -> `d` uniquely resolves to data', () => {
		expect(argumentForParameter([nArg('d', 'mtcars')], ggplotSig, 'data')).toEqual(['mtcars']);
	});

	test('an overflow argument at the `...` position collects into `...`', () => {
		const args = [pArg('mtcars'), pArg('aes'), pArg('extra')];   // data, mapping, then `...`
		expect(matchArgumentsToSignature(args, ggplotSig).get('...')).toEqual(['extra']);
	});
});

describe('matching against a real signature-database signature', () => {
	afterAll(cleanupSigTmpDirs);

	test('reads a function\'s parameters from the sigdb and pmatches a call against them', async() => {
		const dir = sigTmpDir('match-sigdb-');
		const b = new SigDbBuilder();
		b.addPackage('cranpkg', { latest: '1.0.0', downloads: 5 });
		b.addVersion('cranpkg', '1.0.0', ver([{ ...expFn('cranfn'), params: [
			{ name: 'x', forced: true }, { name: 'na.rm' }, { name: '...' }
		] }]));
		const db = await writeAndOpen(dir, b.build({ date: '2026-05-23', generated: 0 }));
		try {
			const cranfn = db.functions('cranpkg')?.find(f => f.name === 'cranfn');
			expect(cranfn).toBeDefined();
			if(cranfn === undefined) {
				return;
			}
			// the `...` is dropped, the rest survive the round-trip through the database
			const params = signatureParameterNames(cranfn.signature);
			expect(params).toEqual(['x', 'na.rm']);
			// cranfn(1, na = TRUE): positional 1 -> x, `na` pmatches -> na.rm
			const one = pos(), na = named('na');
			const bound = match([one, na], params);
			expect(bound.get('x')).toBe(one);
			expect(bound.get('na.rm')).toBe(na);
		} finally {
			db.close();
		}
	});
});
