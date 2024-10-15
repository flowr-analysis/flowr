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

export function executeDependenciesQuery(data: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length);
	}
	const now = Date.now();

	const results = executeQueries(data, [
		...makeCallContextQuery(LibraryFunctions, 'library'),
		...makeCallContextQuery(SourceFunctions, 'source'),
		...makeCallContextQuery(ReadFunctions, 'read'),
		...makeCallContextQuery(WriteFunctions, 'write')
	])['call-context'];

	const libraries: LibraryInfo[] = getResults(data, results, 'library', LibraryFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		libraryName:  argument as string
	}), [RType.Symbol]);
	const sourcedFiles: SourceInfo[] = getResults(data, results, 'source', SourceFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		file:         argument as string
	}));
	const readData: ReadInfo[] = getResults(data, results, 'read', ReadFunctions, (id, vertex, argument) => ({
		nodeId:       id,
		functionName: vertex.name,
		source:       argument as string
	}));
	const writtenData: WriteInfo[] = getResults(data, results, 'write', WriteFunctions, (id, vertex, argument) => ({
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
		callName:       `^${f.name}$`,
		includeAliases: true,
		subkind:        f.name,
		kind
	}));
}

function getResults<T extends DependencyInfo>(data: BasicQueryData, results: CallContextQueryResult, kind: string, functions: FunctionInfo[], makeInfo: (id: NodeId, vertex: DataflowGraphVertexFunctionCall, argument: string | undefined) => T | undefined, additionalAllowedTypes?: RType[]) {
	return Object.entries(results.kinds[kind]?.subkinds ?? {}).flatMap(([name, results]) => results.map(({ id }) => {
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
				return allowedTypes.includes(valueNode.type) ? removeRQuotes(valueNode.lexeme as string) : 'unknown';
			}
		}
	}
	return undefined;
}
