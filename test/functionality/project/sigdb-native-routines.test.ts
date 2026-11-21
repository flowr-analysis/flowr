import { afterAll, assert, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../src/project/sigdb/build';
import type { SigNativeRoutineInfo } from '../../../src/project/sigdb/schema';
import { NativeRoutines } from '../../../src/project/sigdb/native-routines';
import { FlowrNamespaceFile } from '../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { cleanupSigTmpDirs, sigdbAnalyzer, sigTmpDir, writeAndOpen, ver } from '../_helper/sigdb';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { ArgProp, CallProp } from '../../../src/dataflow/environments/built-in-props';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { RBinaryOp } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { AstIdMap } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-11-16', generated: 0 };

const { Value, Written, Atomic, Guarded } = ArgProp;

/* shaped like what the tracker's analyzer reports for data.table, writexl and quadprog */
const Natives: SigNativeRoutineInfo[] = [
	{ name:    'Cforder', iface:   '.Call', symbol:  'forder', lang:    'c', file:    'src/forder.c', line:    470, column:  6, endLine: 512, rNames:  ['Cforder'],
		params:  [{ name: 'DT', type: 'SEXP', props: Value | Written }, { name: 'by', type: 'SEXP', props: Value | Written }],
		facts:   ['error:r', 'parallel:openmp', 'memory:malloc'], closed:  true },
	{ name: 'C_lxw_version', iface: '.Call', lang: 'c', file: 'src/write_xlsx.c', line: 214, arity: 0, params: [], facts: [], closed: true, pure: true },
	{ name:   'qpgen2', iface:  '.Fortran', symbol: 'qpgen2_', lang:   'fortran', file:   'src/solve.QP.f', line:   81, arity:  17,
		params: [{ name: 'dmat', props: Value | Written }, { name: 'meq', props: Value }], facts:  [], closed: false },
	{ name:   'wrap__to_snake', iface:  '.Call', lang:   'rust', file:   'src/rust/src/lib.rs', line:   12, arity:  2,
		params: [{ name: 'x', props: Value | Atomic | Guarded }, { name: 'n', props: Value | Guarded }], facts:  ['error:panic'], closed: false,
		guards: { requires: 'is.character(x) && length(x) == 1 && (is.null(n) || is.numeric(n) && length(n) == 1)' } },
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

/** what the decoder gives back for a record: absent optionals stay absent */
function expected(n: SigNativeRoutineInfo): SigNativeRoutineInfo {
	return JSON.parse(JSON.stringify({ ...n, params: n.params ?? [], facts: [...n.facts ?? []].sort(), closed: n.closed ?? false })) as SigNativeRoutineInfo;
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
		const uncontracted = build(Natives, ['1.0'], { contracts: false });
		expect(uncontracted.blobs[uncontracted.pkgs['p']].natives?.every(r => (r[9] ?? -1) < 0)).toBe(true);
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

	/* `fill` is the routine of the tracker's C fixture: it takes `NULL` or a double vector, `draw` only a length one value */
	const routines: SigNativeRoutineInfo[] = [
		{ name: 'fill', iface: '.Call', rNames: ['C_fill'], params: [{ name: 'x', props: Value | Written | Guarded }], closed: true, guards: { requires: 'is.null(x) || is.double(x)' } },
		{ name: 'draw', iface: '.C', params: [{ name: 'n', props: Value | Guarded }], closed: false, guards: { requires: 'length(n) == 1' } },
		{ name: 'version', iface: '.Call', rNames: ['C_version'], params: [], closed: true, pure: true },
		{ name: 'log', iface: '.Call', rNames: ['C_log'], params: [], closed: true, facts: ['io:file'] },
		{ name: 'sort', iface: '.Call', rNames: ['C_sort'], params: [{ name: 'x', props: Value }], closed: true, facts: ['parallel:openmp'] }
	];
	/** per function, bound by `name <- function`, the assignment being the parent of the definition, what `of` answers for its id */
	function byName<T, R>(answer: Readonly<Record<string, T>>, idMap: AstIdMap, of: (t: T) => R): Record<string, R> {
		return Object.fromEntries(Object.entries(answer).map(([id, t]): [string, R] => {
			const assignment = idMap.get(idMap.get(NodeId.normalize(id))?.info.parent ?? '');
			return [RBinaryOp.is(assignment) ? String(assignment.lhs.lexeme) : id, of(t)];
		}));
	}
	async function guardsOf(code: string, natives?: readonly SigNativeRoutineInfo[]): Promise<Record<string, { requires: string, pure: string }>> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest({ request: 'text', content: code });
		const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards', natives }]))['inspect-fn-guards'];
		return byName(guards, (await analyzer.normalize()).idMap, g => ({ requires: g.requires, pure: g.pure }));
	}
	test(label('a call of a routine asks what the routine does, and so does a call of the function calling it', ['function-calls'], ['dataflow']), async() => {
		const code = 'f <- function(x) .Call(C_fill, x)\ng <- function(y) f(y)\nh <- function(m) .C("draw", n = m, PACKAGE = "p")\nk <- function(z) .Call(C_other, z)';
		const guards = await guardsOf(code, routines);
		assert.strictEqual(guards['f']?.requires, 'is.null(x) || is.double(x)');
		assert.strictEqual(guards['g']?.requires, 'is.null(y) || is.double(y)', 'transitively');
		assert.strictEqual(guards['h']?.requires, 'length(m) == 1', 'PACKAGE is no argument of the routine');
		assert.isUndefined(guards['k'], 'a routine the database does not know asks nothing');
		assert.isUndefined((await guardsOf(code))['f'], 'without the routines flowR cannot know');
	});
	test(label('a function calling only pure code is pure, one reaching a routine running threads is concurrent', ['function-calls'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest({ request: 'text', content: 'v <- function() .Call(C_version)\np <- function(x) { y <- x + 1; if(y > 2) stop("big"); v() }\nl <- function() .Call(C_log)\ns <- function(x) .Call(C_sort, x)\nt <- function(x) s(x)\nw <- function(x) print(x)' });
		const props = async(natives?: readonly SigNativeRoutineInfo[]): Promise<Record<string, number>> => {
			const { props } = (await analyzer.query([{ type: 'inspect-fn-props', only: 'function', natives }]))['inspect-fn-props'];
			return byName(props, (await analyzer.normalize()).idMap, p => p.props ?? 0);
		};
		const known = await props(routines);
		assert.ok(known['v'] & CallProp.Pure, 'the routine is pure');
		assert.notOk(known['v'] & CallProp.Ffi, 'so the foreign call has no effect');
		assert.ok(known['p'] & CallProp.Pure, 'local bindings, branches and failing are pure, and so is what it calls');
		assert.notOk(known['l'] & CallProp.Pure, 'the routine writes a file');
		assert.ok(known['s'] & CallProp.Concurrent, 'the routine runs OpenMP');
		assert.ok(known['t'] & CallProp.Concurrent, 'and so does a function calling it');
		assert.notOk(known['w'] & CallProp.Pure, 'printing is an effect');
		const unknown = await props();
		assert.notOk(unknown['v'] & CallProp.Pure, 'without the routines a foreign call may do anything');
		assert.notOk(unknown['s'] & CallProp.Concurrent);
	});
	test(label('a package the database knows gets its routines without being handed them', ['function-calls'], ['dataflow']), async() => {
		const db = await writeAndOpen(sigTmpDir('sigdb-natives-project-'), build(routines, ['1.0']));
		const analyzer = await sigdbAnalyzer(parser, db);
		analyzer.addFile(new FlowrInlineTextFile('DESCRIPTION', 'Package: p\nVersion: 1.0\n'));
		analyzer.addRequest({ request: 'text', content: 'f <- function(x) .Call(C_fill, x)\nv <- function() .Call(C_version)' });
		const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards' }]))['inspect-fn-guards'];
		assert.include(Object.values(guards).map(g => g.requires), 'is.null(x) || is.double(x)');
		const { props } = (await analyzer.query([{ type: 'inspect-fn-props', only: 'function' }]))['inspect-fn-props'];
		assert.isTrue(Object.values(props).some(p => ((p.props ?? 0) & CallProp.Pure) !== 0), 'the pure routine makes its wrapper pure');
		db.close();
	});
	test(label('a call of a pure routine runs nothing before a check', ['function-calls'], ['dataflow']), async() => {
		const guards = await guardsOf('p <- function(a) { .Call(C_version); stopifnot(is.numeric(a)) }\nq <- function(a) { .Call(C_log); stopifnot(is.numeric(a)) }', routines);
		assert.strictEqual(guards['p']?.pure, 'is.numeric(a)');
		assert.strictEqual(guards['q']?.pure, '', 'the other routine writes a file first');
	});
}));
