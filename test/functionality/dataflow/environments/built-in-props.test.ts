import { assert, describe, test } from 'vitest';
import type { DecodedFunction } from '../../../../src/project/sigdb/decode';
import type { PackageSignatureSource } from '../../../../src/project/sigdb/reader';
import type { BuiltInDefinitions, BuiltInFunctionDefinition } from '../../../../src/dataflow/environments/built-in-config';
import { getDefaultBuiltInDefinitions } from '../../../../src/dataflow/environments/built-in-config';
import type { BuiltInFnInfo, CallProps } from '../../../../src/dataflow/environments/built-in-props';
import {
	ArgProp,
	CallProp,
	ExclusiveCallProps,
	FnSig,
	fnInfoFromSignature,
	InputProps
} from '../../../../src/dataflow/environments/built-in-props';
import { builtInNames, BuiltInIndex, inferFnProps, queryFnProps } from '../../../../src/dataflow/environments/query-fn-props';
import { DefaultBuiltinConfig, WrittenBuiltinDefinitions } from '../../../../src/dataflow/environments/default-builtin-config';
import { Identifier, PkgName } from '../../../../src/dataflow/environments/identifier';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { defaultEnv } from '../../_helper/dataflow/environment-builder';
import { label } from '../../_helper/label';
import { uniqueArray } from '../../../../src/util/collections/arrays';

/** a handful of definitions to query, so the assertions do not depend on the default configuration */
const TestDefinitions = [
	{ type:      'function', names:     [Identifier.from(['tally', PkgName.Base])], processor: BuiltInProcName.Default,
		config:    { props: CallProp.Pure, sig: [['x', ArgProp.Value], ['...', ArgProp.Value | ArgProp.Forced], ['na.rm', ArgProp.Flag]] } },
	{ type:      'function', names:     [Identifier.from(['fetch', PkgName.Base])], processor: BuiltInProcName.Default,
		config:    { props: CallProp.Network | CallProp.Writes, sig: [['url', ArgProp.Resource]] } },
	{ type: 'function', names: [Identifier.from(['plain', PkgName.Base])], processor: BuiltInProcName.Default, config: {} },
	{ type: 'replacement', names: [Identifier.from(['dim', PkgName.Base])], suffixes: ['<-'], config: { readIndices: true, props: CallProp.Scope } }
] as const satisfies BuiltInDefinitions;

const TestSig = (TestDefinitions[0] as BuiltInFunctionDefinition<BuiltInProcName.Default>).config?.sig;

/** answers for `base` only, enough to exercise the fallback */
const TestSignatures = {
	functionByName: (pkg: string, name: string) => pkg === 'base' && name === 'known' ? {
		name:      'known',
		line:      1,
		exported:  true,
		props:     ['exported', 'can-throw', 'higher-order'],
		signature: [{ name: 'x', props: ArgProp.Forced | ArgProp.NoDefault }, { name: '...', props: 0 }],
		callees:   ['paste', 'system']
	} satisfies DecodedFunction : undefined,
	transitiveCallees: (pkg: string, name: string) => pkg === 'base' && name === 'known' ? ['paste', 'system'] : undefined
} as unknown as PackageSignatureSource;

/** one instance of each kind of claim the configuration makes, so a name that loses its props shows up */
const ExpectedLabels: readonly (readonly [Identifier, CallProps])[] = [
	[Identifier.from(['sum', PkgName.Base]), CallProp.Pure | CallProp.Generic],
	[Identifier.from(['nchar', PkgName.Base]), CallProp.Pure | CallProp.Narrows],
	[Identifier.from(['lapply', PkgName.Base]), CallProp.MayPure],
	[Identifier.from(['print', PkgName.Base]), CallProp.Invisible | CallProp.Generic | CallProp.Prints],
	[Identifier.from(['stop', PkgName.Base]), CallProp.Throws],
	[Identifier.from(['rm', PkgName.Base]), CallProp.Invisible | CallProp.Scope],
	[Identifier.from(['set.seed', PkgName.Base]), CallProp.Invisible | CallProp.Random | CallProp.Configures],
	[Identifier.from(['png', PkgName.GrDevices]), CallProp.Invisible | CallProp.Graphics | CallProp.File | CallProp.Writes]
];

/** and the shapes a signature comes in */
const ExpectedSigs: readonly (readonly [Identifier, FnSig])[] = [
	[Identifier.from(['+', PkgName.Base]), [['e1', ArgProp.Value | ArgProp.Atomic], ['e2', ArgProp.Value | ArgProp.Atomic]]],
	[Identifier.from(['sum', PkgName.Base]), [['...', ArgProp.Value]]],
	[Identifier.from(['missing', PkgName.Base]), [['x', ArgProp.Presence]]],
	/* `Alias` is what states the argument handed back, so these have to keep declaring it */
	[Identifier.from(['identity', PkgName.Base]), [['x', ArgProp.Alias | ArgProp.Forced]]],
	[Identifier.from(['match.arg', PkgName.Base]), [['arg', ArgProp.Value], ['choices', ArgProp.Bounds]]],
	[Identifier.from(['read.csv', PkgName.Utils]), [['file', ArgProp.Resource], ['header', ArgProp.Flag], ['sep', ArgProp.Value],
		['quote', ArgProp.Value], ['dec', ArgProp.Value], ['fill', ArgProp.Flag], ['comment.char', ArgProp.Value], ['...', ArgProp.Value]]]
];

describe('Built-in properties', () => {
	describe('Signature layout', () => {
		test(label('resolves the declared positions', ['name-normal'], ['other']), () => {
			const layout = FnSig.layout(TestSig as NonNullable<typeof TestSig>);
			assert.strictEqual(FnSig.propAt(layout, 0), ArgProp.Value);
			assert.strictEqual(layout.rest, 1);
			assert.strictEqual(layout.alias, -1);
		});
		test(label('`...` covers every position from where it appears', ['name-normal'], ['other']), () => {
			const layout = FnSig.layout(TestSig as NonNullable<typeof TestSig>);
			/* the `na.rm` entry sits behind the `...`, so it is never matched by position */
			for(const i of [1, 2, 7]) {
				assert.strictEqual(FnSig.propAt(layout, i), ArgProp.Value | ArgProp.Forced, `argument ${i}`);
			}
			assert.deepStrictEqual(FnSig.posWith(layout, 4, ArgProp.Forced), [1, 2, 3]);
			assert.deepStrictEqual(FnSig.posWith(layout, 4, ArgProp.Alias), []);
		});
		test(label('an undeclared position states nothing', ['name-normal'], ['other']), () => {
			assert.strictEqual(FnSig.propAt(FnSig.layout([['x', ArgProp.Value]]), 3), 0);
		});
		test(label('the layout is cached per signature object', ['name-normal'], ['other']), () => {
			const sig = TestSig as NonNullable<typeof TestSig>;
			assert.strictEqual(FnSig.layout(sig), FnSig.layout(sig));
		});
	});

	describe('Querying the definitions', () => {
		const custom = BuiltInIndex.of(TestDefinitions);
		test(label('by the props they carry', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual(custom.with(CallProp.Network).map(Identifier.toString), ['base::fetch']);
			assert.deepStrictEqual(custom.with(CallProp.Pure | CallProp.Scope).map(Identifier.toString),
				['base::tally', 'base::dim<-']);
			assert.deepStrictEqual(custom.withAll(CallProp.Network | CallProp.Writes).map(Identifier.toString), ['base::fetch']);
			assert.deepStrictEqual(custom.withAll(CallProp.Network | CallProp.Pure).map(Identifier.toString), []);
		});
		test(label('by the props they do not carry', ['name-normal'], ['other']), () => {
			/* `plain` states no props at all, so it is in neither answer */
			assert.deepStrictEqual(custom.without(InputProps).map(Identifier.toString),
				['base::tally', 'base::dim<-']);
		});
		test(label('by what an argument is used for', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual(custom.params(ArgProp.Resource),
				[{ call: Identifier.from(['fetch', PkgName.Base]), index: 0, name: 'url', props: ArgProp.Resource }]);
			assert.deepStrictEqual(custom.params(ArgProp.Flag).map(p => p.name), ['na.rm']);
		});
		test(label('a replacement is asked for under its suffixed name', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual(builtInNames(TestDefinitions[3]).map(Identifier.toString), ['base::dim<-']);
		});
		test(label('the default configuration answers for its own entries', ['name-normal'], ['other']), () => {
			const index = BuiltInIndex.default();
			const pure = new Set(index.pure.map(Identifier.toString));
			assert.isTrue(pure.has('base::sum'), 'sum is pure');
			assert.isFalse(pure.has('base::tempfile'), 'tempfile is not');
			assert.isTrue(index.with(CallProp.TempFile).some(i => Identifier.getName(i) === 'tempfile'));
			assert.strictEqual(index.propsOf('nchar'), CallProp.Pure | CallProp.Narrows);
		});
		test(label('the value solver folds what the definitions hand it', ['name-normal'], ['other']), () => {
			const folding = new Set(BuiltInIndex.default().folding.map(Identifier.getName));
			assert.isTrue(folding.has('+'), 'arithmetic is folded');
			assert.isTrue(folding.has('paste'));
			assert.isFalse(folding.has('read.csv'), 'reading a file is not');
		});
		test(label('the registered built-ins answer just as their definitions do', ['name-normal'], ['other']), () => {
			const registered = BuiltInIndex.ofEnvironment(getDefaultBuiltInDefinitions());
			assert.strictEqual(registered.propsOf('nchar'), CallProp.Pure | CallProp.Narrows);
			assert.isTrue(registered.with(CallProp.Process).some(i => Identifier.getName(i) === 'system'));
		});
	});

	describe('Asking for one function', () => {
		test(label('the built-ins state what they know', ['name-normal'], ['other']), () => {
			const info = queryFnProps(Identifier.from(['sum', PkgName.Base]), { builtIns: getDefaultBuiltInDefinitions() });
			assert.isDefined(info);
			assert.strictEqual((info?.props ?? 0) & CallProp.Pure, CallProp.Pure);
		});
		test(label('a name nobody knows has no answer', ['name-normal'], ['other']), () => {
			assert.isUndefined(queryFnProps('nobodyKnowsMe', { builtIns: getDefaultBuiltInDefinitions() }));
		});
		test(label('resolving in an environment finds the built-in', ['name-normal'], ['other']), () => {
			const info = queryFnProps('nchar', { environment: defaultEnv() });
			assert.strictEqual((info?.props ?? 0) & CallProp.Pure, CallProp.Pure);
			assert.deepStrictEqual(info?.sig, [['x', ArgProp.Shape], ['type', ArgProp.Value], ['allowNA', ArgProp.Flag], ['keepNA', ArgProp.Flag]]);
		});
		test(label('a definition in the code shadows the built-in', ['name-normal', 'normal-definition'], ['other']), () => {
			const env = defaultEnv().defineFunction('nchar', '0', '0');
			assert.isUndefined(queryFnProps('nchar', { environment: env }));
		});
	});

	describe('Falling back to the signature database', () => {
		test(label('it fills in the parameters and the properties it knows', ['name-normal'], ['other']), () => {
			const info = queryFnProps(Identifier.from(['known', PkgName.Base]), { signatures: TestSignatures });
			assert.deepStrictEqual(info?.sig, [['x', ArgProp.Forced | ArgProp.NoDefault], ['...', 0]]);
			assert.strictEqual(info?.props, CallProp.Throws | CallProp.Process,
				'can-throw is read off, `system` carries over, exported and higher-order have no counterpart');
		});
		test(label('what the built-ins state wins, the rest is filled up', ['name-normal'], ['other']), () => {
			const info = queryFnProps(Identifier.from(['known', PkgName.Base]), {
				builtIns:   getBuiltIns([['known', CallProp.Pure]]),
				signatures: TestSignatures
			});
			assert.deepStrictEqual(info?.sig, [['y', ArgProp.Value]], 'the declared signature is kept');
			assert.strictEqual(info?.props, CallProp.Pure | CallProp.Throws | CallProp.Process,
				'the properties are joined');
		});
		test(label('a name the database does not have is left alone', ['name-normal'], ['other']), () => {
			assert.isUndefined(queryFnProps(Identifier.from(['unknown', PkgName.Base]), { signatures: TestSignatures }));
		});
		test(label('a bare name has no package to ask for', ['name-normal'], ['other']), () => {
			assert.isUndefined(queryFnProps('known', { signatures: TestSignatures }));
		});
	});

	describe('What the configuration states', () => {
		const builtIns = getDefaultBuiltInDefinitions();
		test.each(ExpectedLabels.map(([id, props]) => [Identifier.toString(id), id, props] as const))(
			'%s', (_name, id, props) => {
				assert.strictEqual(queryFnProps(id, { builtIns })?.props, props);
			});
		test.each(ExpectedSigs.map(([id, sig]) => [Identifier.toString(id), id, sig] as const))(
			'signature of %s', (_name, id, sig) => {
				assert.deepStrictEqual(queryFnProps(id, { builtIns })?.sig, sig);
			});
	});

	describe('The configuration stays consistent', () => {
		const withInfo = DefaultBuiltinConfig
			.flatMap(d => {
				const info = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config : undefined;
				return info?.props === undefined && info?.sig === undefined ? [] : [[builtInNames(d), info] as const];
			});
		test(label('nothing is pure and an input at the same time', ['name-normal'], ['other']), () => {
			for(const [names, { props = 0 }] of withInfo) {
				assert.strictEqual(props & (CallProp.Pure | CallProp.MayPure) && props & InputProps, 0,
					`${names.map(Identifier.toString).join(', ')} claims both`);
			}
		});
		test(label('no entry states two props that rule each other out', ['name-normal'], ['other']), () => {
			for(const [names, { props = 0 }] of withInfo) {
				for(const [bit, forbidden] of ExclusiveCallProps) {
					if((props & bit) !== 0) {
						assert.strictEqual(props & forbidden, 0,
							`${names.map(Identifier.toString).join(', ')} states ${CallProp[bit]} together with what it rules out`);
					}
				}
			}
		});
		test(label('a named resource comes with an effect that uses it', ['name-normal'], ['other']), () => {
			const uses = CallProp.File | CallProp.TempFile | CallProp.Network | CallProp.Process | CallProp.Reads | CallProp.Writes;
			for(const [names, { props = 0, sig = [] }] of withInfo) {
				if(sig.some(([, p]) => (p & ArgProp.Resource) !== 0)) {
					assert.notStrictEqual(props & uses, 0, `${names.map(Identifier.toString).join(', ')} names a resource but does nothing with it`);
				}
			}
		});
		test(label('a signature names each parameter once, with at most one `...`', ['name-normal'], ['other']), () => {
			for(const [names, { sig = [] }] of withInfo) {
				const declared = sig.map(([n]) => n);
				assert.deepStrictEqual(declared, uniqueArray(declared), `${names.map(Identifier.toString).join(', ')} repeats a parameter`);
				assert.isAtMost(declared.filter(n => n === '...').length, 1, `${names.map(Identifier.toString).join(', ')} has two dots`);
			}
		});
		test(label('touching a file says in which direction', ['name-normal'], ['other']), () => {
			for(const [names, { props = 0 }] of withInfo) {
				if((props & CallProp.File) !== 0) {
					assert.notStrictEqual(props & (CallProp.Reads | CallProp.Writes), 0,
						`${names.map(Identifier.toString).join(', ')} touches a file but states neither Reads nor Writes`);
				}
			}
		});
		test(label('redefining a name does not drop its signature', ['name-normal'], ['other']), () => {
			const declared = new Set<string>();
			for(const d of DefaultBuiltinConfig) {
				if(d.type === 'constant') {
					continue;
				}
				const info = (d as { config?: BuiltInFnInfo }).config;
				for(const n of builtInNames(d)) {
					const name = Identifier.getName(n);
					if(info?.sig !== undefined) {
						declared.add(name);
					} else {
						assert.isFalse(declared.has(name), `${name} is redefined without the signature it had before`);
					}
				}
			}
		});
	});

	describe('Labeling the generics', () => {
		const written = new Map(WrittenBuiltinDefinitions.flatMap(d => builtInNames(d).map(n => [Identifier.toString(n), d] as const)));
		const registered = new Map(DefaultBuiltinConfig.flatMap(d => builtInNames(d).map(n => [Identifier.toString(n), d] as const)));
		test(label('every definition stays registered', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual([...registered.keys()].sort(), [...written.keys()].sort());
		});
		test(label('nothing but the `Generic` bit changes', ['name-normal'], ['other']), () => {
			for(const [name, def] of registered) {
				const before = written.get(name) as typeof def;
				const info = (d: typeof def) => (d as { config?: BuiltInFnInfo }).config;
				assert.deepStrictEqual({ ...info(def), props: undefined }, { ...info(before), props: undefined }, name);
				assert.deepStrictEqual((def as { processor?: string }).processor, (before as { processor?: string }).processor, name);
				assert.deepStrictEqual((def as { evalHandler?: string }).evalHandler, (before as { evalHandler?: string }).evalHandler, name);
				const gained = (info(def)?.props ?? 0) & ~(info(before)?.props ?? 0);
				assert.strictEqual(gained & ~CallProp.Generic, 0, `${name} gained more than \`Generic\``);
				assert.strictEqual((info(before)?.props ?? 0) & ~(info(def)?.props ?? 0), 0, `${name} lost a property`);
			}
		});
	});

	describe('Reading a signature-database entry', () => {
		test(label('what a package function calls carries over to it', ['name-normal'], ['other']), () => {
			const info = inferFnProps(TestSignatures, 'base', 'known');
			/* `system` runs a command, `paste` is pure and hands nothing on */
			assert.strictEqual(info?.props, CallProp.Throws | CallProp.Process);
		});
		test(label('forced parameters keep their order', ['name-normal'], ['other']), () => {
			const fn = (TestSignatures.functionByName('base', 'known') as DecodedFunction);
			assert.deepStrictEqual(fnInfoFromSignature(fn), {
				sig:   [['x', ArgProp.Forced | ArgProp.NoDefault], ['...', 0]],
				props: CallProp.Throws
			});
		});
	});
});

/** built-ins that define the given names with the given props and a `y` parameter */
function getBuiltIns(names: readonly (readonly [string, CallProp])[]) {
	const builtIns = getDefaultBuiltInDefinitions();
	for(const [name, props] of names) {
		builtIns.registerBuiltInFunctions({
			type:      'function',
			names:     [Identifier.from([name, PkgName.Base])],
			processor: BuiltInProcName.Default,
			config:    { props, sig: [['y', ArgProp.Value]] }
		});
	}
	return builtIns;
}
