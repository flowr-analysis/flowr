import { executeQueriesOfSameType } from '../../query';
import { Attached, defaultDependencyCategories, type DefaultDependencyCategoryName, type DependenciesQuery, type DependenciesQueryResult, type DependencyCategoryName, type DependencyCategorySettings, type DependencyInfo, getAllCategories, Constant, Unknown } from './dependencies-query-format';
import type { CallContextQuery, CallContextQueryResult } from '../call-context-query/call-context-query-format';
import { DfgVertex, type DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { Identifier, PkgName } from '../../../dataflow/environments/identifier';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import type { BasicQueryData } from '../../base-query-format';
import { compactRecord } from '../../../util/objects';
import { type DependencyInfoLinkAttachedInfo, DependencyInfoLinkConstraint, type FunctionInfo } from './function-info/function-info';
import { CallTargets } from '../call-context-query/identify-link-to-last-call-relation';
import { getArgumentStringValue } from '../../../dataflow/eval/resolve/resolve-argument';
import type { DataflowInformation } from '../../../dataflow/info';
import type { FlowrConfig } from '../../../config';
import { guard } from '../../../util/assert';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { log } from '../../../util/log';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import { linkPlotsToDevices } from './link-devices';
import { uniqueArray } from '../../../util/collections/arrays';
import { attachesPackage } from './function-info/library-functions';
import { describePlots } from './plot-description';
import { assignmentOf, type FlowMemo, inputVariablesOf, makeFlowMemo } from './data-flow';
import { MatchArgs } from '../../../dataflow/graph/match-args';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { AttachedBasePackageSet, attachedBasePackages } from '../../../util/r-base-packages';

/**
 * Executes a dependencies query.
 */
export async function executeDependenciesQuery({
	analyzer,
}: BasicQueryData, queries: readonly DependenciesQuery[]): Promise<DependenciesQueryResult> {
	let query = queries[0];
	if(queries.length !== 1) {
		for(let i = 1; i < queries.length; i++) {
			const q = queries[i];
			query = {
				...query,
				enabledCategories:      query.enabledCategories === undefined && q.enabledCategories === undefined ? undefined : [...(query.enabledCategories ?? []), ...(q.enabledCategories ?? [])],
				ignoreDefaultFunctions: query.ignoreDefaultFunctions || q.ignoreDefaultFunctions,
				assumedPackages:        query.assumedPackages || q.assumedPackages,
				additionalCategories:   {
					...query.additionalCategories,
					...q.additionalCategories
				}
			};
		}
		log.info('Merged multiple dependencies queries into one:', query);
	}

	const data = { analyzer };

	const normalize = await analyzer.normalize();
	const dataflow = await analyzer.dataflow();
	const config = analyzer.flowrConfig;

	const now = Date.now();
	const ignoreDefault = query.ignoreDefaultFunctions ?? false;
	const ctx = analyzer.inspectContext();
	const functions = new Map<DependencyCategoryName, FunctionInfo[]>(Object.entries(defaultDependencyCategories(ctx)).map(([c, v]) =>
		[c, getFunctionsToCheck(query[`${c as DefaultDependencyCategoryName}Functions`], c, query.enabledCategories, ignoreDefault, v.functions)]));
	for(const [category, value] of Object.entries(query.additionalCategories ?? {})) {
		/* custom categories only use their "functions" collection and allow no additional functions in the object itself */
		const custom = getFunctionsToCheck(undefined, category, undefined, false, value.functions);
		functions.set(category, [...(functions.get(category) ?? []), ...custom]);
	}

	const queryResults = !functions.values().toArray().some(f => f.length > 0) ? { kinds: {}, '.meta': { timing: 0 } } :
		await executeQueriesOfSameType<CallContextQuery>(data, functions.entries().flatMap(makeCallContextQuery).toArray());
	const g = getAllCategories(queries, ctx);
	const enabled = query.enabledCategories;

	const run: QueryRun = { dataflow, config, normalize, memo: makeFlowMemo(), formals: formalsLookup(dataflow.graph, ctx) };
	/* the packages the code attaches decide which package a bare call further down belongs to */
	const library = getResults(g, run, queryResults, 'library', functions.get('library') ?? [], data);
	const attaching = library.filter(attachesPackage);
	const results = Object.fromEntries(await Promise.all(functions.entries().map(async([c, f]) => {
		const results = c === 'library' ? library : getResults(g, run, queryResults, c, f, data, attaching);
		/* only default categories allow additional analyses */
		if(enabled === undefined || enabled.includes(c)) {
			await g[c]?.additionalAnalysis?.(data, ignoreDefault, f, queryResults, results);
		}
		return [c, results];
	}))) as { [C in DependencyCategoryName]?: DependencyInfo[] };

	/* also without a device: a plot on screen has no file, but still has the addons drawn onto it */
	if(results.visualize?.length) {
		linkPlotsToDevices(results.write ?? [], results.visualize, dataflow, normalize, ctx);
		describePlots(results.write ?? [], results.visualize, run, ctx);
		inheritPlotInputs(results.visualize);
	}

	if(query.assumedPackages && (enabled === undefined || enabled.includes('library'))) {
		const explicit = new Set((results.library ?? []).map(r => r.value).filter((v): v is string => v !== undefined && v !== Unknown && v !== Constant));
		const assumed = assumedBasePackageEntries(dataflow.graph, ctx.resolvedRVersion, explicit);
		if(assumed.length > 0) {
			results.library = [...(results.library ?? []), ...assumed];
		}
	}

	return {
		'.meta': {
			timing: Date.now() - now
		},
		...results,
	} as DependenciesQueryResult;
}

/**
 * What one run of the query computes once and hands to every part: the analysis results, the memo of what is asked
 * about the same calls again and again, and the formals of the calls. Nothing of it outlives the run.
 */
export interface QueryRun {
	readonly dataflow:  DataflowInformation
	readonly config:    FlowrConfig
	readonly normalize: NormalizedAst
	readonly memo:      FlowMemo
	/** the formals of the call, give its qualified name if known already */
	readonly formals:   (vertex: DataflowGraphVertexFunctionCall, qualified?: Identifier) => readonly string[] | undefined
}

/** whether the call may reach a function definition of the code, whose formals differ from call to call */
function callsDefinition(dfg: DataflowGraph, id: NodeId): boolean {
	for(const [target, edge] of dfg.edgesFrom(id)) {
		if(DfEdge.includesType(edge, EdgeType.Calls) && !NodeId.isBuiltIn(target)) {
			return true;
		}
	}
	return false;
}

/**
 * The formals of a call (see {@link MatchArgs.formalsOf}), looked up once per function the calls reach among the
 * built-ins and the signature database, as decoding the database's entry is what makes this costly. A call that
 * may reach a definition of the code is asked directly, its formals are in the AST.
 */
function formalsLookup(dfg: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): QueryRun['formals'] {
	const byFunction = new Map<string, readonly string[] | undefined>();
	return (vertex, qualified) => {
		const call = dfg.idMap?.get(vertex.id);
		if(!RFunctionCall.is(call)) {
			return undefined;
		} else if(callsDefinition(dfg, vertex.id)) {
			return MatchArgs.formalsOf(call, dfg, ctx);
		}
		const key = Identifier.toString(qualified ?? Dataflow.qualify(vertex.id, dfg, false) ?? vertex.name);
		if(!byFunction.has(key)) {
			byFunction.set(key, MatchArgs.formalsOf(call, dfg, ctx));
		}
		return byFunction.get(key);
	};
}

/** One implicit `library` entry per attached base package that the graph uses but that is not loaded explicitly. */
function assumedBasePackageEntries(dfg: DataflowGraph, rVersion: string, explicit: ReadonlySet<string>): DependencyInfo[] {
	const used: { id: NodeId, pkg: string }[] = [];
	for(const [id, qualified] of Dataflow.qualifyAll(dfg, true)) {
		const pkg = Identifier.getNamespace(qualified);
		if(pkg !== undefined && !explicit.has(pkg) && AttachedBasePackageSet.has(pkg)) {
			used.push({ id, pkg });
		}
	}
	const usedBy = Map.groupBy(used, u => u.pkg);
	return attachedBasePackages(rVersion).filter(pkg => usedBy.has(pkg)).map(pkg => compactRecord({
		functionName:   Attached,
		value:          pkg,
		implicit:       true,
		alwaysAttached: pkg === PkgName.Base ? true : undefined,
		linkedIds:      usedBy.get(pkg)?.map(u => u.id)
	}) as DependencyInfo);
}

function makeCallContextQuery(this: void, [kind, functions]: [DependencyCategoryName, readonly FunctionInfo[]]): CallContextQuery[] {
	return functions.map(f => ({
		type:           'call-context',
		callName:       f.name,
		callTargets:    CallTargets.MustIncludeGlobal,
		includeAliases: false,
		callNameExact:  true,
		subkind:        f.name,
		linkTo:         f.linkTo,
		kind
	}));
}

/** An addon draws the data of the plot it builds (`geom_point()` that of `ggplot(df)`), unless it is given its own. */
function inheritPlotInputs(plots: DependencyInfo[]): void {
	const inputsOf = new Map(plots.flatMap(p => p.nodeId === undefined || p.linkedIds?.length ? [] : [[p.nodeId, p.inputVariables ?? []] as const]));
	for(const [at, plot] of plots.entries()) {
		const inherited = plot.inputVariables === undefined ? uniqueArray(plot.linkedIds?.flatMap(root => inputsOf.get(root) ?? []) ?? []) : [];
		if(inherited.length > 0) {
			plots[at] = { ...plot, inputVariables: inherited };
		}
	}
}

/** the categories whose calls consume data, and the ones that produce it, see {@link DependencyInfo#inputVariables} and {@link DependencyInfo#assignedTo} */
const ConsumingCategories: ReadonlySet<DependencyCategoryName> = new Set(['write', 'visualize', 'transform']);
const ProducingCategories: ReadonlySet<DependencyCategoryName> = new Set(['read', 'visualize', 'transform']);

function dataFlowOf(kind: DependencyCategoryName, call: DataflowGraphVertexFunctionCall, { dataflow, normalize, memo }: QueryRun): Pick<DependencyInfo, 'inputVariables' | 'assignedTo'> {
	const input = ConsumingCategories.has(kind) ? inputVariablesOf(dataflow, normalize, call, memo) : [];
	return {
		inputVariables: input.length > 0 ? input : undefined,
		assignedTo:     ProducingCategories.has(kind) ? assignmentOf(dataflow, normalize, call.id, memo)?.name : undefined
	};
}

/**
 * The package a call belongs to: the one written, else the one it resolves to. A bare call that resolves to nothing is
 * the base package exporting it (`stats` for `filter`), unless the project loads a package the category declares
 * the name for, which then masks the base one as in R.
 */
function namespaceOf(id: NodeId, functionName: Identifier, dfg: DataflowGraph, candidates: readonly FunctionInfo[], isLoaded: (pkg: string) => boolean): string | undefined {
	const written = Identifier.getNamespace(functionName);
	if(written !== undefined || candidates.some(c => c.package !== undefined && isLoaded(c.package))) {
		return written;
	}
	const qualified = Dataflow.qualify(id, dfg, true);
	return qualified === undefined ? undefined : Identifier.getNamespace(qualified);
}

/** the packages attached by the loader calls the call `id` resolves its definition through */
function attachingPackagesOf(id: NodeId, dfg: DataflowGraph, attaching: readonly DependencyInfo[]): ReadonlySet<string> {
	if(attaching.length === 0) {
		return new Set();
	}
	const targets = new Set(Dataflow.callTargetsOf(id, dfg));
	return new Set(attaching.flatMap(a => a.nodeId !== undefined && a.value !== undefined && targets.has(a.nodeId) ? [a.value] : []));
}

const readOnlyModes = new Set(['r', 'rt', 'rb']);
const writeOnlyModes = new Set(['w', 'wt', 'wb', 'a', 'at', 'ab']);

/**
 * The entry to use for a call, out of everything the category declares under that name: several packages may
 * export the same function with different arguments, so the entry of the package the call resolves to wins.
 * A call qualified to a package no entry declares is none of them, an unqualified call that cannot be pinned
 * down goes to the entry of a package the project loads, and only then to the first one able to apply.
 */
function pickFunctionInfo(candidates: readonly FunctionInfo[], callNamespace: string | undefined, isLoaded: (pkg: string) => boolean): FunctionInfo | undefined {
	if(callNamespace !== undefined) {
		return candidates.find(c => c.package === callNamespace) ?? candidates.find(c => c.package === undefined);
	} else if(candidates.length === 1) {
		return candidates[0];
	}
	return candidates.find(c => c.package !== undefined && isLoaded(c.package)) ?? candidates[0];
}

function getResults(categories: Record<DependencyCategoryName, DependencyCategorySettings>, run: QueryRun, results: CallContextQueryResult, kind: DependencyCategoryName, functions: FunctionInfo[], data: BasicQueryData, attaching: readonly DependencyInfo[] = []): DependencyInfo[] {
	const { dataflow, config, normalize } = run;
	const defaultValue = categories[kind].defaultValue;
	const vars = config.solver.variables;
	const functionMap = Map.groupBy(functions, f => f.name);
	const kindEntries = Object.entries(results?.kinds[kind]?.subkinds ?? {});
	const finalResults: DependencyInfo[] = [];
	const ictx = data.analyzer.inspectContext();
	const d = ictx.deps;
	/* only asked when a name is declared by more than one package, keeping the resolution it may trigger off the common path */
	let loadedPackages: ReadonlySet<string> | undefined;
	const isLoadedPackage = (pkg: string) => (loadedPackages ??= new Set([...d.getDependencies().map(p => p.name), ...config.solver.assumeAttachedPackages ?? []])).has(pkg);
	const dfg = dataflow.graph;
	for(const [name, results] of kindEntries) {
		for(const { id, linkedIds } of results) {
			const vertex = dfg.getVertex(id) as DataflowGraphVertexFunctionCall;
			const functionName = Dataflow.qualify(id, dfg, false) ?? vertex.name;
			const candidates = functionMap.get(name) as readonly FunctionInfo[];
			/* a package whose attached definition the call resolves to is loaded there, as R resolves the bare name to it;
			 * only asked when a name is declared for a package, which is what makes it worth the call targets */
			let attachedBy: ReadonlySet<string> | undefined;
			const isLoaded = (pkg: string) => (attachedBy ??= attachingPackagesOf(id, dfg, attaching)).has(pkg) || isLoadedPackage(pkg);
			const info = pickFunctionInfo(candidates, namespaceOf(id, functionName, dfg, candidates, isLoaded), isLoaded);
			if(info === undefined) {
				continue;
			}
			const formals = run.formals(vertex, functionName);
			const args = getArgumentStringValue(vars, dfg, vertex, info.argIdx, info.argName, info.resolveValue, ictx, formals);
			const linkedArgs = collectValuesFromLinks(args, { dataflow, config, ctx: ictx, formals: run.formals }, linkedIds as (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined);
			const linked = linkedIds?.map(linkedId => typeof linkedId === 'object' ? linkedId.id : linkedId);
			const ignoreOnArgVal = () => {
				if(info.ignoreIf !== 'arg-true' && info.ignoreIf !== 'arg-false') {
					return false;
				}
				const margs = info.additionalArgs?.val;
				guard(margs, 'Need additional argument val when checking for arg-true');
				const valArgs = getArgumentStringValue(vars, dfg, vertex, margs.argIdx, margs.argName, margs.resolveValue, ictx, formals);
				const valValues = valArgs?.values().flatMap(v => Array.from(v)).toArray() ?? [];
				/* ignore only if every value is the one the check asks for */
				const ignoredValue = info.ignoreIf === 'arg-true' ? 'TRUE' : 'FALSE';
				return valValues.length > 0 && valValues.every(v => v === ignoredValue);
			};
			const ignoreOnArgSet = () => {
				if(info.ignoreIf !== 'arg-set') {
					return;
				}
				const hasArg = (name?: string, index?: number | 'unnamed') => vertex.args.some((arg, idx) =>
					FunctionArgument.isNamed(arg) && arg.name === name ||
					FunctionArgument.isPositional(arg) && idx === index
				);
				if(hasArg(info.argName, info.argIdx)) {
					return false;
				}
				const margs = info.additionalArgs?.argSet;
				guard(margs, 'Need additional argument argSet when checking for arg-set');
				return hasArg(margs.argName, margs.argIdx);
			};
			const flow = dataFlowOf(kind, vertex, run);
			const foundValues = linkedArgs ?? args;
			if(!foundValues) {
				if(info.ignoreIf !== 'arg-missing' && !ignoreOnArgVal() && !ignoreOnArgSet()) {
					finalResults.push(compactRecord({
						nodeId:           id,
						functionName,
						lexemeOfArgument: undefined,
						linkedIds:        linked?.length ? linked : undefined,
						...flow,
						value:            info.defaultValue ?? defaultValue
					} as DependencyInfo));
				}
				continue;
			} else if(info.ignoreIf === 'mode-only-read' || info.ignoreIf === 'mode-only-write') {
				const margs = info.additionalArgs?.mode;
				guard(margs, 'Need additional argument mode when checking for mode');
				const modes = info.ignoreIf === 'mode-only-read' ? readOnlyModes : writeOnlyModes;
				const modeArgs = getArgumentStringValue(vars, dfg, vertex, margs.argIdx, margs.argName, margs.resolveValue, ictx, formals);
				const modeValues = modeArgs?.values().flatMap(v => Array.from(v)) ?? [];
				/* all modes are read-only (resp. write-only), so we can ignore this */
				if(modeValues.every(m => m && modes.has(m))) {
					continue;
				}
			} else if(ignoreOnArgVal() || ignoreOnArgSet()) {
				continue;
			}
			for(const [arg, values] of foundValues.entries()) {
				for(const value of values) {
					let resolvedValue = value;
					if(info.stringReplacements && value !== undefined && Object.hasOwn(info.stringReplacements, value)) {
						resolvedValue = info.stringReplacements[value];
					}
					const dep = resolvedValue ? d.getDependency(resolvedValue) ?? undefined : undefined;
					const lexeme = unresolvedArgumentCode(value, arg);
					finalResults.push(compactRecord({
						nodeId:             id,
						functionName,
						/* only a value we could not make sense of is worth asking about further */
						argumentId:         lexeme === undefined ? undefined : arg,
						lexemeOfArgument:   lexeme,
						linkedIds:          linked?.length ? linked : undefined,
						...flow,
						value:              resolvedValue ?? info.defaultValue ?? defaultValue,
						versionConstraints: dep?.versionConstraints,
						derivedRange:       dep?.effectiveRange,
						namespaceInfo:      dep?.namespaceInfo
					} as DependencyInfo));
				}
			}
		}
	}

	return finalResults;

	function unresolvedArgumentCode(argument: string | undefined, id: NodeId | undefined) {
		if((argument && argument !== Unknown && argument !== Constant) || !id) {
			return undefined;
		}
		return RNode.lexeme(RArgument.valueOf(normalize.idMap.get(id)));
	}
}

function collectValuesFromLinks(args: Map<NodeId, Set<string | undefined>> | undefined, data: { dataflow: DataflowInformation, config: FlowrConfig, ctx: ReadOnlyFlowrAnalyzerContext, formals: QueryRun['formals'] }, linkedIds: readonly (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined): Map<NodeId, Set<string | undefined>> | undefined {
	if(!linkedIds || linkedIds.length === 0) {
		return undefined;
	}
	const hasAtLeastAValue = args !== undefined && args.values().flatMap(x => Array.from(x)).toArray().some(v => v !== Unknown && v !== Constant && v !== undefined);
	const map = new Map<NodeId, Set<string | undefined>>();
	for(const linkedId of linkedIds) {
		if(typeof linkedId !== 'object' || !linkedId.info) {
			continue;
		}
		const info = linkedId.info;
		if(hasAtLeastAValue && info.when !== DependencyInfoLinkConstraint.Always) {
			continue;
		}
		const vertex = data.dataflow.graph.getVertex(linkedId.id);
		if(!DfgVertex.isFunctionCall(vertex)) {
			continue;
		}
		const args = getArgumentStringValue(data.config.solver.variables, data.dataflow.graph, vertex, info.argIdx, info.argName, info.resolveValue, data.ctx, data.formals(vertex));
		for(const [arg, values] of args?.entries() ?? []) {
			map.set(arg, (map.get(arg) ?? new Set()).union(values));
		}
	}
	return map.size ? map : undefined;
}

function getFunctionsToCheck(customFunctions: readonly FunctionInfo[] | undefined, functionFlag: DependencyCategoryName, enabled: readonly DependencyCategoryName[] | undefined, ignoreDefaultFunctions: boolean, defaultFunctions: readonly FunctionInfo[]): FunctionInfo[] {
	if(enabled !== undefined && !enabled.includes(functionFlag)) {
		return [];
	}
	return [...(ignoreDefaultFunctions ? [] : defaultFunctions), ...(customFunctions ?? [])];
}
