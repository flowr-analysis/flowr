import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation, ControlDependency } from '../../../../../info';
import type { DataflowGraph } from '../../../../../graph/graph';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument, RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RLogical } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import { Identifier, PkgName, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Environment, EnvType, REnvironment } from '../../../../../environments/environment';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { EdgeType } from '../../../../../graph/edge';
import { isNotUndefined, isUndefined } from '../../../../../../util/assert';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import { getCallables, type NamespaceInfo } from '../../../../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { convertFnArguments } from '../common';
import { pMatch } from '../../../../linker';
import type { Lift, TernaryLogical } from '../../../../../eval/values/r-value';
import { VertexType } from '../../../../../graph/vertex';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { baseRPackages } from '../../../../../../util/r-base-packages';

/** Controls how {@link processLibrary} brings a package into scope. */
export interface LibraryProcessorConfig {
	/** `requireNamespace("pkg")` / `loadNamespace("pkg")`: load without attaching bare names */
	readonly namespaceOnly?: boolean;
	/** the package argument is evaluated, not taken as a symbol (`requireNamespace`/`loadNamespace`/`attachNamespace`, unlike `library`) */
	readonly characterOnly?: boolean;
	/** `import::from(pkg, a, b)`: attach only the symbols named in the call */
	readonly fromImports?:   boolean;
	/** `box::use(pkg[a, b])`: attach only the symbols listed in the `[...]` bracket */
	readonly boxUse?:        boolean;
}

/** Restricts/aliases which exports of a package are attached; `undefined` fields attach every export. */
interface AttachSpec {
	readonly namespaceOnly?: boolean;
	/** attached exports as attachedName to exportName (`import::from`/`box::use` selection or aliasing) */
	readonly include?:       ReadonlyMap<string, string>;
	/** attach all exports except these (`import::from` `.except`) */
	readonly exclude?:       ReadonlySet<string>;
	/** attach every export (`import::from` `.all`, `box::use(pkg[...])`) */
	readonly all?:           boolean;
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
	if(args.length === 0){
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	if(config.boxUse){
		return processUse(name, args, rootId, data);
	}
	/* parse the import selection before the library flow rewrites `args` below */
	const spec: AttachSpec = config.fromImports ? parseFromSpec(args) : { namespaceOnly: config.namespaceOnly };
	const params = {
		'package':        'pkg',
		'character.only': 'char'
	};
	const resolveArgs = { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx };
	const argMaps = pMatch(convertFnArguments(args), params);
	const packageId = Array.from(new Set(argMaps.get('pkg')));
	const charId = Array.from(new Set(argMaps.get('char')));

	let namesToLoad = packageId.map(v => RArgument.getValue<OtherInfo & ParentInformation>(args, v)) as RNode<OtherInfo & ParentInformation>[];
	//check if library name provided
	namesToLoad = namesToLoad.filter(v => v !== undefined && (v.type === RType.Symbol || v.type === RType.String)) ;
	if(namesToLoad.length === 0){
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	for(const nameToLoad of namesToLoad){
		if(nameToLoad !== undefined && (nameToLoad.type === RType.Symbol || nameToLoad.type === RType.String) && Identifier.getNamespace(nameToLoad.type === RType.String ? nameToLoad.content.str : nameToLoad.content) !== undefined) {
			dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace of library: ', nameToLoad);
		}
	}
	let isCharacterOnly: Lift<TernaryLogical> = config.characterOnly === true;
	if(!config.characterOnly && charId.length >= 1){
		const values = valueSetGuard(resolveIdToValue(charId[0], resolveArgs));
		if(values?.type === 'set' && values?.elements.length > 0) {
			let hasTrue = 0;
			let hasFalse = 0;
			let hasMaybe = 0;
			for(const elem of values.elements){
				if(elem.type === 'logical'){
					switch(elem.value) {
						case true:
							hasTrue++;
							break;
						case false:
							hasFalse++;
							break;
						default:
							hasMaybe++;
							break;
					}
				}
			}
			if(hasMaybe > 0){
				isCharacterOnly = 'maybe';
			} else if(hasTrue === 0 && hasFalse > 0){
				isCharacterOnly = false;
			} else if(hasTrue > 0 && hasFalse === 0){
				isCharacterOnly = true;
			} else {
				isCharacterOnly = 'maybe';
			}
		}
	}
	const packetName: string[] = [];
	//case: true or maybe
	if(isCharacterOnly){
		for(const nameToLoad of namesToLoad){
			const values = valueSetGuard(resolveIdToValue(nameToLoad.info.id, resolveArgs));
			if(values?.type === 'set' && values.elements.length !== 0){
				for(const elem of values.elements){
					if(elem.type === 'string' && 'str' in elem.value){
						packetName.push(elem.value.str);
					}
				}
			}
		}

	}
	if(!isCharacterOnly || isCharacterOnly === 'maybe'){
		for(const nameToLoad of namesToLoad){
			// a quoted literal (`requireNamespace("pkg")`) carries its name in `content.str`, not the quoted `lexeme`
			const packageName = nameToLoad.type === RType.String ? nameToLoad.content.str : nameToLoad.lexeme;
			if(isNotUndefined(packageName)){
				packetName.push(packageName);
			}
		}
	}
	if(!isCharacterOnly || isCharacterOnly === 'maybe') {
		// treat as a function call but convert the first argument to a string
		const newArgs = [];
		for(const nameToLoad of namesToLoad){
			if(!(nameToLoad.type === RType.Symbol || nameToLoad.type === RType.String)){
				continue;
			}
			const newArg: RString<OtherInfo & ParentInformation> = nameToLoad.type === RType.String ? nameToLoad : {
				type:     RType.String,
				info:     nameToLoad.info,
				lexeme:   nameToLoad.lexeme,
				location: nameToLoad.location,
				content:  {
					quotes: 'none',
					str:    Identifier.getName(nameToLoad.content)
				}
			};
			newArgs.push(newArg);
		}
		args =  wrapArgumentsUnnamed([...newArgs, ...args.slice(1)], data.completeAst.idMap);

	}
	const info = processKnownFunctionCall({
		name,
		args, rootId, data,
		hasUnknownSideEffect: false,
		origin:               BuiltInProcName.Library
	}).information;

	for(const p of packetName){
		const dependency = data.ctx.deps.getDependency(p);
		if(dependency){
			linkLibrary(dependency, info, rootId, data, spec);
		} else {
			info.graph.markIdForUnknownSideEffects(rootId);
		}
	}
	if(packetName.length === 0){
		info.graph.markIdForUnknownSideEffects(rootId);
	}
	return info;
}

/** The name of a symbol or string literal node, or `undefined` for anything else. */
function symbolOrStringName<Info>(node: RNode<Info> | undefined): string | undefined {
	if(node?.type === RType.Symbol){
		return Identifier.getName(node.content);
	}
	if(node?.type === RType.String){
		return node.content.str;
	}
	return undefined;
}

/** The string literals of a `"x"` or `c("x", "y")` node (used for `import::from`'s `.except`). */
function stringLiterals<Info>(node: RNode<Info>): string[] {
	if(node.type === RType.String){
		return [node.content.str];
	}
	if(RFunctionCall.isNamed(node) && Identifier.getName(node.functionName.content) === 'c'){
		return node.arguments.flatMap(a => a !== EmptyArgument && a.value?.type === RType.String ? [a.value.content.str] : []);
	}
	return [];
}

/** Parse `import::from(pkg, a, keep = filter, .all = TRUE, .except = c(...))` into which exports to attach. */
function parseFromSpec<Info>(args: readonly PotentiallyEmptyRArgument<Info>[]): AttachSpec {
	const include = new Map<string, string>();
	const exclude = new Set<string>();
	let all = false;
	for(let i = 1; i < args.length; i++){
		const arg = args[i];
		if(arg === EmptyArgument || arg.value === undefined){
			continue;
		}
		const argName = arg.name?.lexeme;
		if(argName === '.all'){
			all ||= RLogical.isTrue(arg.value);
			continue;
		}
		if(argName === '.except'){
			for(const s of stringLiterals(arg.value)){
				exclude.add(s);
			}
			all = true;
			continue;
		}
		if(argName?.startsWith('.')){
			continue; // other control args (.into, .library, ...) do not affect which exports resolve
		}
		const exported = symbolOrStringName(arg.value);
		if(exported !== undefined){
			include.set(argName ?? exported, exported);
		}
	}
	return {
		include: include.size > 0 ? include : undefined,
		exclude: exclude.size > 0 ? exclude : undefined,
		all:     all || exclude.size > 0
	};
}

/** Parse a `box::use` bracket argument (`pkg[a, b]` or `pkg[...]`) into a package and its attach spec; `undefined` if not a bracket. */
function parseBoxSpec<Info>(first: RNode<Info> | undefined): { pack: string, spec: AttachSpec } | undefined {
	if(first === undefined || !RAccess.isIndex(first)){
		return undefined;
	}
	const pack = symbolOrStringName(first.accessed);
	if(pack === undefined){
		return undefined;
	}
	const include = new Map<string, string>();
	let all = false;
	for(const el of first.access){
		if(el === EmptyArgument || el.value === undefined){
			continue;
		}
		if(el.value.type === RType.Symbol && Identifier.getName(el.value.content) === '...'){
			all = true; // use(pkg[...]) attaches every export
			continue;
		}
		const exported = symbolOrStringName(el.value);
		if(exported !== undefined){
			include.set(el.name?.lexeme ?? exported, exported);
		}
	}
	return { pack, spec: { include: include.size > 0 ? include : undefined, all } };
}

/** Whether `use` should be read as `box::use` here: a `box::`-qualified call, or `box` is a loaded dependency. */
function usesBoxSemantics<OtherInfo>(name: RSymbol<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): boolean {
	if(Identifier.getNamespace(name.content) === PkgName.Box){
		return true;
	}
	return data.ctx.deps.getDependency(PkgName.Box) !== undefined;
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
	const first = args[0] === EmptyArgument ? undefined : args[0]?.value;
	const parsed = parseUseSpec(name, first, args, data);
	const dependency = parsed && data.ctx.deps.getDependency(parsed.pack);
	if(parsed && dependency){
		linkLibrary(dependency, info, rootId, data, parsed.spec);
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
	if(bracket !== undefined){
		return bracket;
	}
	const pack = symbolOrStringName(first);
	if(pack === undefined){
		return undefined;
	}
	if(usesBoxSemantics(name, data)){
		return { pack, spec: { namespaceOnly: true } }; // box: use(pkg) is member access via pkg$fn
	}
	return { pack, spec: parseFromSpec(args) }; // extra-argument selection: use(pkg, a, b) / use(pkg)
}

/** Materialize the empty built-in function-definition vertex for a package export (idempotent). */
export function attachExportVertex(graph: DataflowGraph, builtInId: NodeId, environment: REnvironmentInformation, ctx: FlowrAnalyzerContext, cds?: ControlDependency[]): void {
	if(graph.hasVertex(builtInId)){
		return;
	}
	graph.addVertex({
		tag:        VertexType.FunctionDefinition,
		id:         builtInId,
		environment, cds, params:     {},
		subflow:    { graph: new Set(), unknownReferences: [], in: [], out: [], environment, entryPoint: builtInId, hooks: [] },
		exitPoints: [],
	}, ctx.env.makeCleanEnv());
}

function linkLibrary<OtherInfo>(dependency: Package, info: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, spec: AttachSpec = {}) {
	if(info.environment.level < 0 || isUndefined(dependency.namespaceInfo)){
		return;
	}
	const pack = dependency.name;
	// re-loading an already attached package is a no-op, cf. R's `search()`
	if(isAttached(info.environment.current, pack, spec.namespaceOnly)){
		return;
	}
	// by default only the environment carries the exports; their built-in vertices are materialized on
	// demand when a call resolves to one (see attachExportVertex). Eager mode registers them all upfront.
	if(data.ctx.config.solver.sigdb.eagerlyLoadExports){
		for(const { exported: func } of selectExports(getCallables(dependency.namespaceInfo), spec)){
			const builtInId = NodeId.toBuiltIn(Package.funcIdentif(pack, func));
			attachExportVertex(info.graph, builtInId, info.environment, data.ctx, data.cds);
			info.graph.addEdge(builtInId, rootId, EdgeType.Reads | EdgeType.Calls);
		}
	}
	info.environment = attachDependencyToEnvironment(dependency, info.environment, data.ctx, spec, rootId);
}

/** An export to attach: its name in the package and the name it is bound under (differs only when aliased). */
interface AttachedExport {
	readonly exported: string;
	readonly as:       string;
}

/** The exports of `callables` to attach under `spec` (see {@link AttachSpec}), resolving selection and aliasing. */
function selectExports(callables: readonly string[], spec: AttachSpec): AttachedExport[] {
	if(spec.include !== undefined && !spec.all){
		const available = new Set(callables);
		return Array.from(spec.include, ([as, exported]) => ({ exported, as })).filter(e => available.has(e.exported));
	}
	return callables.filter(c => !spec.exclude?.has(c)).map(c => ({ exported: c, as: c }));
}

/** The identifier definition binding a package export (or its alias) to its built-in function-definition. */
function exportDefinition(pack: string, exp: AttachedExport, definedAt: NodeId = NodeId.toBuiltIn(pack)) {
	return {
		name:   Identifier.make(exp.as, pack),
		type:   ReferenceType.Function,
		nodeId: NodeId.toBuiltIn(Package.funcIdentif(pack, exp.exported)),
		definedAt,
	} as const;
}

/** Whether a subset import restricts the attached exports, so no imports layer is materialized. */
function isSubsetAttach(spec: AttachSpec): boolean {
	return spec.include !== undefined && !spec.all;
}

/**
 * Attaches `dependency`'s exports below the global environment (see {@link attachPackageBelowGlobal}) and returns the
 * enriched environment (the graph is untouched). Used by `library()`, `import::from`, `box::use`, `requireNamespace`,
 * and the transitive side-effect propagation.
 */
export function attachDependencyToEnvironment(dependency: Package, envInfo: REnvironmentInformation, ctx: FlowrAnalyzerContext, spec: AttachSpec = {}, definedAt?: NodeId): REnvironmentInformation {
	const pack = dependency.name;
	if(isUndefined(dependency.namespaceInfo) || isAttached(envInfo.current, pack, spec.namespaceOnly)){
		return envInfo;
	}
	const exports = selectExports(getCallables(dependency.namespaceInfo), spec);
	if(spec.namespaceOnly || isSubsetAttach(spec)){
		const layerType = spec.namespaceOnly ? EnvType.LoadedNamespace : EnvType.Namespace;
		let layer = new Environment(envInfo.current).asLibrary(pack, layerType);
		for(const exp of exports){
			layer = layer.define(exportDefinition(pack, exp, definedAt));
		}
		return { level: envInfo.level, current: REnvironment.attachBelowGlobal(envInfo.current, layer, layer) };
	}
	// full attach: imports layer at the bottom, namespace (exports) layer on top
	let importsEnv = new Environment(envInfo.current).asLibrary(pack, EnvType.Imports);
	importsEnv = recImports(importsEnv, dependency.namespaceInfo, ctx, new Set());
	let namespaceEnv = new Environment(importsEnv).asLibrary(pack, EnvType.Namespace);
	for(const exp of exports){
		namespaceEnv = namespaceEnv.define(exportDefinition(pack, exp, definedAt));
	}
	return { level: envInfo.level, current: REnvironment.attachBelowGlobal(envInfo.current, namespaceEnv, importsEnv) };
}

/** A namespace-only load is subsumed by any layer for `pack`; a full attach ignores a mere {@link EnvType.LoadedNamespace}. */
function blocksAttach(layer: Environment, namespaceOnly: boolean | undefined): boolean {
	if(namespaceOnly){
		return true;
	}
	return layer.t !== EnvType.LoadedNamespace;
}

/** Whether package `pack` is already attached below the global env in a way that makes this (re-)attach a no-op. */
function isAttached(env: Environment, pack: string, namespaceOnly?: boolean): boolean {
	for(let e: Environment = REnvironment.findGlobal(env).parent; e.t !== undefined && !e.builtInEnv; e = e.parent){
		if(e.n === pack && blocksAttach(e, namespaceOnly)){
			return true;
		}
	}
	return false;
}

/**
 * The base search path is identical for a given built-in environment, assumed R version, base-package set and
 * loaded database, but building it is expensive (each export `define`s into a growing namespace layer, so a
 * package with N exports costs O(N^2)). We therefore build the immutable base-layer chain once and cache it,
 * keyed by exactly those inputs; every later analysis just drops its fresh global on top -- an O(1) reparent.
 * The layers are safe to share: `define`/`defineInNamespace` clone before mutating, so no analysis can alter
 * them, and the global is identified by a boolean flag (not a pointer), so a new global on top resolves right.
 */
const baseNamespaceLayerCache = new Map<string, REnvironmentInformation['current']>();

/** the exact inputs the base search path depends on: built-in env, assumed R version, base packages and loaded database (content hash) */
function baseNamespaceCacheKey(ctx: FlowrAnalyzerContext, basePackages: readonly string[]): string {
	return `${String(ctx.env.getCleanEnvFingerprint())}|${ctx.resolvedRVersion}|${basePackages.join(',')}|${JSON.stringify(ctx.deps.loadedPackageDatabases())}`;
}

/**
 * Attach the {@link baseRPackages|base-R} exports below the global environment so bare base calls resolve
 * without an explicit `library()`. Names with a registered built-in (e.g. `paste`, `c`) are skipped so the
 * base namespace never shadows flowR's built-in processors, and it is a no-op when no database resolves a base
 * package. The result is cached per unique input (see {@link baseNamespaceLayerCache}).
 */
export function attachBaseRNamespaces(env: REnvironmentInformation, ctx: FlowrAnalyzerContext): REnvironmentInformation {
	if(!ctx.config.solver.sigdb.linkBaseR || !ctx.deps.hasBaseRSource()){
		return env;
	}
	const basePackages = ctx.config.project.basePackages ?? baseRPackages(ctx.resolvedRVersion);
	const key = baseNamespaceCacheKey(ctx, basePackages);
	const cached = baseNamespaceLayerCache.get(key);
	if(cached !== undefined){
		env.current.parent = cached;   // reuse the precomputed base search path below this analysis's global
		return env;
	}
	let built = env;
	let builtinNames: ReadonlySet<string> | undefined;
	for(const pkg of basePackages){
		const dependency = ctx.deps.getDependency(pkg);
		if(dependency?.namespaceInfo === undefined){
			continue;
		}
		builtinNames ??= new Set([...ctx.env.builtInEnvironment.memory.keys()].map(String));
		built = attachDependencyToEnvironment(dependency, built, ctx, { exclude: builtinNames }, NodeId.toBuiltIn(pkg));
	}
	if(built.current.parent !== env.current.parent){   // at least one base package was actually attached
		baseNamespaceLayerCache.set(key, built.current.parent);
	}
	return built;
}

function recImports(importsEnv: Environment, namespaceInfo: NamespaceInfo, ctx: FlowrAnalyzerContext, alreadyImportedAll: Set<string>){
	for(const imp of namespaceInfo.importedPackages){
		const importedDependency = ctx.deps.getDependency(imp[0]);
		if(isUndefined(importedDependency)){
			continue;
		}
		const importedNs = importedDependency.namespaceInfo;
		const funcToImport: string[] | undefined = importedNs === undefined ? undefined
			: imp[1] === 'all' ? getCallables(importedNs) : getCallables(importedNs).filter(v => (imp[1] as string[]).includes(v));
		if(isUndefined(funcToImport)){
			continue;
		}
		if(alreadyImportedAll.has(importedDependency.name)){
			continue;
		}
		for(const func of funcToImport){
			if(importsEnv.memory.has(Package.funcIdentif(importedDependency.name, func))){
				continue;
			}
			importsEnv = importsEnv.define({
				name:      Identifier.make(Package.funcIdentif(importedDependency.name, func), importsEnv.n),
				type:      ReferenceType.Function,
				nodeId:    NodeId.toBuiltIn(Package.funcIdentif(importedDependency.name, func)),
				definedAt: NodeId.toBuiltIn(importedDependency.name)
			});
		}
		if(imp[1] === 'all'){
			alreadyImportedAll.add(importedDependency.name);
		}
		//if only importFrom() we don't have to recursively import
		if(imp[1] === 'all' && importedDependency?.namespaceInfo){
			importsEnv = recImports(importsEnv, importedDependency.namespaceInfo, ctx, alreadyImportedAll);
		}
	}
	return importsEnv;
}
