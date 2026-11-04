import type { DataflowProcessorInformation } from '../../../../../processor';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { type DataflowInformation, ControlDependency, happensInEveryBranch } from '../../../../../info';
import type { DataflowGraph } from '../../../../../graph/graph';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionCall, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RLogical } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import { LazyBindings } from '../../../../../environments/frame-memory';
import { Identifier, PkgName, ReferenceType } from '../../../../../environments/identifier';
import type { BrandedIdentifier, IdentifierDefinition, InGraphIdentifierDefinition, InGraphReferenceType } from '../../../../../environments/identifier';
import type { AmbientConfig, BuiltInMemory } from '../../../../../environments/built-in';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { DefaultAttachPosition, Environment, EnvType, REnvironment } from '../../../../../environments/environment';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { EdgeType } from '../../../../../graph/edge';
import { isNotUndefined, isUndefined } from '../../../../../../util/assert';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import { attachedAlongside } from '../../../../../../project/attached-packages';
import { getCallables, type NamespaceInfo } from '../../../../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { convertFnArguments } from '../common';
import type { Lift, TernaryLogical } from '../../../../../eval/values/r-value';
import { VertexType } from '../../../../../graph/vertex';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { AttachedBasePackages, AttachedBasePackageSet, baseRPackages } from '../../../../../../util/r-base-packages';
import { resolveAttachPosition } from './built-in-envir-utils';
import { uniqueArray } from '../../../../../../util/collections/arrays';
import { sexpTypeToReferenceType } from './built-in-load';

/** Controls how {@link processLibrary} brings a package into scope. */
export interface LibraryProcessorConfig extends AmbientConfig {
	/** `requireNamespace("pkg")` / `loadNamespace("pkg")`: load without attaching bare names */
	readonly namespaceOnly?:  boolean;
	/** the package argument is evaluated, not taken as a symbol (`requireNamespace`/`loadNamespace`/`attachNamespace`, unlike `library`) */
	readonly characterOnly?:  boolean;
	/** `import::from(pkg, a, b)`: attach only the symbols named in the call */
	readonly fromImports?:    boolean;
	/** `box::use(pkg[a, b])`: attach only the symbols listed in the `[...]` bracket */
	readonly boxUse?:         boolean;
	/** every unnamed argument names a package (`pacman::p_load(a, b)`), as the formals after `...` only match by name */
	readonly packagesInDots?: boolean;
	/** a package may be given as `user/repo` (`librarian::shelf`), naming `repo` */
	readonly stripRepo?:      boolean;
	/** a formal whose value always names packages, like `pacman::p_load(char = pkgs)` */
	readonly evaluatedIn?:    string;
	/** with {@link packagesInDots}, the name of a named argument names a package as well, `needs::needs(dplyr = "1.0")` */
	readonly namesInDots?:    boolean;
	/** the formals in order, the first one naming the package, for a loader whose other formals differ from `library`'s */
	readonly formals?:        readonly string[];
}

/** Restricts/aliases which exports of a package are attached; `undefined` fields attach every export. */
export interface AttachSpec {
	readonly namespaceOnly?: boolean;
	/** attached exports as attachedName to exportName (`import::from`/`box::use` selection or aliasing) */
	readonly include?:       ReadonlyMap<string, string>;
	/** attach all exports except these (`import::from` `.except`) */
	readonly exclude?:       ReadonlySet<string>;
	/** attach every export (`import::from` `.all`, `box::use(pkg[...])`) */
	readonly all?:           boolean;
	/** `library(pkg, pos = 3)`: the `search()` position to attach at, {@link DefaultAttachPosition} if unset */
	readonly pos?:           number;
}

/**
 * Process a library call like `library` or `require`
 */
export function processLibrary<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: LibraryProcessorConfig = {}
): DataflowInformation {
	/* we do not really know what loading the library does and what side effects it causes, hence we mark it as an unknown side effect */
	if(args.length === 0) {
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	if(config.boxUse) {
		return processUse(name, args, rootId, data);
	}
	/* parse the import selection before the library flow rewrites `args` below */
	const parsedSpec: AttachSpec = config.fromImports ? parseFromSpec(args) : { namespaceOnly: config.namespaceOnly };
	// 'pos' last, so the positional fallback keeps its previous order; `import::from` has no `pos`, its extra arguments name exports
	const formals: Readonly<Record<string, 'pkg' | 'char' | 'pos' | 'only' | 'except' | 'evaluated' | '...'>> = config.packagesInDots
		? { '...': '...', 'character.only': 'char', ...config.evaluatedIn === undefined ? {} : { [config.evaluatedIn]: 'evaluated' } }
		: config.formals !== undefined ? Object.fromEntries(config.formals.map((f, i) => [f, i === 0 ? 'pkg' as const : '...' as const]))
			: { 'package': 'pkg', 'character.only': 'char', 'pos': 'pos', 'include.only': 'only', 'exclude': 'except' };
	const argMaps = FunctionSemantics.call.match.toSpec(convertFnArguments(args), formals);
	const charId = uniqueArray(argMaps.get('char') ?? []);
	/* `library(pkg, include.only = "f")` and `exclude = "f"` attach only part of the exports, as `import::from` does */
	const namesIn = (key: 'only' | 'except'): string[] | undefined => {
		const value = RArgument.getValue<OtherInfo & ParentInformation>(args, argMaps.get(key)?.[0] ?? '');
		return value === undefined ? undefined : NodeValue.stringsOf(value.info.id, data);
	};
	const only = config.fromImports ? undefined : namesIn('only');
	const except = config.fromImports ? undefined : namesIn('except');
	const spec: AttachSpec = {
		...parsedSpec,
		pos: config.fromImports ? undefined : resolveAttachPosition(argMaps.get('pos')?.[0], data),
		...(only !== undefined ? { include: new Map(only.map(n => [n, n])) } : {}),
		...(except !== undefined ? { exclude: new Set(except), all: true } : {})
	};

	type PkgNameNode = RSymbol<OtherInfo & ParentInformation> | RString<OtherInfo & ParentInformation>;
	const given = config.packagesInDots
		? args.filter((a): a is RArgument<OtherInfo & ParentInformation> => a !== EmptyArgument && (a.name === undefined || config.namesInDots === true))
			.map(a => a.name ?? a.value)
		: uniqueArray(argMaps.get('pkg') ?? []).map(v => RArgument.getValue<OtherInfo & ParentInformation>(args, v));
	/* only a symbol or string literal names a package, `user/repo` names `repo` */
	const namesToLoad = given
		.map(v => config.stripRepo && RBinaryOp.is(v) && v.operator === '/' ? v.rhs : v)
		.filter((v): v is PkgNameNode => v !== undefined && (RSymbol.is(v) || RString.is(v)));
	/* an evaluated argument may be any expression, `c("a", "b")` included */
	const evaluated = config.characterOnly ? given.filter(isNotUndefined) : namesToLoad;
	const alwaysEvaluated = (argMaps.get('evaluated') ?? []).map(v => RArgument.getValue<OtherInfo & ParentInformation>(args, v)).filter(isNotUndefined);
	if(evaluated.length === 0 && alwaysEvaluated.length === 0) {
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	for(const nameToLoad of namesToLoad) {
		if(Identifier.getNamespace(RString.is(nameToLoad) ? nameToLoad.content.str : nameToLoad.content) !== undefined) {
			dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace of library: ', nameToLoad);
		}
	}
	let isCharacterOnly: Lift<TernaryLogical> = config.characterOnly === true;
	if(!config.characterOnly && charId.length >= 1) {
		const values = NodeValue.setOf(charId[0], data);
		if(values?.type === 'set' && values.elements.length > 0) {
			let seenTrue = false;
			let seenFalse = false;
			let seenMaybe = false;
			for(const elem of values.elements) {
				if(elem.type !== 'logical') {
					continue;
				} else if(elem.value === true) {
					seenTrue = true;
				} else if(elem.value === false) {
					seenFalse = true;
				} else {
					seenMaybe = true;
				}
			}
			/* mixed true/false, no logical value at all, or an explicit NA are all treated the same: uncertain */
			isCharacterOnly = seenMaybe || seenTrue === seenFalse ? 'maybe' : seenTrue;
		}
	}
	const evaluatedNames = isCharacterOnly ? evaluated.map(n => NodeValue.stringsOf(n.info.id, data)) : [];
	const alwaysEvaluatedNames = alwaysEvaluated.map(n => NodeValue.stringsOf(n.info.id, data));
	const packetName: string[] = [...evaluatedNames, ...alwaysEvaluatedNames].flatMap(n => n ?? []);
	if(!isCharacterOnly || isCharacterOnly === 'maybe') {
		// treat as a function call but convert the argument(s) to a string; a quoted literal carries its name in `content.str`, not `lexeme`
		packetName.push(...namesToLoad.map(n => RString.is(n) ? n.content.str : n.lexeme).filter(isNotUndefined));
		const newArgs = namesToLoad.map((n): RString<OtherInfo & ParentInformation> => RString.is(n) ? n : {
			type:     RType.String,
			info:     n.info,
			lexeme:   n.lexeme,
			location: n.location,
			content:  { quotes: 'none', str: Identifier.getName(n.content) }
		});
		args = config.packagesInDots ? args : wrapArgumentsUnnamed([...newArgs, ...args.slice(1)], data.completeAst.idMap);
	}
	const info = processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: false, origin: BuiltInProcName.Library }).information;

	for(const p of config.stripRepo ? packetName.map(p => p.replace(/^.*?\//, '')) : packetName) {
		const dependency = data.ctx.deps.loadDependency(p);
		if(dependency === undefined && data.ctx.env.statedFor(p) === undefined && !data.ctx.env.knowsPackage(p)) {
			info.graph.markIdForUnknownSideEffects(rootId);
		}
		linkLibrary(p, dependency, info, rootId, data, spec);
	}
	/* some package we cannot name may be attached */
	if(packetName.length === 0 || (isCharacterOnly === true && evaluatedNames.includes(undefined)) || alwaysEvaluatedNames.includes(undefined)) {
		info.graph.markIdForUnknownSideEffects(rootId);
	}
	return info;
}

/** The name of a symbol or string literal node, or `undefined` for anything else. */
function symbolOrStringName<Info>(node: RNode<Info> | undefined): string | undefined {
	if(RSymbol.is(node)) {
		return Identifier.getName(node.content);
	} else if(RString.is(node)) {
		return node.content.str;
	}
	return undefined;
}

/** The string literals of a `"x"` or `c("x", "y")` node (used for `import::from`'s `.except`). */
function stringLiterals<Info>(node: RNode<Info>): string[] {
	if(RString.is(node)) {
		return [node.content.str];
	}
	return RFunctionCall.isNamed(node, 'c')
		? node.arguments.flatMap(a => a !== EmptyArgument && RString.is(a.value) ? [a.value.content.str] : [])
		: [];
}

/** Parse `import::from(pkg, a, keep = filter, .all = TRUE, .except = c(...))` into which exports to attach. */
function parseFromSpec<Info>(args: readonly PotentiallyEmptyRArgument<Info>[]): AttachSpec {
	const include = new Map<string, string>();
	const exclude = new Set<string>();
	let all = false;
	for(const arg of args.slice(1)) {
		if(RArgument.isEmpty(arg) || arg.value === undefined) {
			continue;
		}
		const argName = arg.name?.lexeme;
		if(argName === '.all') {
			all ||= RLogical.isTrue(arg.value);
		} else if(argName === '.except') {
			stringLiterals(arg.value).forEach(s => exclude.add(s));
			all = true;
		} else if(!argName?.startsWith('.')) {
			/* other control args (.into, .library, ...) do not affect which exports resolve */
			const exported = symbolOrStringName(arg.value);
			if(exported !== undefined) {
				include.set(argName ?? exported, exported);
			}
		}
	}
	return { include: include.size > 0 ? include : undefined, exclude: exclude.size > 0 ? exclude : undefined, all };
}

/** Parse a `box::use` bracket argument (`pkg[a, b]` or `pkg[...]`) into a package and its attach spec; `undefined` if not a bracket. */
function parseBoxSpec<Info>(first: RNode<Info> | undefined): { pack: string, spec: AttachSpec } | undefined {
	if(!RAccess.isIndex(first)) {
		return undefined;
	}
	const pack = symbolOrStringName(first.accessed);
	if(pack === undefined) {
		return undefined;
	}
	const include = new Map<string, string>();
	let all = false;
	for(const el of first.access) {
		if(RArgument.isEmpty(el)) {
			continue;
		} else if(RSymbol.is(el.value) && Identifier.getName(el.value.content) === '...') {
			/* use(pkg[...]) attaches every export */
			all = true;
		} else {
			const exported = symbolOrStringName(el.value);
			if(exported !== undefined) {
				include.set(el.name?.lexeme ?? exported, exported);
			}
		}
	}
	return { pack, spec: { include: include.size > 0 ? include : undefined, all } };
}

/**
 * Process a `use` call, library-sensitively: `pkg[...]` uses box's bracket selection; a bare `pkg` is box's
 * namespace-only member access when box is loaded, otherwise `import::from`-style extra-argument selection.
 */
function processUse<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: false, origin: BuiltInProcName.Library }).information;
	const parsed = parseUseSpec(name, RArgument.valueOf(args[0]), args, data);
	const dependency = parsed && data.ctx.deps.getDependency(parsed.pack);
	if(parsed && (dependency || data.ctx.env.statedFor(parsed.pack) !== undefined)) {
		linkLibrary(parsed.pack, dependency, info, rootId, data, parsed.spec);
	} else {
		info.graph.markIdForUnknownSideEffects(rootId);
	}
	return info;
}

/** The package and attach spec for a `use` call (see {@link processUse}). */
function parseUseSpec<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	first: RNode<OtherInfo & ParentInformation> | undefined,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): { pack: string, spec: AttachSpec } | undefined {
	const bracket = parseBoxSpec(first);
	if(bracket !== undefined) {
		return bracket;
	}
	const pack = symbolOrStringName(first);
	if(pack === undefined) {
		return undefined;
	}
	// box::use is read as box's namespace-only member access: a box::-qualified call, or box is a loaded dependency
	if(Identifier.getNamespace(name.content) === PkgName.Box || data.ctx.deps.getDependency(PkgName.Box) !== undefined) {
		return { pack, spec: { namespaceOnly: true } }; // box: use(pkg) is member access via pkg$fn
	}
	return { pack, spec: parseFromSpec(args) }; // extra-argument selection: use(pkg, a, b) / use(pkg)
}

/** Materialize the empty built-in function-definition vertex for a package export (idempotent). */
export function attachExportVertex(graph: DataflowGraph, builtInId: NodeId, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, cds?: readonly ControlDependency[]): void {
	if(graph.hasVertex(builtInId)) {
		return;
	}
	graph.addVertex({
		tag:        VertexType.FunctionDefinition,
		id:         builtInId,
		environment, cds, params:     {},
		subflow:    { graph: new Set(), unknownReferences: [], in: [], out: [], environment: ctx.env.makeCleanEnv(), entryPoint: builtInId, hooks: [] },
		exitPoints: [],
	}, ctx.env.cleanEnv);
}

/** Reserved marker binding recording an unresolved `library()`/`require()` load; the leading space cannot collide with a real export name. */
const libraryLoadMarker = ' library-load' as BrandedIdentifier;

/** The {@link libraryLoadMarker} binding of loading `pack` at `loadedAt`, so `pack::fn` links back via {@link loadNodesForNamespace}. */
function loadMarkerOf(pack: string, loadedAt: NodeId, cds?: readonly ControlDependency[]): InGraphIdentifierDefinition & { name: Identifier } {
	return { name: Identifier.make(libraryLoadMarker, pack), type: ReferenceType.Function, nodeId: loadedAt, definedAt: loadedAt, cds: cds?.slice() };
}

/**
 * Record a syntactically known but database-unresolved package load: a bare {@link EnvType.LoadedNamespace} layer
 * carrying only the reserved {@link libraryLoadMarker} (if `loadedAt` names the load), so an explicit `pack::fn` still links back via {@link loadNodesForNamespace}.
 */
function recordUnresolvedLibraryLoad(envInfo: REnvironmentInformation, pack: string, loadedAt?: NodeId, pos?: number, cds?: readonly ControlDependency[]): REnvironmentInformation {
	const layer = new Environment(envInfo.current).asLibrary(pack, EnvType.LoadedNamespace);
	const marked = loadedAt === undefined ? layer : layer.define(loadMarkerOf(pack, loadedAt, cds));
	return { level: envInfo.level, current: REnvironment.attachAt(envInfo.current, marked, marked, pos) };
}

/**
 * Attaches `pack` as `library(pack)` does: its resolved exports, else what flowR states about it, else a bare
 * {@link EnvType.LoadedNamespace} recording the load. The `library()` processor and `Dataflow.library` both use this.
 */
export function attachLibrary(pack: string, dependency: Package | undefined, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec = {}, loadedAt?: NodeId, cds?: readonly ControlDependency[]): REnvironmentInformation {
	return attachPackage(pack, dependency, envInfo, ctx, spec, loadedAt, cds, new Set());
}

/** {@link attachLibrary}; `attaching` holds the packages already being attached, which closes a `Depends` cycle */
function attachPackage(pack: string, dependency: Package | undefined, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec, loadedAt: NodeId | undefined, cds: readonly ControlDependency[] | undefined, attaching: ReadonlySet<string>): REnvironmentInformation {
	if(dependency?.namespaceInfo !== undefined) {
		return attachResolved(dependency, envInfo, ctx, spec, loadedAt, attaching, cds);
	}
	if(ctx.env.statedFor(pack) !== undefined) {
		return attachStatedDefinitions(pack, envInfo, ctx, spec, undefined, loadedAt, cds);
	}
	return recordUnresolvedLibraryLoad(envInfo, pack, loadedAt, spec.pos, cds);
}

/**
 * The load calls (`library()`/`require()`) that brought package `pack` (any package if not given) into scope without a
 * database, collected from the {@link libraryLoadMarker} of every matching {@link EnvType.LoadedNamespace} layer below the
 * global environment. A call nothing resolves may go to any of them.
 */
export function loadNodesForNamespace(env: REnvironmentInformation, pack?: string): NodeId[] {
	const nodes: NodeId[] = [];
	if(env.current.builtInEnv) {
		return nodes;   // resolving straight in the built-in environment (`get(x, envir = baseenv())`): no search path above it
	}
	for(const e of REnvironment.searchPath(env.current)) {
		if(e.t === undefined) {
			break;
		}
		if(pack !== undefined && e.n !== pack) {
			continue;
		}
		for(const def of e.memory.get(libraryLoadMarker) ?? []) {
			const definedAt = (def as Partial<InGraphIdentifierDefinition>).definedAt;
			if(definedAt !== undefined) {
				nodes.push(definedAt);
			}
		}
	}
	return nodes;
}

/**
 * Processes `conflicted::conflict_prefer(name, winner)` and `conflicts_prefer(pkg::fn, ...)`: the preferred function is
 * put on top of the search path, as conflicted does with its `.conflicts` entry, so the name resolves to it from then on.
 */
export function processPrefer<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	/* the search path it writes is applied by the registration, see {@link AmbientConfig} */
	_config: AmbientConfig = {}
): DataflowInformation {
	const info = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Prefer }).information;
	const values = args.map(a => RArgument.valueOf(a === EmptyArgument ? undefined : a));
	const preferred: [fn: string, pkg: string][] = values.every(v => RSymbol.is(v) && Identifier.getNamespace(v.content) !== undefined)
		? values.map(v => [Identifier.getName((v as RSymbol).content), String(Identifier.getNamespace((v as RSymbol).content))])
		: RString.is(values[0]) && RString.is(values[1]) ? [[values[0].content.str, values[1].content.str]] : [];
	if(preferred.length === 0) {
		handleUnknownSideEffect(info.graph, info.environment, rootId);
		return info;
	}
	for(const [fn, pkg] of preferred) {
		const conflicts = new Environment(info.environment.current);
		conflicts.adoptMap(lazyExports(pkg, [{ exported: fn, as: fn }], data.ctx, rootId, data.cds));
		conflicts.t = EnvType.Attached;
		conflicts.n = '.conflicts';
		info.environment = { ...info.environment, current: REnvironment.attachAt(info.environment.current, conflicts, conflicts) };
	}
	return info;
}

function linkLibrary<OtherInfo>(pack: string, dependency: Package | undefined, info: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, spec: AttachSpec = {}) {
	// re-loading an already attached package is a no-op, cf. R's `search()`
	if(isAttached(info.environment.current, pack, spec.namespaceOnly, data.cds)) {
		return;
	}
	// by default only the environment carries the exports, materializing a vertex on demand (see attachExportVertex); eager mode registers them all upfront
	if(dependency?.namespaceInfo !== undefined && data.ctx.config.solver.sigdb.eagerlyLoadExports) {
		for(const { exported: func } of selectExports(getCallables(dependency.namespaceInfo), spec)) {
			const builtInId = NodeId.fromPkgFn(pack, func);
			attachExportVertex(info.graph, builtInId, info.environment, data.ctx, data.cds);
			info.graph.addEdge(builtInId, rootId, EdgeType.Reads | EdgeType.Calls);
		}
	}
	info.environment = attachLibrary(pack, dependency, info.environment, data.ctx, spec, rootId, data.cds);
}

/** An export to attach: its name in the package and the name it is bound under (differs only when aliased). */
interface AttachedExport {
	readonly exported: string;
	readonly as:       string;
}

/** The exports of `callables` to attach under `spec` (see {@link AttachSpec}), resolving selection and aliasing. */
function selectExports(callables: readonly string[], spec: AttachSpec): AttachedExport[] {
	if(spec.include !== undefined && !spec.all) {
		const available = new Set(callables);
		return Array.from(spec.include, ([as, exported]) => ({ exported, as })).filter(e => available.has(e.exported));
	}
	return callables.filter(c => !spec.exclude?.has(c)).map(c => ({ exported: c, as: c }));
}

/**
 * What a package's attached layer binds, built per name on the first lookup. An attach names thousands of exports
 * and a script mentions a few dozen, so the definitions are only made for the ones something asks about.
 */
function lazyExports(pack: string, exports: readonly AttachedExport[], ctx: FlowrAnalyzerContext, definedAt: NodeId | undefined, cds?: readonly ControlDependency[]): LazyBindings {
	const byName = new Map(exports.map(exp => [Identifier.getName(Identifier.make(exp.as, pack)), exp] as const));
	const aliases = exports.filter(exp => exp.as !== exp.exported).map(exp => `${exp.as}=${exp.exported}`);
	return new LazyBindings(new Set(byName.keys()), name => [exportDefinition(pack, byName.get(name) as AttachedExport, ctx, definedAt, cds)], `${pack}|${String(definedAt)}|${aliases.join(',')}|${ControlDependency.key(cds)}`);
}

/**
 * The identifier definition binding a package export (or its alias) to its built-in function-definition.
 * The identity stays the plain export (so a call still materializes its `built-in:pkg:fn` vertex); whatever the configuration states about that name (processor, config, eval handler) rides along on top.
 */
function exportDefinition(pack: string, exp: AttachedExport, ctx: FlowrAnalyzerContext, definedAt: NodeId = NodeId.toBuiltIn(pack), cds?: readonly ControlDependency[]): IdentifierDefinition & { name: Identifier } {
	const identity = {
		name:   Identifier.make(exp.as, pack),
		type:   ReferenceType.Function,
		nodeId: NodeId.fromPkgFn(pack, exp.exported),
		definedAt,
		...(cds === undefined ? {} : { cds: cds.slice() })
	} as const;
	/* an export named like a primitive is a method registered for it (lubridate's `$`), the primitive still evaluates the call */
	const exported = Identifier.make(exp.exported) as unknown as BrandedIdentifier;
	const stated = ctx.env.statedFor(pack)?.get(exported)?.[0] ?? ctx.env.emptyBuiltInEnvironment.memory.get(exported)?.[0];
	if(stated === undefined) {
		return identity;
	}
	/* the identity stays the export (so the call still earns its `built-in:pkg:fn` vertex); the configuration's take on the same name rides along */
	const { processor, config, evalHandler } = stated as { processor?: unknown, config?: unknown, evalHandler?: unknown };
	return { ...identity, processor, config, evalHandler } as unknown as IdentifierDefinition & { name: Identifier };
}

/**
 * Attaches `dependency`'s exports at `spec`'s {@link AttachSpec#pos|search position} (below global by default) and
 * returns the enriched environment (graph untouched). Used by `library()`, `import::from`, `box::use`, `requireNamespace`, and transitive side-effect propagation.
 */
export function attachDependencyToEnvironment(dependency: Package, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec = {}, definedAt?: NodeId): REnvironmentInformation {
	return attachResolved(dependency, envInfo, ctx, spec, definedAt, new Set(), undefined);
}

/** {@link attachDependencyToEnvironment}, see {@link attachPackage} for `attaching` */
function attachResolved(dependency: Package, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec, definedAt: NodeId | undefined, attaching: ReadonlySet<string>, cds: readonly ControlDependency[] | undefined): REnvironmentInformation {
	const pack = dependency.name;
	if(isAttached(envInfo.current, pack, spec.namespaceOnly, cds)) {
		return envInfo;
	}
	if(isUndefined(dependency.namespaceInfo)) {
		/* nothing resolved the package's exports, but what flowR states about them is still what a call means, and `library()` brings it into scope */
		return attachStatedDefinitions(pack, envInfo, ctx, withStartupPosition(pack, envInfo, spec), undefined, undefined, cds);
	}
	const exports = selectExports(getCallables(dependency.namespaceInfo), spec);
	// a subset import restricts the attached exports, so no imports layer is materialized and, as in R, nothing is attached alongside
	if(spec.namespaceOnly || (spec.include !== undefined && !spec.all)) {
		spec = withStartupPosition(pack, envInfo, spec);
		const layerType = spec.namespaceOnly ? EnvType.LoadedNamespace : EnvType.Namespace;
		const layer = new Environment(envInfo.current).asLibrary(pack, layerType);
		layer.adoptMap(lazyExports(pack, exports, ctx, definedAt, cds));
		return { level: envInfo.level, current: REnvironment.attachAt(envInfo.current, layer, layer, spec.pos) };
	}
	/* as R does: the Depends first (at the default position, whatever `pos` says), then `pack`, then what its `.onAttach` attaches */
	const { depends, onAttach } = attachedAlongside(pack, ctx.deps.signatureSources(), dependency.resolvedVersion);
	const within = new Set([...attaching, pack]);
	const alongside = (env: REnvironmentInformation, packs: readonly string[]) => packs.filter(p => !within.has(p))
		.reduce((e, p) => attachPackage(p, ctx.deps.getDependency(p), e, ctx, {}, definedAt, cds, within), env);
	const below = alongside(envInfo, depends);
	// full attach: imports layer at the bottom, namespace (exports) layer on top
	const importsEnv = imports(new Environment(below.current).asLibrary(pack, EnvType.Imports), dependency.namespaceInfo, ctx);
	const namespaceEnv = new Environment(importsEnv).asLibrary(pack, EnvType.Namespace);
	namespaceEnv.adoptMap(lazyExports(pack, exports, ctx, definedAt, cds));
	const attached = { level: below.level, current: REnvironment.attachAt(below.current, namespaceEnv, importsEnv, withStartupPosition(pack, below, spec).pos) };
	return alongside(attached, onAttach);
}

/** `spec` with the position R gives a startup package, unless a position is given, see {@link startupAttachPosition} */
function withStartupPosition(pack: string, envInfo: REnvironmentInformation, spec: AttachSpec): AttachSpec {
	if(spec.pos !== undefined || spec.namespaceOnly) {
		return spec;
	}
	const startup = startupAttachPosition(pack, envInfo.current);
	return startup === undefined ? spec : { ...spec, pos: startup };
}

/** A namespace-only load is subsumed by any layer for `pack`; a full attach ignores a mere {@link EnvType.LoadedNamespace}. */
function blocksAttach(layer: Environment, namespaceOnly: boolean | undefined): boolean {
	if(namespaceOnly) {
		return layer.t !== EnvType.AssumedNamespace;
	}
	/* an assumption stands in for a `library()` that was not analyzed, so the real one still attaches over it */
	return layer.t !== EnvType.LoadedNamespace && layer.t !== EnvType.AssumedNamespace;
}

/**
 * The `search()` order R attaches its startup packages in, deepest last (`base` is always the last entry),
 * `undefined` for a package R does not attach on startup.
 */
function startupAttachRank(pack: string | undefined): number | undefined {
	if(pack === undefined || !AttachedBasePackageSet.has(pack)) {
		return undefined;
	}
	return pack === PkgName.Base ? AttachedBasePackages.length : AttachedBasePackages.indexOf(pack);
}

/**
 * The `search()` position `library(pack)` attaches a startup-attached package at, `undefined` for every other package.
 * Re-attaching an already-attached package does not move it, so `library(dplyr); library(stats)` must still leave `filter` with `dplyr`.
 */
function startupAttachPosition(pack: string, env: Environment): number | undefined {
	const rank = startupAttachRank(pack);
	if(rank === undefined) {
		return undefined;
	}
	let pos = DefaultAttachPosition;
	for(const e of REnvironment.searchPath(env)) {
		if(e.t === EnvType.Imports) {
			continue; // internal layer, not a search-path entry
		}
		const other = startupAttachRank(e.n);
		if(other !== undefined && other > rank) {
			break;
		}
		pos++;
	}
	return pos;
}

/** Whether package `pack` is already attached below the global env in a way that makes this (re-)attach a no-op. */
function isAttached(env: Environment, pack: string, namespaceOnly?: boolean, cds?: readonly ControlDependency[]): boolean {
	for(const e of REnvironment.searchPath(env)) {
		if(e.t === undefined) {
			break;
		}
		/* a sure attach repeats one that only maybe happened */
		if(e.n === pack && e.t !== EnvType.Imports && blocksAttach(e, namespaceOnly) && (attachedInEveryBranch(e) || !happensInEveryBranch(cds))) {
			return true;
		}
	}
	return false;
}

/** Whether the layer was attached unconditionally; all its bindings share the cds of the attach, so the first one tells. */
function attachedInEveryBranch(layer: Environment): boolean {
	const first = layer.memory.keys().next();
	return first.done === true || (layer.memory.get(first.value)?.every(d => happensInEveryBranch(d.cds)) ?? true);
}

/** Immutable base-layer chains, shared across analyses (layers clone before mutating); building one is O(N^2) in exports, so cache and reparent. */
const baseNamespaceLayerCache = new Map<string, REnvironmentInformation['current']>();

function baseNamespaceCacheKey(ctx: FlowrAnalyzerContext, basePackages: readonly string[]): string {
	return `${String(ctx.env.getCleanEnvFingerprint())}|${ctx.resolvedRVersion}|${basePackages.join(',')}|${ctx.deps.baseRSourceFingerprint()}`;
}

/**
 * Attach the {@link baseRPackages|base-R} exports below the global so bare base calls resolve without `library()`.
 * No-op when no database resolves a base package; the built layer is cached per {@link baseNamespaceCacheKey}.
 */
export function attachBaseRNamespaces(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	if(!ctx.config.solver.sigdb.linkBaseR || !ctx.deps.hasBaseRSource()) {
		return env;
	}
	const basePackages = ctx.config.project.basePackages ?? baseRPackages(ctx.resolvedRVersion);
	const key = baseNamespaceCacheKey(ctx, basePackages);
	const cached = baseNamespaceLayerCache.get(key);
	if(cached !== undefined) {
		env.current.parent = cached;
		return env;
	}
	let built = env;
	let builtinNames: ReadonlySet<string> | undefined;
	for(const pkg of basePackages) {
		const dependency = ctx.deps.getDependency(pkg);
		if(dependency?.namespaceInfo !== undefined) {
			builtinNames ??= new Set([...ctx.env.builtInEnvironment.memory.keys()].map(String));
			built = attachDependencyToEnvironment(dependency, built, ctx, { exclude: builtinNames }, NodeId.toBuiltIn(pkg));
		}
	}
	if(built.current.parent !== env.current.parent) {
		baseNamespaceLayerCache.set(key, built.current.parent);
	}
	return built;
}

/**
 * Attach the project's declared `DESCRIPTION` dependencies below the global, mirroring base-R auto-attach, so their bare
 * calls resolve without an explicit `library()`; skips a dependency no database resolves, no-ops via {@link isAttached}.
 */
export function attachDeclaredDependencies(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	if(!ctx.config.solver.sigdb.linkDescriptionDependencies) {
		return env;
	}
	let built = env;
	for(const declared of ctx.deps.getDependencies()) {
		/* getDependency triggers lazy export resolution the raw declared record may still be missing */
		const dependency = ctx.deps.getDependency(declared.name);
		if(dependency?.namespaceInfo !== undefined) {
			built = attachDependencyToEnvironment(dependency, built, ctx, {}, NodeId.toBuiltIn(dependency.name));
		}
	}
	return built;
}

/** attach the analyzed package's own `NAMESPACE importFrom(...)` symbols (by their bare name) below the global, so a bare imported call resolves to its source package */
export function attachProjectImports(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	const own = ctx.deps.getDependency('current')?.namespaceInfo;
	if(own === undefined || own.importedPackages.size === 0) {
		return env;
	}
	const layerNamespace = 'current';
	const toDefine: (InGraphIdentifierDefinition & { name: Identifier })[] = [];
	for(const [pkg, funcs] of own.importedPackages) {
		// an explicit `importFrom(pkg, a, b)` names the symbols directly; `import(pkg)` needs the package's own export list
		let names: readonly string[];
		if(funcs === 'all') {
			const imported = ctx.deps.getDependency(pkg)?.namespaceInfo;
			if(imported === undefined) {
				continue;
			}
			names = getCallables(imported);
		} else {
			names = funcs;
		}
		toDefine.push(...names.map((fn): InGraphIdentifierDefinition & { name: Identifier } => ({
			name:      Identifier.make(fn, layerNamespace),
			type:      ReferenceType.Function,
			nodeId:    NodeId.fromPkgFn(pkg, fn),
			definedAt: NodeId.toBuiltIn(pkg)
		})));
	}
	if(toDefine.length === 0) {
		return env;
	}
	const layer = new Environment(env.current).asLibrary(layerNamespace, EnvType.Imports).defineAll(toDefine);
	return { level: env.level, current: REnvironment.attachAt(env.current, layer, layer) };
}

/** Attaches the definitions flowR states for `pack`, for a package whose own exports nothing could resolve. */
function attachStatedDefinitions(pack: string, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec, as?: EnvType, loadedAt?: NodeId, cds?: readonly ControlDependency[]): REnvironmentInformation {
	const stated = ctx.env.statedFor(pack);
	if(stated === undefined) {
		return envInfo;
	}
	/* the same no-op R's `search()` makes of a second `library(pack)`; without it a project calling it once per
	 * file stacked one layer per call, which every later name resolution then walked through */
	if(isAttached(envInfo.current, pack, spec.namespaceOnly, cds)) {
		return envInfo;
	}
	/* keyed as the configuration states them: a replacement is bound under `f<-`, which its `name` does not say */
	const selected = spec.include === undefined && spec.exclude === undefined ? [...stated]
		: [...stated].filter(([key]) => (spec.all || spec.include === undefined || spec.include.has(key)) && !spec.exclude?.has(key));
	const memory: BuiltInMemory = new Map(cds === undefined ? selected : selected.map(([key, defs]) => [key, defs.map(d => ({ ...d, cds: cds.slice() }))]));
	if(loadedAt !== undefined) {
		/* the marker an unresolved load leaves behind, so a call links back to the `library()` that made it resolve */
		memory.set(libraryLoadMarker, [loadMarkerOf(pack, loadedAt, cds)]);
	}
	const layer = new Environment(envInfo.current)
		.asLibrary(pack, as ?? (spec.namespaceOnly ? EnvType.LoadedNamespace : EnvType.Namespace));
	layer.adoptMap(memory);
	return { level: envInfo.level, current: REnvironment.attachAt(envInfo.current, layer, layer, spec.pos) };
}

/**
 * The `search()` position an assumed package attaches at: past every entry, directly above the built-ins.
 * Anything the code attaches itself must be found first, or the assumption would wrongly answer for it.
 */
const AssumedAttachPosition = Number.MAX_SAFE_INTEGER;

/**
 * Attaches the packages `solver.assumeAttachedPackages` names as if the code had called `library()` on them.
 * Covers the case where such a call is simply not part of what is being analyzed (a snippet, a chunk, a cell).
 */
export function attachAssumedPackages(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	const assumed = ctx.config.solver.assumeAttachedPackages;
	if(assumed === undefined || assumed.length === 0) {
		return env;
	}
	let built = env;
	/* each attaches below the one before, so walking backwards makes the first name given win a shared export */
	for(let i = assumed.length - 1; i >= 0; i--) {
		const pkg = assumed[i];
		const dependency = ctx.deps.getDependency(pkg);
		built = dependency?.namespaceInfo !== undefined
			? attachDependencyToEnvironment(dependency, built, ctx, {}, NodeId.toBuiltIn(pkg))
			: attachStatedDefinitions(pkg, built, ctx, { pos: AssumedAttachPosition }, EnvType.AssumedNamespace);
	}
	return built;
}

/**
 * Defines the objects `R/sysdata.rda` lazy-loads into the package namespace: internal, not exported, available
 * to the package's own code without a call bringing them in. Modelled on the global env for R's resolution order.
 * @see https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Data-in-packages
 */
export function defineProjectSysdata(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	const namespace = ctx.meta.getNamespace();
	/* only a package has a namespace to lazy-load into */
	if(namespace === undefined) {
		return env;
	}
	const objects = ctx.files.sysdataObjects();
	if(objects.length === 0) {
		return env;
	}
	const definedAt = NodeId.toBuiltIn(namespace);
	return { level:   env.level, current: env.current.defineAll(objects.map(object => ({
		name:   Identifier.make(object.name, namespace),
		type:   sexpTypeToReferenceType(object.type) as InGraphReferenceType,
		nodeId: NodeId.fromPkgFn(namespace, object.name),
		definedAt
	}))) };
}

/** attach every project-level environment layer in order: base R namespaces, the project's own `importFrom` symbols, its declared dependencies, whatever the configuration assumes attached, then the package's own system data */
export function attachProject(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	return defineProjectSysdata(attachAssumedPackages(attachDeclaredDependencies(attachProjectImports(attachBaseRNamespaces(env, ctx), ctx), ctx), ctx), ctx);
}

function imports(importsEnv: Environment, namespaceInfo: NamespaceInfo, ctx: FlowrAnalyzerContext) {
	/* only what the NAMESPACE imports, not what those packages import in turn */
	for(const [pkg, imported] of namespaceInfo.importedPackages) {
		const importedDependency = ctx.deps.getDependency(pkg);
		const importedNs = importedDependency?.namespaceInfo;
		if(importedDependency === undefined || importedNs === undefined) {
			continue;
		}
		/* collect first and define in one go, as defining one by one copies the (growing) memory every time */
		const toDefine: (InGraphIdentifierDefinition & { name: Identifier })[] = [];
		const queued = new Set<string>();
		const callables = getCallables(importedNs);
		const funcToImport = imported === 'all' ? callables : callables.filter(v => imported.includes(v));
		for(const func of funcToImport) {
			const identifier = Package.functionIdentifier(importedDependency.name, func);
			if(importsEnv.memory.has(identifier) || queued.has(identifier)) {
				continue;
			}
			queued.add(identifier);
			toDefine.push({
				name:      Identifier.make(identifier, importsEnv.n),
				type:      ReferenceType.Function,
				nodeId:    NodeId.fromPkgFn(importedDependency.name, func),
				definedAt: NodeId.toBuiltIn(importedDependency.name)
			});
		}
		if(toDefine.length > 0) {
			importsEnv = importsEnv.defineAll(toDefine);
		}
	}
	return importsEnv;
}
