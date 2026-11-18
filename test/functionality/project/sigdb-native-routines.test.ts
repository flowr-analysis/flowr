import { afterAll, assert, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import type { SigNativeRoutineInfo } from '../../../src/project/sigdb/schema';
import { NativeRoutines } from '../../../src/project/sigdb/native-routines';
import { FlowrNamespaceFile } from '../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { cleanupSigTmpDirs, sigTmpDir, writeAndOpen, ver } from '../_helper/sigdb';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-11-16', generated: 0 };

/* shaped like what the tracker's analyzer reports for data.table, writexl and quadprog */
const Natives: SigNativeRoutineInfo[] = [
	{ name:   'Cforder', iface:  '.Call', symbol: 'forder', lang:   'c', file:   'src/forder.c', line:   470, rNames: ['Cforder'],
		params: [{ name: 'DT', type: 'SEXP', read: true, escapes: true }, { name: 'by', type: 'SEXP', read: true, written: true }],
		facts:  ['error:r', 'parallel:openmp', 'memory:malloc'], closed: true },
	{ name: 'C_lxw_version', iface: '.Call', lang: 'c', file: 'src/write_xlsx.c', line: 214, arity: 0, params: [], facts: [], closed: true, pure: true },
	{ name:   'qpgen2', iface:  '.Fortran', symbol: 'qpgen2_', lang:   'fortran', file:   'src/solve.QP.f', line:   81, arity:  17,
		params: [{ name: 'dmat', read: true, written: true, escapes: true }, { name: 'meq', read: true, written: false }], facts:  [], closed: false },
	{ name: 'wrap__to_snake', iface: '.Call', lang: 'rust', file: 'src/rust/src/lib.rs', line: 12, arity: 1, params: [{ name: 'x', read: true, written: false }], facts: ['error:panic'], closed: false },
	{ name: 'ghost', iface: '.Call', arity: 1, undefined: true, closed: false }
];

function build(natives: readonly SigNativeRoutineInfo[] | undefined, versions = ['1.0'], features?: Record<string, boolean>) {
	const b = new SigDbBuilder();
	b.addPackage('p', { latest: versions[versions.length - 1] });
	for(const v of versions) {
		b.addVersion('p', v, natives ? { ...ver([]), natives } : ver([]));
	}
	return b.build(features ? { ...meta, features } : meta);
}

/** what the decoder gives back for a record: every parameter states `read`, absent optionals stay absent */
function expected(n: SigNativeRoutineInfo): SigNativeRoutineInfo {
	return JSON.parse(JSON.stringify({ ...n, params: (n.params ?? []).map(p => ({ ...p, read: p.read ?? false })), facts: [...n.facts ?? []].sort(), closed: n.closed ?? false })) as SigNativeRoutineInfo;
}

describe('Native routines in the signature database', () => {
	test('a version\'s routines round-trip through a written bundle', async() => {
		const rd = await writeAndOpen(sigTmpDir('sigdb-natives-'), build(Natives));
		const read = rd.nativeRoutines('p') ?? [];
		const byName = (xs: readonly SigNativeRoutineInfo[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));
		expect(byName(read).map(r => ({ ...r, facts: [...r.facts ?? []].sort() }))).toEqual(byName(Natives.map(expected)));
		expect(rd.nativeRoutines('nosuchpackage')).toBeUndefined();
		rd.close();
	});

	test('the records pool across versions, and turning the feature off stores none', () => {
		const pooled = build(Natives, ['1.0', '2.0']);
		expect(pooled.blobs[pooled.pkgs['p']].natives).toHaveLength(Natives.length);
		const off = build(Natives, ['1.0'], { natives: false });
		expect(off.blobs[off.pkgs['p']].natives).toBeUndefined();
	});

	test('a bundle without routines answers with none', async() => {
		const rd = await writeAndOpen(sigTmpDir('sigdb-natives-none-'), build(undefined));
		expect(rd.nativeRoutines('p')).toEqual([]);
		rd.close();
	});
});

describe('Linking a foreign function call to its routine', () => {
	const routines = Natives.map(expected);
	test('an R variable is the routine useDynLib binds', () => {
		assert.strictEqual(NativeRoutines.resolve(routines, { name: 'Cforder', symbolic: true, iface: '.Call' })?.symbol, 'forder');
		/* without stored R names, the package's directives say which routine a prefixed name means */
		const bare = routines.map(r => ({ ...r, rNames: undefined }));
		const dyn = [{ library: 'p', registration: true, prefix: 'C_', suffix: '', symbols: [] }];
		assert.strictEqual(NativeRoutines.resolve(bare, { name: 'C_Cforder', symbolic: true }, dyn)?.name, 'Cforder');
		assert.isUndefined(NativeRoutines.resolve(bare, { name: 'C_nothing', symbolic: true }, dyn));
	});
	test('a string is a registered name, then a symbol, also of a Fortran routine', () => {
		assert.strictEqual(NativeRoutines.resolve(routines, { name: 'qpgen2', symbolic: false, iface: '.Fortran' })?.lang, 'fortran');
		assert.strictEqual(NativeRoutines.resolve(routines, { name: 'forder', symbolic: false })?.name, 'Cforder');
		assert.isUndefined(NativeRoutines.resolve(routines, { name: 'nope', symbolic: false }));
	});
	test('a fact is known, known to be absent, or unknown', () => {
		const [forder, version, qp] = ['Cforder', 'C_lxw_version', 'qpgen2'].map(n => routines.find(r => r.name === n));
		assert.isTrue(NativeRoutines.has(forder, 'parallel'));
		assert.isTrue(NativeRoutines.has(forder, 'parallel:openmp'));
		assert.isFalse(NativeRoutines.has(forder, 'rng'), 'closed: everything it calls was seen');
		assert.isUndefined(NativeRoutines.has(version, 'error:r'), 'an R allocation may always raise');
		assert.isUndefined(NativeRoutines.has(qp, 'rng'), 'open: it calls code the analyzer did not see');
		assert.isUndefined(NativeRoutines.has(undefined, 'rng'));
		assert.deepStrictEqual(NativeRoutines.factsOf(forder, 'parallel'), ['parallel:openmp']);
	});
});

describe('useDynLib directives', () => {
	const parse = (content: string) => FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', content)).content().current.dynLibs;
	test(label('registration with fixes, and named symbols', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(parse('useDynLib(dplyr, .registration = TRUE, .fixes = "C_")'),
			[{ library: 'dplyr', registration: true, prefix: 'C_', suffix: '', symbols: [] }]);
		assert.deepStrictEqual(parse('useDynLib(writexl, C_lxw_version)\nuseDynLib(p, short = long_routine_name)'), [
			{ library: 'writexl', registration: false, prefix: '', suffix: '', symbols: [{ rName: 'C_lxw_version', routine: 'C_lxw_version' }] },
			{ library: 'p', registration: false, prefix: '', suffix: '', symbols: [{ rName: 'short', routine: 'long_routine_name' }] }
		]);
		assert.isUndefined(parse('export(a)'));
	});
});

describe('Foreign function call sites', withTreeSitter(parser => {
	test(label('the routine each call names', ['function-calls'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest({ request: 'text', content: 'f <- function(x) .Call(C_foo, x)\ng <- function(y) .C("bar", y, PACKAGE = "p")\nh <- function() { .Call <- function(...) 1; .Call(C_shadowed) }' });
		const sites = await NativeRoutines.callSites(analyzer);
		assert.deepStrictEqual(sites.map(s => [s.iface === undefined ? undefined : String(s.iface), s.name, s.symbolic, s.package]), [['.Call', 'C_foo', true, undefined], ['.C', 'bar', false, 'p']]);
	});
}));
