import type { BasicQueryData } from '../../query';
import { executeQueries } from '../../query';
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

const SupportedVertexTypes = [RType.String, RType.Logical, RType.Number];

const Unknown = 'unknown';

export function executeDependenciesQuery(data: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length);
	}
	const now = Date.now();

	const query = queries[0];
	const ignoreDefault = query.ignoreDefaultFunctions ?? false;
	const libraryFunctions = getFunctionsToCheck(query.libraryFunctions, ignoreDefault, LibraryFunctions);
	const sourceFunctions = getFunctionsToCheck(query.sourceFunctions, ignoreDefault, SourceFunctions);
	const readFunctions = getFunctionsToCheck(query.readFunctions, ignoreDefault, ReadFunctions);
	const writeFunctions = getFunctionsToCheck(query.writeFunctions, ignoreDefault, WriteFunctions);

	const results = executeQueries(data, [
		...makeCallContextQuery(libraryFunctions, 'library'),
		...makeCallContextQuery(sourceFunctions, 'source'),
		...makeCallContextQuery(readFunctions, 'read'),
		...makeCallContextQuery(writeFunctions, 'write')
	])['call-context'];

	const libraries: LibraryInfo[] = getResults(data, results, 'library', libraryFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		libraryName:  argument ?? Unknown
	}), [RType.Symbol]);
	const sourcedFiles: SourceInfo[] = getResults(data, results, 'source', sourceFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		file:         argument ?? Unknown
	}));
	const readData: ReadInfo[] = getResults(data, results, 'read', readFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		source:       argument ?? Unknown
	}));
	const writtenData: WriteInfo[] = getResults(data, results, 'write', writeFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		// write functions that don't have argIndex are assumed to write to stdout
		destination:  argument ?? 'stdout'
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
		kind
	}));
}

function getResults<T extends DependencyInfo>(data: BasicQueryData, results: CallContextQueryResult, kind: string, functions: FunctionInfo[], makeInfo: (id: NodeId, vertex: DataflowGraphVertexFunctionCall, argument: string | undefined) => T | undefined, additionalAllowedTypes?: RType[]) {
	return Object.entries(results?.kinds[kind]?.subkinds ?? {}).flatMap(([name, results]) => results.map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = functions.find(f => f.name === name) as FunctionInfo;
		let index = info.argIdx;
		if(info.argName) {
			const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === info.argName);
			if(arg >= 0) {
				index = arg;
			}
		}
		const argument = index !== undefined ? getArgumentValue(data, vertex, index, additionalAllowedTypes) : undefined;
		return makeInfo(id, vertex, argument);
	})).filter(x => x !== undefined) ?? [];
}

function getArgumentValue({ graph }: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, argumentIndex: number, additionalAllowedTypes: RType[] | undefined): string | undefined {
	if(vertex && vertex.args.length > argumentIndex) {
		const arg = getReferenceOfArgument(vertex.args[argumentIndex]);
		if(arg) {
			let valueNode = graph.idMap?.get(arg);
			if(valueNode?.type === RType.Argument) {
				valueNode = valueNode.value;
			}
			if(valueNode) {
				const allowedTypes = [...SupportedVertexTypes, ...additionalAllowedTypes ?? []];
				return allowedTypes.includes(valueNode.type) ? removeRQuotes(valueNode.lexeme as string) : Unknown;
			}
		}
	}
	return undefined;
}

function getFunctionsToCheck(customFunctions: FunctionInfo[] | undefined, ignoreDefaultFunctions: boolean, defaultFunctions: FunctionInfo[]): FunctionInfo[] {
	const functions: FunctionInfo[] = [];
	if(!ignoreDefaultFunctions) {
		functions.push(...defaultFunctions);
	}
	if(customFunctions) {
		functions.push(...customFunctions);
	}
	return functions;
}
