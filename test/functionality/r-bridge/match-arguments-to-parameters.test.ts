import { MatchArgs } from '../../../src/dataflow/graph/match-args';
import { afterAll, describe, expect, test } from 'vitest';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { SigParameter } from '../../../src/project/sigdb/decode';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import { cleanupSigTmpDirs, expFn, sigTmpDir, ver, writeAndOpen } from '../_helper/sigdb';
import type { FunctionArgument } from '../../../src/dataflow/graph/graph';
import { ArgProp } from '../../../src/dataflow/environments/built-in-props';

/** minimal named argument (`name = value`); only `name.content` is read by the matcher */
const named = (name: string): PotentiallyEmptyRArgument => ({ name: { content: name } } as unknown as PotentiallyEmptyRArgument);
/** minimal positional (unnamed) argument */
const pos = (): PotentiallyEmptyRArgument => ({ name: undefined } as unknown as PotentiallyEmptyRArgument);

const match = (args: readonly PotentiallyEmptyRArgument[], params: readonly string[]) =>
	MatchArgs.toNames(args, params);

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

	test('an empty argument (a(1, , 3)) takes its formal but binds nothing to it', () => {
		const a = pos(), c = pos();
		const m = match([a, EmptyArgument, c], ['x', 'y', 'z']);
		expect(m.get('x')).toBe(a);
		expect(m.get('y')).toBeUndefined();
		expect(m.get('z')).toBe(c);
	});
});

describe('matching against a signature\'s formals', () => {
	test('an exactly matched formal no longer makes a prefix ambiguous', () => {
		const x = named('x'), zz = named('zz1'), xylo = named('xylo'), zz3 = named('zz3');
		const bound = match([x, zz, xylo, zz3], ['xylo', 'xb', '...']);
		expect(bound.get('xylo')).toBe(xylo);
		// `xylo` is taken by name, so `x` prefixes only the still-free `xb`; R binds it there too
		expect(bound.get('xb')).toBe(x);
		expect(bound.get('...')).toBe(zz3);
	});

	test('a prefix that stays ambiguous falls to the dots', () => {
		const x = named('x');
		expect(match([x], ['xylo', 'xb', '...']).get('...')).toBe(x);
	});

	test('keeps `...`, which is what stops positional matching and collects the rest', () => {
		const names = ['x', '...', 'na.rm'];
		const one = pos(), na = named('na');
		const bound = match([one, na], names);
		expect(bound.get('x')).toBe(one);
		expect(bound.get('...')).toBe(na);
	});

	test('feeds the matcher so a call binds to a known signature (pmatch)', () => {
		const params = ['x', 'na.rm'];
		const naArg = named('na');   // unique prefix of `na.rm`
		expect(match([pos(), naArg], params).get('na.rm')).toBe(naArg);
	});
});

describe('MatchArgs.toSpec against a sigdb signature', () => {
	// ggplot(data, mapping, ..., environment) -- the parameters as the signature database records them
	const ggplotSig = [
		{ name: 'data' }, { name: 'mapping' }, { name: '...' }, { name: 'environment' }
	] as unknown as SigParameter[];
	const nArg = (name: string, id: string): FunctionArgument => ({ name, nodeId: id } as unknown as FunctionArgument);
	const pArg = (id: string): FunctionArgument => ({ nodeId: id } as unknown as FunctionArgument);

	test('positional: ggplot(mtcars, aes(x)) -> data = mtcars, mapping = aes', () => {
		const args = [pArg('mtcars'), pArg('aes')];
		expect(MatchArgs.toSpec(args, ggplotSig).get('data')).toEqual(['mtcars']);
		expect(MatchArgs.toSpec(args, ggplotSig).get('mapping')).toEqual(['aes']);
	});

	test('named: ggplot(data = mtcars, aes(x)) -> data by name, aes fills mapping positionally', () => {
		const args = [nArg('data', 'mtcars'), pArg('aes')];
		const m = MatchArgs.toSpec(args, ggplotSig);
		expect(m.get('data')).toEqual(['mtcars']);
		expect(m.get('mapping')).toEqual(['aes']);
	});

	test('pmatch: ggplot(d = mtcars) -> `d` uniquely resolves to data', () => {
		expect(MatchArgs.toSpec([nArg('d', 'mtcars')], ggplotSig).get('data')).toEqual(['mtcars']);
	});

	test('an overflow argument at the `...` position collects into `...`', () => {
		const args = [pArg('mtcars'), pArg('aes'), pArg('extra')];   // data, mapping, then `...`
		expect(MatchArgs.toSpec(args, ggplotSig).get('...')).toEqual(['extra']);
	});
});

describe('matching against a real signature-database signature', () => {
	afterAll(cleanupSigTmpDirs);

	test('reads a function\'s parameters from the sigdb and pmatches a call against them', async() => {
		const dir = sigTmpDir('match-sigdb-');
		const b = new SigDbBuilder();
		b.addPackage('cranpkg', { latest: '1.0.0', downloads: 5 });
		b.addVersion('cranpkg', '1.0.0', ver([{ ...expFn('cranfn'), params: [
			{ name: 'x', props: ArgProp.Forced }, { name: 'na.rm' }, { name: '...' }
		] }]));
		const db = await writeAndOpen(dir, b.build({ date: '2026-05-23', generated: 0 }));
		try {
			const cranfn = db.functions('cranpkg')?.find(f => f.name === 'cranfn');
			expect(cranfn).toBeDefined();
			if(cranfn === undefined) {
				return;
			}
			const params = cranfn.signature.map(p => p.name);
			expect(params).toEqual(['x', 'na.rm', '...']);
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
