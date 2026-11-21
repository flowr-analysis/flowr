import { afterAll, assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { assertLinterPackage } from '../_helper/linter';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';
import { NativeRoutines } from '../../../src/project/sigdb/native-routines';
import type { SigNativeRoutineInfo } from '../../../src/project/sigdb/schema';
import { ArgProp, CallProp } from '../../../src/dataflow/environments/built-in-props';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { RBinaryOp } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';
import { cleanupSigTmpDirs } from '../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const { Value, Guarded } = ArgProp;

/** the wrappers as extendr, savvy, Rcpp and cpp11 emit them, with the NAMESPACE and the routines the database stores */
const Generators = {
	extendr: {
		namespace: 'useDynLib(pkg, .registration = TRUE)\nexport(to_snake, Toml)\n',
		code:      'to_snake <- function(x) .Call(wrap__to_snake, x)\nquiet <- function(x) invisible(.Call(wrap__to_snake, x))\nToml <- new.env(parent = emptyenv())\nToml$insert <- function(self, key) .Call(wrap__Toml__insert, self, key)\nold <- function(x) .Call("wrap__to_snake", x, PACKAGE = "pkg")',
		routines:  [
			{ name: 'wrap__to_snake', iface: '.Call', params: [{ name: 'x', props: Value | Guarded }], closed: true, guards: { requires: 'is.character(x)' } },
			{ name: 'wrap__Toml__insert', iface: '.Call', params: [{ name: 'self', props: Value }, { name: 'key', props: Value | Guarded }], closed: true, guards: { requires: 'is.character(key)' } }
		] as SigNativeRoutineInfo[],
		names:  ['wrap__to_snake', 'wrap__to_snake', 'wrap__Toml__insert', 'wrap__to_snake'],
		guards: { to_snake: 'is.character(x)', quiet: 'is.character(x)', 'Toml$insert': 'is.character(key)', old: 'is.character(x)' }
	},
	savvy: {
		namespace: 'useDynLib(pkg, .registration = TRUE)\nexport(read_font)\n',
		code:      'read_font <- function(path) .Call(savvy_read_font__impl, path)\nFont <- new.env(parent = emptyenv())\nFont$new <- function(n) .Call(savvy_Font_new__impl, n)',
		routines:  [
			{ name: 'savvy_read_font__impl', iface: '.Call', params: [{ name: 'path', props: Value | Guarded }], closed: true, guards: { requires: 'is.character(path)' } },
			{ name: 'savvy_Font_new__impl', iface: '.Call', params: [{ name: 'n', props: Value }], closed: true, pure: true }
		] as SigNativeRoutineInfo[],
		names:  ['savvy_read_font__impl', 'savvy_Font_new__impl'],
		guards: { read_font: 'is.character(path)' }
	},
	rcpp: {
		namespace: 'useDynLib(pkg, .registration = TRUE)\nexport(foo)\nimportFrom(Rcpp, sourceCpp)\n',
		code:      'foo <- function(x) {\n    .Call(`_pkg_foo`, x)\n}\nbar <- function(x) .Call(\'_pkg_foo\', PACKAGE = \'pkg\', x)\nbaz <- function(x) .Call(\'pkg_foo\', x, PACKAGE = \'pkg\')',
		routines:  [{ name: '_pkg_foo', iface: '.Call', rNames: ['_pkg_foo'], params: [{ name: 'x', props: Value | Guarded }], closed: true, guards: { requires: 'is.numeric(x)' } },
			{ name: 'pkg_foo', iface: '.Call', params: [{ name: 'x', props: Value | Guarded }], closed: true, guards: { requires: 'is.numeric(x)' } }] as SigNativeRoutineInfo[],
		names:  ['_pkg_foo', '_pkg_foo', 'pkg_foo'],
		guards: { foo: 'is.numeric(x)', bar: 'is.numeric(x)', baz: 'is.numeric(x)' }
	},
	cpp11: {
		namespace: 'useDynLib(pkg, .registration = TRUE)\nexport(foo)\n',
		code:      'foo <- function(x) {\n  .Call(`_pkg_foo`, x)\n}',
		routines:  [{ name: '_pkg_foo', iface: '.Call', params: [{ name: 'x', props: Value | Guarded }], closed: true, guards: { requires: 'is.numeric(x)' } }] as SigNativeRoutineInfo[],
		names:     ['_pkg_foo'],
		guards:    { foo: 'is.numeric(x)' }
	}
} as const;

describe('Calls of binding generators', withTreeSitter(parser => {
	for(const [tool, g] of Object.entries(Generators)) {
		describe(tool, () => {
			async function setup() {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
				analyzer.addFile(new FlowrInlineTextFile('NAMESPACE', g.namespace));
				analyzer.addRequest({ request: 'text', content: g.code });
				return analyzer;
			}
			test(label('call sites name their routines', ['function-calls'], ['dataflow']), async() => {
				const sites = await NativeRoutines.callSites(await setup());
				assert.deepStrictEqual(sites.map(s => s.name), [...g.names]);
			});
			test(label('routines resolve through the registration', ['function-calls'], ['dataflow']), async() => {
				const analyzer = await setup();
				const dyn = NativeRoutines.dynLibsIn(analyzer.inspectContext());
				const bare = g.routines.map(r => ({ ...r, rNames: undefined }));
				for(const site of await NativeRoutines.callSites(analyzer)) {
					assert.strictEqual(NativeRoutines.resolve(bare, site, dyn)?.name, site.name);
				}
			});
			test(label('contracts and purity reach the wrappers', ['function-calls'], ['dataflow']), async() => {
				const analyzer = await setup();
				const idMap = (await analyzer.normalize()).idMap;
				const nameOf = (id: string) => {
					const a = idMap.get(idMap.get(NodeId.normalize(id))?.info.parent ?? '');
					return RBinaryOp.is(a) ? String(RNode.lexeme(a.lhs)) : id;
				};
				const { guards } = (await analyzer.query([{ type: 'inspect-fn-guards', natives: g.routines }]))['inspect-fn-guards'];
				const guarded = Object.fromEntries(Object.entries(guards).map(([id, v]) => [nameOf(id), v.requires]));
				assert.deepStrictEqual(guarded, g.guards);
				const { props } = (await analyzer.query([{ type: 'inspect-fn-props', only: 'function', natives: g.routines }]))['inspect-fn-props'];
				const byFn = Object.fromEntries(Object.entries(props).map(([id, p]) => [nameOf(id), p.props ?? 0]));
				if(tool === 'savvy') {
					assert.ok(byFn['Font$new'] & CallProp.Pure, 'the pure routine makes its wrapper pure');
				}
			});
		});
	}

	const R = 'undefined-symbol';
	for(const [tool, g] of Object.entries(Generators)) {
		assertLinterPackage(`${tool}: bound routine symbols are defined`, parser, g.code, R, [], { files: { NAMESPACE: g.namespace } });
	}
}));
