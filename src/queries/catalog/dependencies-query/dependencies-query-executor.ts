import { executeQueriesOfSameType  } from '../../query';
import type {
	DependenciesQuery,
	DependenciesQueryResult, DependencyInfo,
	FunctionInfo,
	LibraryInfo,
	ReadInfo, SourceInfo,
	WriteInfo
} from './dependencies-query-format';
import { LibraryFunctions, ReadFunctions, SourceFunctions, WriteFunctions } from './dependencies-query-format';
import type { CallContextQuery, CallContextQueryResult } from '../call-context-query/call-context-query-format';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { log } from '../../../util/log';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { removeRQuotes } from '../../../r-bridge/retriever';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { visitAst } from '../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import type { BasicQueryData } from '../../base-query-format';
import { isNotUndefined } from '../../../util/assert';
import { compactRecord } from '../../../util/objects';

const SupportedVertexTypes = [RType.String, RType.Logical, RType.Number];

const Unknown = 'unknown';

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

	const libraries: LibraryInfo[] = getResults(data, results, 'library', libraryFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		libraryName:  argument ?? Unknown
	}), [RType.Symbol]);

	if(!ignoreDefault) {
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


	const sourcedFiles: SourceInfo[] = getResults(data, results, 'source', sourceFunctions, (id, vertex, argument, linkedIds) => ({
		nodeId:       id,
		functionName: vertex.name,
		file:         argument ?? Unknown,
		linkedIds
	}));
	const readData: ReadInfo[] = getResults(data, results, 'read', readFunctions, (id, vertex, argument, linkedIds) => ({
		nodeId:       id,
		functionName: vertex.name,
		source:       argument ?? Unknown,
		linkedIds
	}));
	const writtenData: WriteInfo[] = getResults(data, results, 'write', writeFunctions, (id, vertex, argument, linkedIds) => ({
		nodeId:       id,
		functionName: vertex.name,
		// write functions that don't have argIndex are assumed to write to stdout
		destination:  argument ?? ((linkedIds?.length ?? 0) > 0 ? Unknown : 'stdout'),
		linkedIds:    linkedIds
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
		includeAliases: true,
		callNameExact:  true,
		subkind:        f.name,
		linkTo:         f.linkTo ? { type: 'link-to-last-call', callName: f.linkTo } : undefined,
		kind
	}));
}

function getResults<T extends DependencyInfo>(data: BasicQueryData, results: CallContextQueryResult, kind: string, functions: FunctionInfo[], makeInfo: (id: NodeId, vertex: DataflowGraphVertexFunctionCall, argument: string | undefined, linkedIds: undefined | readonly NodeId[]) => T | undefined, additionalAllowedTypes?: RType[]) {
	return Object.entries(results?.kinds[kind]?.subkinds ?? {}).flatMap(([name, results]) => results.flatMap(({ id, linkedIds }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = functions.find(f => f.name === name) as FunctionInfo;
		let index = info.argIdx;
		if(info.argName) {
			const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === info.argName);
			if(arg >= 0) {
				index = arg;
			}
		}
		const args = index !== undefined ? getArgumentValue(data, vertex, index, additionalAllowedTypes) : undefined;
		if(!args) {
			return compactRecord(makeInfo(id, vertex, undefined, linkedIds));
		}
		return args.flatMap(a => compactRecord(makeInfo(id, vertex, a, linkedIds)));
	})).filter(isNotUndefined) ?? [];
}

function getArgumentValue({ graph }: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, argumentIndex: number | 'unnamed', additionalAllowedTypes: RType[] | undefined): (string | undefined)[] | undefined {
	if(vertex) {
		if(argumentIndex === 'unnamed') {
			// return all unnamed arguments
			const references = vertex.args.filter(arg => arg !== EmptyArgument && !arg.name).map(getReferenceOfArgument);
			return references.map(ref => {
				if(!ref) {
					return undefined;
				}
				let valueNode = graph.idMap?.get(ref);
				if(valueNode?.type === RType.Argument) {
					valueNode = valueNode.value;
				}
				if(valueNode) {
					const allowedTypes = [...SupportedVertexTypes, ...additionalAllowedTypes ?? []];
					return allowedTypes.includes(valueNode.type) ? removeRQuotes(valueNode.lexeme as string) : Unknown;
				}
			});
		}
		if(vertex.args.length > argumentIndex) {
			const arg = getReferenceOfArgument(vertex.args[argumentIndex]);
			if(arg) {
				let valueNode = graph.idMap?.get(arg);
				if(valueNode?.type === RType.Argument) {
					valueNode = valueNode.value;
				}
				if(valueNode) {
					const allowedTypes = [...SupportedVertexTypes, ...additionalAllowedTypes ?? []];
					return [allowedTypes.includes(valueNode.type) ? removeRQuotes(valueNode.lexeme as string) : Unknown];
				}
			}
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
