import { executeQueriesOfSameType } from '../../query';
import {
	type DefaultDependencyCategoryName,
	type DependenciesQuery,
	type DependenciesQueryResult,
	type DependencyCategoryName,
	type DependencyCategorySettings,
	type DependencyInfo
	, DefaultDependencyCategories, getAllCategories, Unknown } from './dependencies-query-format';
import type { CallContextQuery, CallContextQueryResult } from '../call-context-query/call-context-query-format';
import { type DataflowGraphVertexFunctionCall , VertexType } from '../../../dataflow/graph/vertex';
import { log } from '../../../util/log';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { BasicQueryData } from '../../base-query-format';
import { compactRecord } from '../../../util/objects';
import { type DependencyInfoLinkAttachedInfo, type FunctionInfo , DependencyInfoLinkConstraint } from './function-info/function-info';
import { CallTargets } from '../call-context-query/identify-link-to-last-call-relation';
import { getArgumentStringValue } from '../../../dataflow/eval/resolve/resolve-argument';
import type { DataflowInformation } from '../../../dataflow/info';
import type { FlowrConfigOptions } from '../../../config';
import { guard } from '../../../util/assert';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';


/**
 * Executes a dependencies query.
 */
export async function executeDependenciesQuery({
	analyzer,
}: BasicQueryData, queries: readonly DependenciesQuery[]): Promise<DependenciesQueryResult> {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length, 'only using the first query');
	}

	const data = { analyzer };

	const normalize = await analyzer.normalize();
	const dataflow = await analyzer.dataflow();
	const config = analyzer.flowrConfig;

	const now = Date.now();
	const [query] = queries;
	const ignoreDefault = query.ignoreDefaultFunctions ?? false;
	const functions = new Map<DependencyCategoryName, FunctionInfo[]>(Object.entries(DefaultDependencyCategories).map(([c,v]) => {
		return [c, getFunctionsToCheck(query[`${c as DefaultDependencyCategoryName}Functions`], c, query.enabledCategories, ignoreDefault, v.functions)];
	}));
	if(query.additionalCategories !== undefined){
		for(const [category, value] of Object.entries(query.additionalCategories)) {
			// custom categories only use the "functions" collection and do not allow specifying additional functions in the object itself, so we "undefined" a lot here
			functions.set(category, getFunctionsToCheck(undefined, category, undefined, false, value.functions));
		}
	}

	const queryResults = functions.values().toArray().flat().length === 0 ? { kinds: {}, '.meta': { timing: 0 } } :
		await executeQueriesOfSameType<CallContextQuery>(data, functions.entries().map(([c, f]) => makeCallContextQuery(f, c)).toArray().flat());

	const results = Object.fromEntries(await Promise.all(functions.entries().map(async([c, f]) => {
		const results = getResults(queries, { dataflow, config, normalize }, queryResults, c, f, data);
		// only default categories allow additional analyses, so we null-coalesce here!
		await (DefaultDependencyCategories as Record<string, DependencyCategorySettings>)[c]?.additionalAnalysis?.(data, ignoreDefault, f, queryResults, results);
		return [c, results];
	}))) as {[C in DependencyCategoryName]?: DependencyInfo[]};

	return {
		'.meta': {
			timing: Date.now() - now
		},
		...results,
	} as DependenciesQueryResult;
}

function makeCallContextQuery(functions: readonly FunctionInfo[], kind: DependencyCategoryName): CallContextQuery[] {
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

function dropInfoOnLinkedIds(linkedIds: readonly (NodeId | { id: NodeId, info: object })[] | undefined): NodeId[] | undefined{
	if(!linkedIds) {
		return undefined;
	}
	return linkedIds.map(id => typeof id === 'object' ? id.id : id);
}

const readOnlyModes = new Set(['r', 'rt', 'rb']);
const writeOnlyModes = new Set(['w', 'wt', 'wb', 'a', 'at', 'ab']);

function getResults(queries: readonly DependenciesQuery[], { dataflow, config, normalize }: { dataflow: DataflowInformation, config: FlowrConfigOptions, normalize: NormalizedAst }, results: CallContextQueryResult, kind: DependencyCategoryName, functions: FunctionInfo[], data?: BasicQueryData): DependencyInfo[] {
	const defaultValue = getAllCategories(queries)[kind].defaultValue;
	const functionMap = new Map<string, FunctionInfo>(functions.map(f => [f.name, f]));
	const kindEntries = Object.entries(results?.kinds[kind]?.subkinds ?? {});
	return kindEntries.flatMap(([name, results]) => results.flatMap(({ id, linkedIds }) => {
		const vertex = dataflow.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = functionMap.get(name) as FunctionInfo;

		const args = getArgumentStringValue(config.solver.variables, dataflow.graph, vertex, info.argIdx, info.argName, info.resolveValue);
		const linkedArgs = collectValuesFromLinks(args, { dataflow, config }, linkedIds as (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined);
		const linked = dropInfoOnLinkedIds(linkedIds);

		const foundValues = linkedArgs ?? args;
		if(!foundValues) {
			if(info.ignoreIf === 'arg-missing') {
				return [];
			}
			const record = compactRecord({
				nodeId:           id,
				functionName:     vertex.name,
				lexemeOfArgument: undefined,
				linkedIds:        linked?.length ? linked : undefined,
				value:            defaultValue
			} as DependencyInfo);
			return record ? [record] : [];
		} else if(info.ignoreIf === 'mode-only-read' || info.ignoreIf === 'mode-only-write') {
			guard('mode' in (info.additionalArgs ?? {}), 'Need additional argument mode when checking for mode');
			const margs = info.additionalArgs?.mode;
			guard(margs, 'Need additional argument mode when checking for mode');
			const modeArgs = getArgumentStringValue(config.solver.variables, dataflow.graph, vertex, margs.argIdx, margs.argName, margs.resolveValue);
			const modeValues = modeArgs?.values().flatMap(v => [...v]) ?? [];
			if(info.ignoreIf === 'mode-only-read' && modeValues.every(m => m && readOnlyModes.has(m))) {
				// all modes are read-only, so we can ignore this
				return [];
			} else if(info.ignoreIf === 'mode-only-write' && modeValues.every(m => m && writeOnlyModes.has(m))) {
				// all modes are write-only, so we can ignore this
				return [];
			}
		}
		const results: DependencyInfo[] = [];
		for(const [arg, values] of foundValues.entries()) {
			for(const value of values) {
				const dep = value ? data?.analyzer.inspectContext().deps.getDependency(value) ?? undefined : undefined;
				const result = compactRecord({
					nodeId:             id,
					functionName:       vertex.name,
					lexemeOfArgument:   getLexeme(value, arg),
					linkedIds:          linked?.length ? linked : undefined,
					value:              value ?? defaultValue,
					versionConstraints: dep?.versionConstraints,
					derivedVersion:     dep?.derivedVersion
				} as DependencyInfo);
				if(result) {
					results.push(result);
				}
			}
		}
		return results;
	})) ?? [];

	function getLexeme(argument: string | undefined | typeof Unknown, id: NodeId | undefined) {
		if((argument && argument !== Unknown) || !id) {
			return undefined;
		}
		let get = normalize.idMap.get(id);
		if(get?.type === RType.Argument) {
			get = get.value;
		}
		return get?.info.fullLexeme ?? get?.lexeme;
	}
}

function collectValuesFromLinks(args: Map<NodeId, Set<string|undefined>> | undefined, data: { dataflow: DataflowInformation, config: FlowrConfigOptions }, linkedIds: readonly (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined): Map<NodeId, Set<string|undefined>> | undefined {
	if(!linkedIds || linkedIds.length === 0) {
		return undefined;
	}
	const hasAtLeastAValue = args !== undefined && [...args.values()].some(set => [...set].some(v => v !== Unknown && v !== undefined));
	const map = new Map<NodeId, Set<string|undefined>>();
	for(const linkedId of linkedIds) {
		if(typeof linkedId !== 'object' || !linkedId.info) {
			continue;
		}
		const info = linkedId.info;
		// do not collect this one
		if(hasAtLeastAValue && info.when !== DependencyInfoLinkConstraint.Always) {
			continue;
		}
		// collect this one!
		const vertex = data.dataflow.graph.getVertex(linkedId.id);
		if(vertex === undefined || vertex.tag !== VertexType.FunctionCall) {
			continue;
		}
		const args = getArgumentStringValue(data.config.solver.variables, data.dataflow.graph, vertex, info.argIdx, info.argName, info.resolveValue);
		if(args === undefined) {
			continue;
		}
		for(const [arg, values] of args.entries()) {
			const set = map.get(arg) ?? new Set();
			map.set(arg, set);
			for(const value of values) {
				set.add(value);
			}
		}
	}
	return map.size ? map : undefined;
}

function getFunctionsToCheck(customFunctions: readonly FunctionInfo[] | undefined, functionFlag: DependencyCategoryName, enabled: DependencyCategoryName[] | undefined, ignoreDefaultFunctions: boolean, defaultFunctions: readonly FunctionInfo[]): FunctionInfo[] {
	// "If unset or empty, all function types are searched for."
	if(enabled?.length && enabled.indexOf(functionFlag) < 0) {
		return [];
	}
	let functions: FunctionInfo[] = ignoreDefaultFunctions ? [] : [...defaultFunctions];
	if(customFunctions) {
		functions = functions.concat(customFunctions);
	}
	return functions;
}
