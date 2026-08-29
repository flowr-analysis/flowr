import { assert, describe, test } from 'vitest';
import { Fn } from '../../../../src/dataflow/fn/fn';
import type { DecodedFunction } from '../../../../src/project/sigdb/decode';
import type { PackageSignatureSource } from '../../../../src/project/sigdb/reader';
import type { BaseBuiltInDefinition, BuiltInDefinitions, BuiltInFunctionDefinition } from '../../../../src/dataflow/environments/built-in-config';
import { getDefaultBuiltInDefinitions } from '../../../../src/dataflow/environments/built-in-config';
import type { BuiltInFnInfo, StatedProps, CallProps, FnSig } from '../../../../src/dataflow/environments/built-in-props';
import { ArgProp, CallProp, ExclusiveCallProps, fnInfoFromSignature, InputProps, SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';
import { builtInNames, BuiltInIndex, inferFnProps, queryFnProps } from '../../../../src/dataflow/environments/query-fn-props';
import type { BuiltInIdentifierDefinition } from '../../../../src/dataflow/environments/built-in';
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
		config:    { tags: [SemanticCallTag.Network, SemanticCallTag.Writes], sig: [['url', ArgProp.Resource]] } },
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
const ExpectedLabels: readonly (readonly [Identifier, StatedProps])[] = [
	[Identifier.from(['sum', PkgName.Base]), { props: CallProp.Pure | CallProp.Generic }],
	[Identifier.from(['nchar', PkgName.Base]), { props: CallProp.Pure, tags: [SemanticCallTag.Narrows] }],
	[Identifier.from(['lapply', PkgName.Base]), { props: CallProp.MayPure }],
	[Identifier.from(['print', PkgName.Base]), { props: CallProp.Invisible | CallProp.Generic, tags: [SemanticCallTag.Prints] }],
	[Identifier.from(['stop', PkgName.Base]), { props: CallProp.Throws }],
	[Identifier.from(['rm', PkgName.Base]), { props: CallProp.Invisible | CallProp.Scope }],
	[Identifier.from(['set.seed', PkgName.Base]), { props: CallProp.Invisible | CallProp.Configures, tags: [SemanticCallTag.Random] }],
	[Identifier.from(['png', PkgName.GrDevices]), { props: CallProp.Invisible,
		tags:  [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes] }]
];

/** and the shapes a signature comes in */
const ExpectedSigs: readonly (readonly [Identifier, FnSig])[] = [
	[Identifier.from(['+', PkgName.Base]), [['e1', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic], ['e2', ArgProp.Forced | ArgProp.Value | ArgProp.Atomic]]],
	[Identifier.from(['sum', PkgName.Base]), [['...', ArgProp.Forced | ArgProp.Value]]],
	[Identifier.from(['missing', PkgName.Base]), [['x', ArgProp.Presence]]],
	/* `Alias` is what states the argument handed back, so these have to keep declaring it */
	[Identifier.from(['identity', PkgName.Base]), [['x', ArgProp.Alias | ArgProp.Forced]]],
	[Identifier.from(['match.arg', PkgName.Base]), [['arg', ArgProp.Forced | ArgProp.Value], ['choices', ArgProp.Forced | ArgProp.Bounds]]],
	[Identifier.from(['read.csv', PkgName.Utils]), [['file', ArgProp.Forced | ArgProp.Resource], ['header', ArgProp.Forced | ArgProp.Flag],
		['sep', ArgProp.Forced | ArgProp.Value], ['quote', ArgProp.Forced | ArgProp.Value], ['dec', ArgProp.Forced | ArgProp.Value],
		['fill', ArgProp.Forced | ArgProp.Flag], ['comment.char', ArgProp.Forced | ArgProp.Value], ['...', ArgProp.Forced | ArgProp.Value]]]
];

describe('Built-in properties', () => {
	describe('Signature layout', () => {
		test(label('resolves the declared positions, and how `...` covers every position from where it appears', ['name-normal'], ['other']), () => {
			const layout = Fn.call.signature.layout(TestSig as NonNullable<typeof TestSig>);
			assert.strictEqual(Fn.call.signature.propAt(layout, 0), ArgProp.Value);
			assert.strictEqual(layout.rest, 1);
			assert.strictEqual(layout.alias, -1);
			/* the `na.rm` entry sits behind the `...`, so it is never matched by position */
			for(const i of [1, 2, 7]) {
				assert.strictEqual(Fn.call.signature.propAt(layout, i), ArgProp.Value | ArgProp.Forced, `argument ${i}`);
			}
			assert.deepStrictEqual(Fn.call.signature.posWith(layout, 4, ArgProp.Forced), [1, 2, 3]);
			assert.deepStrictEqual(Fn.call.signature.posWith(layout, 4, ArgProp.Alias), []);
			assert.strictEqual(Fn.call.signature.propAt(Fn.call.signature.layout([['x', ArgProp.Value]]), 3), 0, 'an undeclared position states nothing');
		});
		test(label('the layout is cached per signature object', ['name-normal'], ['other']), () => {
			const sig = TestSig as NonNullable<typeof TestSig>;
			assert.strictEqual(Fn.call.signature.layout(sig), Fn.call.signature.layout(sig));
		});
	});

	describe('Querying the definitions', () => {
		const custom = BuiltInIndex.of(TestDefinitions);
		test(label('by the props they carry or lack, by what an argument is used for, and a replacement under its suffixed name', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual(custom.with(SemanticCallTag.Network).map(Identifier.toString), ['base::fetch']);
			assert.deepStrictEqual(custom.with(CallProp.Pure | CallProp.Scope).map(Identifier.toString),
				['base::tally', 'base::dim<-']);
			assert.deepStrictEqual(custom.withAll([SemanticCallTag.Network, SemanticCallTag.Writes]).map(Identifier.toString), ['base::fetch']);
			assert.deepStrictEqual(custom.withAll([SemanticCallTag.Network, CallProp.Pure]).map(Identifier.toString), []);
			/* `plain` states no props at all, so it is in neither answer */
			assert.deepStrictEqual(custom.without(InputProps).map(Identifier.toString),
				['base::tally', 'base::dim<-']);
			assert.deepStrictEqual(custom.params(ArgProp.Resource),
				[{ call: Identifier.from(['fetch', PkgName.Base]), index: 0, name: 'url', props: ArgProp.Resource }]);
			assert.deepStrictEqual(custom.params(ArgProp.Flag).map(p => p.name), ['na.rm']);
			assert.deepStrictEqual(builtInNames(TestDefinitions[3]).map(Identifier.toString), ['base::dim<-']);
		});
		test(label('the default configuration, its folding and its registered form all answer for their own entries', ['name-normal'], ['other']), () => {
			const index = BuiltInIndex.default();
			const pure = new Set(index.pure.map(Identifier.toString));
			assert.isTrue(pure.has('base::sum'), 'sum is pure');
			assert.isFalse(pure.has('base::tempfile'), 'tempfile is not');
			assert.isTrue(index.with(SemanticCallTag.TempFile).some(i => Identifier.getName(i) === 'tempfile'));
			assert.strictEqual(index.propsOf('nchar'), CallProp.Pure);
			assert.deepStrictEqual(index.get('nchar')?.tags, [SemanticCallTag.Narrows]);
			const foldable = new Set(BuiltInIndex.default().foldable.map(Identifier.getName));
			assert.isTrue(foldable.has('+'), 'arithmetic is folded');
			assert.isTrue(foldable.has('paste'));
			assert.isFalse(foldable.has('read.csv'), 'reading a file is not');
			const registered = BuiltInIndex.ofEnvironment(getDefaultBuiltInDefinitions());
			assert.strictEqual(registered.propsOf('nchar'), CallProp.Pure);
			assert.deepStrictEqual(registered.get('nchar')?.tags, [SemanticCallTag.Narrows]);
			assert.isTrue(registered.with(SemanticCallTag.Process).some(i => Identifier.getName(i) === 'system'));
			/* `DBI` is not attached at startup, so it is in the package memory the index walks, not the built-in one */
			const dbGetQuery = BuiltInIndex.default().get(Identifier.from(['dbGetQuery', PkgName.Dbi]));
			assert.deepStrictEqual(dbGetQuery?.tags, [SemanticCallTag.Database]);
			assert.deepStrictEqual(dbGetQuery?.sig, [['conn', ArgProp.Forced | ArgProp.Handle],
				['statement', ArgProp.Forced | ArgProp.Value | ArgProp.Injectable], ['...', ArgProp.Value]]);
		});
	});

	describe('Asking for one function', () => {
		test(label('the built-ins state what they know, an unknown name has no answer', ['name-normal'], ['other']), () => {
			const info = queryFnProps(Identifier.from(['sum', PkgName.Base]), { builtIns: getDefaultBuiltInDefinitions() });
			assert.isDefined(info);
			assert.strictEqual((info?.props ?? 0) & CallProp.Pure, CallProp.Pure);
			assert.isUndefined(queryFnProps('nobodyKnowsMe', { builtIns: getDefaultBuiltInDefinitions() }));
		});
		test(label('resolving in an environment finds the built-in, unless a definition in the code shadows it', ['name-normal', 'normal-definition'], ['other']), () => {
			const info = queryFnProps('nchar', { environment: defaultEnv() });
			assert.strictEqual((info?.props ?? 0) & CallProp.Pure, CallProp.Pure);
			assert.deepStrictEqual(info?.sig, [['x', ArgProp.Forced | ArgProp.Shape], ['type', ArgProp.Forced | ArgProp.Value],
				['allowNA', ArgProp.Forced | ArgProp.Flag], ['keepNA', ArgProp.Forced | ArgProp.Flag]]);
			const env = defaultEnv().defineFunction('nchar', '0', '0');
			assert.isUndefined(queryFnProps('nchar', { environment: env }));
		});
	});

	describe('Falling back to the signature database', () => {
		test(label('it fills in the parameters and properties it knows, and what the built-ins state wins, the rest filled up', ['name-normal'], ['other']), () => {
			const info = queryFnProps(Identifier.from(['known', PkgName.Base]), { signatures: TestSignatures });
			assert.deepStrictEqual(info?.sig, [['x', ArgProp.Forced | ArgProp.NoDefault], ['...', 0]]);
			assert.strictEqual(info?.props, CallProp.Throws, 'can-throw is read off, exported and higher-order have no counterpart');
			assert.deepStrictEqual(info?.tags, [SemanticCallTag.Process], '`system` carries over');
			const merged = queryFnProps(Identifier.from(['known', PkgName.Base]), {
				builtIns:   getBuiltIns([['known', CallProp.Pure]]),
				signatures: TestSignatures
			});
			assert.deepStrictEqual(merged?.sig, [['y', ArgProp.Value]], 'the declared signature is kept');
			assert.strictEqual(merged?.props, CallProp.Pure | CallProp.Throws, 'the properties are joined');
			assert.deepStrictEqual(merged?.tags, [SemanticCallTag.Process], 'the properties are joined');
		});
		test(label('a name the database does not have, or a bare name with no package to ask for, is left alone', ['name-normal'], ['other']), () => {
			assert.isUndefined(queryFnProps(Identifier.from(['unknown', PkgName.Base]), { signatures: TestSignatures }));
			assert.isUndefined(queryFnProps('known', { signatures: TestSignatures }));
		});
	});

	describe('What the configuration states', () => {
		const builtIns = getDefaultBuiltInDefinitions();
		test.each(ExpectedLabels.map(([id, stated]) => [Identifier.toString(id), id, stated] as const))(
			'%s', (_name, id, stated) => {
				const info = queryFnProps(id, { builtIns });
				assert.strictEqual(info?.props ?? 0, stated.props ?? 0);
				assert.deepStrictEqual(info?.tags, stated.tags);
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
				return info === undefined || (!Fn.call.props.hasAny(info) && info.sig === undefined) ? [] : [[builtInNames(d), info] as const];
			});
		test(label('nothing is pure and an input at once, no props rule each other out, resources are used, params are named once, and file direction is stated', ['name-normal'], ['other']), () => {
			const uses = [SemanticCallTag.File, SemanticCallTag.TempFile, SemanticCallTag.Network, SemanticCallTag.Process,
				SemanticCallTag.Reads, SemanticCallTag.Writes];
			for(const [names, info] of withInfo) {
				const who = () => names.map(Identifier.toString).join(', ');
				assert.isFalse(Fn.call.props.hasAny(info, [CallProp.Pure, CallProp.MayPure]) && Fn.call.props.hasAny(info, InputProps), `${who()} claims both`);
				for(const [prop, forbidden] of ExclusiveCallProps) {
					if(Fn.call.props.hasAny(info, prop)) {
						assert.isFalse(Fn.call.props.hasAny(info, forbidden), `${who()} states ${Fn.call.props.names(prop).join(', ')} together with what it rules out`);
					}
				}
				const sig = info.sig ?? [];
				if(sig.some(([, p]) => (p & ArgProp.Resource) !== 0)) {
					assert.isTrue(Fn.call.props.hasAny(info, uses), `${who()} names a resource but does nothing with it`);
				}
				const declared = sig.map(([n]) => n);
				assert.deepStrictEqual(declared, uniqueArray(declared), `${who()} repeats a parameter`);
				assert.isAtMost(declared.filter(n => n === '...').length, 1, `${who()} has two dots`);
				if(Fn.call.props.hasAny(info, SemanticCallTag.File)) {
					assert.isTrue(Fn.call.props.hasAny(info, [SemanticCallTag.Reads, SemanticCallTag.Writes]),
						`${who()} touches a file but states neither Reads nor Writes`);
				}
			}
		});
		/** what a restatement corrects rather than forgets: the name, and the properties it takes back */
		const Corrects: Readonly<Record<string, StatedProps>> = {
			/* drawing rows at random is exactly what makes it impure, so the block it is listed in has it wrong */
			'dplyr::slice_sample': { props: CallProp.Pure }
		};
		test(label('restating a name requires overrides:true only when something came before, and keeps what was already known', ['name-normal'], ['other']), () => {
			/* the last definition of a name is the one that sticks; the ggplot2 addons that got deprecated lost their `Graphics` bit this way */
			const stated = new Map<string, BuiltInFnInfo | undefined>();
			const handlers = new Map<string, string | undefined>();
			const everStated = new Set<string>();
			for(const d of WrittenBuiltinDefinitions) {
				const info = (d as { config?: BuiltInFnInfo }).config;
				const names = builtInNames(d).map(Identifier.toString);
				if((d as BaseBuiltInDefinition).overrides) {
					assert.isTrue(names.some(n => everStated.has(n)), `${names.join(', ')} claims to restate a name nothing states before it`);
				}
				for(const name of names) {
					if(everStated.has(name)) {
						assert.isTrue((d as BaseBuiltInDefinition).overrides,
							`${name} is stated again without \`overrides: true\`, which drops what the earlier entry said`);
					}
					const before = stated.get(name);
					const lostProps = (before?.props ?? 0) & ~(info?.props ?? 0) & ~(Corrects[name]?.props ?? 0);
					assert.strictEqual(lostProps, 0, `restating ${name} drops the properties ${lostProps.toString(2)} it had`);
					const corrected = Corrects[name]?.tags ?? [];
					const lostTags = (before?.tags ?? []).filter(t => !(info?.tags ?? []).includes(t) && !corrected.includes(t));
					assert.deepStrictEqual(lostTags, [], `restating ${name} drops the tags it had`);
					if(before !== undefined) {
						/* the two that decide how a call is read rather than what it does, and are as easy to forget */
						const masked = (c?: BuiltInFnInfo) => (c as { markArgsAsMasked?: unknown })?.markArgsAsMasked;
						assert.deepStrictEqual(masked(info), masked(before), `restating ${name} changes its data mask`);
						assert.strictEqual((d as { evalHandler?: string }).evalHandler, handlers.get(name),
							`restating ${name} drops the value solver it had`);
					}
					handlers.set(name, (d as { evalHandler?: string }).evalHandler);
					stated.set(name, info);
					everStated.add(name);
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
					/* the whole identifier, as `filter` is cohortBuilder's and dplyr's and they share nothing but a name */
					const name = String(n);
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
		test(label('every definition stays registered, and nothing but the `Generic` bit changes', ['name-normal'], ['other']), () => {
			assert.deepStrictEqual([...registered.keys()].sort(), [...written.keys()].sort());
			for(const [name, def] of registered) {
				const before = written.get(name) as typeof def;
				const info = (d: typeof def) => (d as { config?: BuiltInFnInfo }).config;
				assert.deepStrictEqual({ ...info(def), props: undefined }, { ...info(before), props: undefined }, name);
				assert.deepStrictEqual(info(def)?.tags, info(before)?.tags);
				assert.deepStrictEqual((def as { processor?: string }).processor, (before as { processor?: string }).processor, name);
				assert.deepStrictEqual((def as { evalHandler?: string }).evalHandler, (before as { evalHandler?: string }).evalHandler, name);
				const gained = (info(def)?.props ?? 0) & ~(info(before)?.props ?? 0);
				assert.strictEqual(gained & ~CallProp.Generic, 0, `${name} gained more than \`Generic\``);
				assert.strictEqual((info(before)?.props ?? 0) & ~(info(def)?.props ?? 0), 0, `${name} lost a property`);
			}
		});
	});

	describe('Reading a signature-database entry', () => {
		test(label('what a package function calls carries over to it, and forced parameters keep their order', ['name-normal'], ['other']), () => {
			const info = inferFnProps(TestSignatures, 'base', 'known');
			/* `system` runs a command, `paste` is pure and hands nothing on */
			assert.strictEqual(info?.props, CallProp.Throws);
			assert.deepStrictEqual(info?.tags, [SemanticCallTag.Process]);
			const fn = (TestSignatures.functionByName('base', 'known') as DecodedFunction);
			assert.deepStrictEqual(fnInfoFromSignature(fn), {
				sig:   [['x', ArgProp.Forced | ArgProp.NoDefault], ['...', 0]],
				props: CallProp.Throws
			});
		});
	});
});

describe('Functions several packages export', () => {
	const builtIns = getDefaultBuiltInDefinitions();
	const defOf = (pkg: string, name: string) =>
		builtIns.forPackage(pkg)?.get(name as never)?.[0] as BuiltInIdentifierDefinition | undefined;

	/** a name, the package owning it, and the packages re-exporting that very function */
	const ReExported: readonly (readonly [string, string, readonly string[]])[] = [
		['%>%', 'magrittr', ['dplyr', 'purrr', 'stringr', 'tibble', 'tidyr', 'readr', 'testthat', 'magick', 'promises']],
		['quo', 'rlang', ['dplyr', 'ggplot2']],
		['enquo', 'rlang', ['dplyr', 'ggplot2']],
		['sym', 'rlang', ['dplyr', 'ggplot2']],
		['tibble', 'tibble', ['dplyr', 'tidyr']],
		['evalText', 'SoDA', ['FastUtils']]
	];

	test(label('a re-export means what the package owning it means, and each package states it just once', ['name-normal'], ['other']), () => {
		for(const [name, owner, others] of ReExported) {
			const own = defOf(owner, name);
			assert.isDefined(own, `${owner}::${name} is not stated at all`);
			assert.lengthOf(builtIns.forPackage(owner)?.get(name as never) ?? [], 1, `${owner}::${name}`);
			for(const pkg of others) {
				const def = defOf(pkg, name);
				assert.isDefined(def, `${pkg} re-exports ${name}, but nothing is stated for it`);
				/* the same configuration and the same evaluation, so attaching either package means the same call */
				assert.deepStrictEqual(def?.config, own?.config, `${pkg}::${name}`);
				assert.strictEqual(def?.type, own?.type, `${pkg}::${name}`);
				assert.strictEqual(def?.evalHandler, own?.evalHandler, `${pkg}::${name}`);
				assert.lengthOf(builtIns.forPackage(pkg)?.get(name as never) ?? [], 1, `${pkg}::${name}`);
			}
		}
	});

	describe('what a property is called', () => {
		test(label('every bit has a word of its own, and a mask renders every bit it holds', ['name-normal'], ['other']), () => {
			const seen = new Set<string>();
			for(const member of Object.keys(CallProp).filter(k => Number.isNaN(Number(k)))) {
				const bit = CallProp[member as keyof typeof CallProp];
				const words = Fn.call.props.words(bit);
				assert.lengthOf(words, 1, `${member} has to render as exactly one word, got ${JSON.stringify(words)}`);
				assert.isFalse(seen.has(words[0]), `${member} shares the word ${words[0]} with another property`);
				seen.add(words[0]);
			}
			assert.deepStrictEqual(Fn.call.props.words(CallProp.Scope | CallProp.Strict), ['changes scope', 'strict']);
			assert.deepStrictEqual(Fn.call.props.words(CallProp.Lang), ['produces language object']);
			assert.deepStrictEqual(Fn.call.props.words(CallProp.Ambient | CallProp.Concurrent), ['ambient state', 'concurrent']);
			assert.deepStrictEqual(Fn.call.props.words(undefined), []);
			assert.deepStrictEqual(Fn.call.props.words(0), []);
		});
	});
});

/** built-ins that define the given names with the given props and a `y` parameter */
function getBuiltIns(names: readonly (readonly [string, CallProps])[]) {
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
