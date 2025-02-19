import { executeQueriesOfSameType } from '../../query';
import type {
	DependenciesQuery,
	DependenciesQueryResult,
	DependencyInfo,
	DependencyInfoLinkAttachedInfo,
	FunctionInfo,
	LibraryInfo,
	ReadInfo,
	SourceInfo,
	WriteInfo
} from './dependencies-query-format';
import {
	DependencyInfoLinkConstraint,
	LibraryFunctions,
	ReadFunctions,
	SourceFunctions,
	Unknown,
	WriteFunctions
} from './dependencies-query-format';
import type { CallContextQuery, CallContextQueryResult } from '../call-context-query/call-context-query-format';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { log } from '../../../util/log';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { visitAst } from '../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';
import { compactRecord } from '../../../util/objects';
import { resolveIdToValue } from '../../../dataflow/environments/resolve-by-name';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from '../../../dataflow/environments/environment';
import type { RNumberValue, RStringValue } from '../../../r-bridge/lang-4.x/convert-values';
import type { RLogicalValue } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';

function collectNamespaceAccesses(data: BasicQueryData, libraries: LibraryInfo[]) {
	/* for libraries, we have to additionally track all uses of `::` and `:::`, for this we currently simply traverse all uses */
	visitAst(data.ast.ast, n => {
		if(n.type === RType.Symbol && n.namespace) {
			/* we should improve the identification of ':::' */
			libraries.push({
				nodeId:       n.info.id,
				functionName: (n.info.fullLexeme ?? n.lexeme).includes(':::') ? ':::' : '::',
				libraryName:  n.namespace
			});
		}
	});
}

export function executeDependenciesQuery(data: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length, 'only using the first query');
	}
	const now = Date.now();

	const [query] = queries;
	const ignoreDefault = query.ignoreDefaultFunctions ?? false;
	const libraryFunctions = getFunctionsToCheck(query.libraryFunctions, ignoreDefault, LibraryFunctions);
	const sourceFunctions = getFunctionsToCheck(query.sourceFunctions, ignoreDefault, SourceFunctions);
	const readFunctions = getFunctionsToCheck(query.readFunctions, ignoreDefault, ReadFunctions);
	const writeFunctions = getFunctionsToCheck(query.writeFunctions, ignoreDefault, WriteFunctions);

	const numberOfFunctions = libraryFunctions.length + sourceFunctions.length + readFunctions.length + writeFunctions.length;

	const results = numberOfFunctions === 0 ? { kinds: {}, '.meta': { timing: 0 } } : executeQueriesOfSameType<CallContextQuery>(data,
		...makeCallContextQuery(libraryFunctions, 'library'),
		...makeCallContextQuery(sourceFunctions, 'source'),
		...makeCallContextQuery(readFunctions, 'read'),
		...makeCallContextQuery(writeFunctions, 'write')
	);

	function getLexeme(argument: string | undefined | typeof Unknown, id: NodeId | undefined) {
		if((argument && argument !== Unknown) || !id) {
			return undefined;
		}
		let get = data.ast.idMap.get(id);
		if(get?.type === RType.Argument) {
			get = get.value;
		}
		return get?.info.fullLexeme ?? get?.lexeme;
	}

	const libraries: LibraryInfo[] = getResults(data, results, 'library', libraryFunctions, (id, vertex, argId, value, linkedIds) => ({
		nodeId:           id,
		functionName:     vertex.name,
		lexemeOfArgument: getLexeme(value, argId),
		libraryName:      value ?? Unknown,
		linkedIds:        linkedIds?.length ? linkedIds : undefined
	}));

	if(!ignoreDefault) {
		collectNamespaceAccesses(data, libraries);
	}

	const sourcedFiles: SourceInfo[] = getResults(data, results, 'source', sourceFunctions, (id, vertex, argId, value, linkedIds) => ({
		nodeId:           id,
		functionName:     vertex.name,
		file:             value ?? Unknown,
		lexemeOfArgument: getLexeme(value, argId),
		linkedIds:        linkedIds?.length ? linkedIds : undefined
	}));
	const readData: ReadInfo[] = getResults(data, results, 'read', readFunctions, (id, vertex, argId, value, linkedIds) => ({
		nodeId:           id,
		functionName:     vertex.name,
		source:           value ?? Unknown,
		lexemeOfArgument: getLexeme(value, argId),
		linkedIds:        linkedIds?.length ? linkedIds : undefined
	}));
	const writtenData: WriteInfo[] = getResults(data, results, 'write', writeFunctions, (id, vertex, argId, value, linkedIds) => ({
		nodeId:           id,
		functionName:     vertex.name,
		// write functions that don't have argIndex are assumed to write to stdout
		destination:      value ?? 'stdout',
		lexemeOfArgument: getLexeme(value, argId),
		linkedIds:        linkedIds?.length? linkedIds : undefined
	}));

	return {
		'.meta': {
			timing: Date.now() - now
		},
		libraries, sourcedFiles, readData, writtenData
	};
}

function makeCallContextQuery(functions: readonly FunctionInfo[], kind: string): CallContextQuery[] {
	return functions.map(f => ({
		type:           'call-context',
		callName:       f.name,
		includeAliases: false,
		callNameExact:  true,
		subkind:        f.name,
		linkTo:         f.linkTo,
		kind
	}));
}

type MakeDependencyInfo<T extends DependencyInfo> = (
	id: NodeId,
	vertex: DataflowGraphVertexFunctionCall,
	argumentId: NodeId | undefined,
	argumentValue: string | undefined,
	linkedIds: undefined | readonly NodeId[]
) => T | undefined;

function dropInfoOnLinkedIds(linkedIds: readonly (NodeId | { id: NodeId, info: object })[] | undefined): NodeId[] | undefined{
	if(!linkedIds) {
		return undefined;
	}
	return linkedIds.map(id => typeof id === 'object' ? id.id : id);
}

function getResults<T extends DependencyInfo>(data: BasicQueryData, results: CallContextQueryResult, kind: string, functions: FunctionInfo[], makeInfo: MakeDependencyInfo<T>): T[] {
	const kindEntries = Object.entries(results?.kinds[kind]?.subkinds ?? {});
	return kindEntries.flatMap(([name, results]) => results.flatMap(({ id, linkedIds }) => {
		const vertex = data.dataflow.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = functions.find(f => f.name === name) as FunctionInfo;

		const args = getArgumentValue(data, vertex, info.argIdx, info.argName, info.resolveValue);
		const linkedArgs = collectValuesFromLinks(args, data, linkedIds as (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined);

		const foundValues = linkedArgs ?? args;
		if(!foundValues) {
			const record = compactRecord(makeInfo(id, vertex, undefined, undefined, dropInfoOnLinkedIds(linkedIds)));
			return record ? [record as T] : [];
		}
		const results: T[] = [];
		for(const [arg, values] of foundValues.entries()) {
			for(const value of values) {
				const result = compactRecord(makeInfo(id, vertex, arg, value, dropInfoOnLinkedIds(linkedIds)));
				if(result) {
					results.push(result as T);
				}
			}
		}
		return results;
	})) ?? [];
}

function collectValuesFromLinks(args: Map<NodeId, Set<string|undefined>> | undefined, data: BasicQueryData, linkedIds: readonly (NodeId | { id: NodeId, info: DependencyInfoLinkAttachedInfo })[] | undefined): Map<NodeId, Set<string|undefined>> | undefined {
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
		const args = getArgumentValue(data, vertex, info.argIdx, info.argName, info.resolveValue);
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

function hasCharacterOnly(data: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, idMap: Map<NodeId, RNode> | undefined): boolean | 'maybe' {
	if(!vertex.args || vertex.args.length === 0 || !idMap) {
		return false;
	}
	const treatAsChar = getArgumentValue(data, vertex, 5, 'character.only', true);
	if(!treatAsChar) {
		return false;
	}
	const hasTrue = [...treatAsChar.values()].some(set => set?.has('TRUE'));
	const hasFalse = hasTrue ? [...treatAsChar.values()].some(set => set === undefined || set.has('FALSE')) : false;
	if(hasTrue && hasFalse) {
		return 'maybe';
	} else {
		return hasTrue;
	}
}
function resolveBasedOnConfig(data: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, argument: RNodeWithParent, environment: REnvironmentInformation | undefined, idMap: Map<NodeId, RNode> | undefined, resolveValue : boolean | 'library' | undefined): unknown[] | undefined {
	let full = true;
	if(!resolveValue) {
		full = false;
	}
	if(resolveValue === 'library') {
		const hasChar = hasCharacterOnly(data, vertex, idMap);
		if(hasChar === false) {
			if(argument.type === RType.Symbol) {
				return [argument.lexeme];
			}
			full = false;
		}
	}

	return resolveIdToValue(argument, { environment, graph: data.dataflow.graph, full });
}

function unwrapRValue(value: RLogicalValue | RStringValue | RNumberValue | string | number | unknown): string | undefined {
	if(value === undefined) {
		return undefined;
	}
	switch(typeof value) {
		case 'string':
			return value;
		case 'number':
			return value.toString();
		case 'boolean':
			return value ? 'TRUE' : 'FALSE';
	}
	if(typeof value !== 'object' || value === null) {
		return JSON.stringify(value);
	}
	if('str' in value) {
		return (value as RStringValue).str;
	} else if('num' in value) {
		return (value as RNumberValue).num.toString();
	} else {
		return JSON.stringify(value);
	}
}
/**
 * Get the values of all arguments matching the criteria.
 */
function getArgumentValue(
	data: BasicQueryData,
	vertex: DataflowGraphVertexFunctionCall,
	argumentIndex: number | 'unnamed' | undefined,
	argumentName: string | undefined,
	resolveValue : boolean | 'library' | undefined
): Map<NodeId, Set<string|undefined>> | undefined {
	const graph = data.dataflow.graph;
	if(argumentName) {
		const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === argumentName);
		if(arg >= 0) {
			argumentIndex = arg;
		}
	}
	if(!vertex || argumentIndex === undefined) {
		return undefined;
	}
	if(argumentIndex === 'unnamed') {
		// return all unnamed arguments
		const references = vertex.args.filter(arg => arg !== EmptyArgument && !arg.name).map(getReferenceOfArgument).filter(isNotUndefined);

		const map = new Map<NodeId, Set<string|undefined>>();
		for(const ref of references) {
			let valueNode = graph.idMap?.get(ref);
			if(valueNode?.type === RType.Argument) {
				valueNode = valueNode.value;
			}
			if(valueNode) {
				// TDODO: extend vector support etc.
				// this should be evaluated in the callee-context
				const values = resolveBasedOnConfig(data, vertex, valueNode, vertex.environment, graph.idMap, resolveValue)
					?.map(unwrapRValue) ?? [Unknown];
				map.set(ref, new Set(values));
			}
		}
		return map;
	}
	if(vertex.args.length > argumentIndex) {
		const arg = getReferenceOfArgument(vertex.args[argumentIndex]);
		if(!arg) {
			return undefined;
		}
		let valueNode = graph.idMap?.get(arg);
		if(valueNode?.type === RType.Argument) {
			valueNode = valueNode.value;
		}
		if(valueNode) {
			const values = resolveBasedOnConfig(data, vertex, valueNode, vertex.environment, graph.idMap, resolveValue)
				?.map(unwrapRValue) ?? [Unknown];
			return new Map([[arg, new Set(values)]]);
		}
	}
	return undefined;
}

function getFunctionsToCheck(customFunctions: readonly FunctionInfo[] | undefined, ignoreDefaultFunctions: boolean, defaultFunctions: readonly FunctionInfo[]): FunctionInfo[] {
	const functions: FunctionInfo[] = ignoreDefaultFunctions ? [] : [...defaultFunctions];
	if(customFunctions) {
		functions.push(...customFunctions);
	}
	return functions;
}
