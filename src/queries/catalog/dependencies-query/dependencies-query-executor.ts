import type { BasicQueryData } from '../../query';
import { executeQueries } from '../../query';
import type { DependenciesQuery, DependenciesQueryResult, LibraryInfo, SourceInfo } from './dependencies-query-format';
import { LibraryFunctions, ReadFunctions, SourceFunctions, WriteFunctions } from './dependencies-query-format';
import type { CallContextQuery } from '../call-context-query/call-context-query-format';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { log } from '../../../util/log';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { removeRQuotes } from '../../../r-bridge/retriever';

export function executeDependenciesQuery(data: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length);
	}
	const now = Date.now();

	const results = executeQueries(data, [
		makeCallContextQuery(LibraryFunctions, 'library'),
		makeCallContextQuery(SourceFunctions, 'source'),
		makeCallContextQuery(ReadFunctions, 'read'),
		makeCallContextQuery(WriteFunctions, 'write')
	])['call-context'];

	const libraries: LibraryInfo[] = results.kinds['library']?.subkinds['.'].map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const libraryName = getArgumentValue(data, vertex, 0, [RType.String, RType.Symbol]);
		if(libraryName) {
			return {
				nodeId:       id,
				functionName: vertex.name,
				libraryName
			};
		}
		return undefined;
	}).filter(x => x !== undefined) ?? [];
	const sourcedFiles: SourceInfo[] = results.kinds['source']?.subkinds['.'].map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const file = getArgumentValue(data, vertex, 0, [RType.String]);
		if(file) {
			return {
				nodeId:       id,
				functionName: vertex.name,
				file
			};
		}
		return undefined;
	}).filter(x => x !== undefined) ?? [];

	return {
		'.meta': {
			timing: Date.now() - now
		},
		libraries, sourcedFiles,
		readData:    [],
		writtenData: []
	};
}

function makeCallContextQuery(functions: readonly string[], kind: string): CallContextQuery {
	return {
		type:           'call-context',
		callName:       `(${functions.map(f => f.replace('.', '\\.')).join('|')})`,
		includeAliases: true,
		subkind:        '.',
		kind
	};
}

function getArgumentValue({ graph }: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, argumentIndex: number, allowedTypes: RType[]): string | undefined {
	if(vertex) {
		const arg = getReferenceOfArgument(vertex.args[argumentIndex]);
		if(arg) {
			const valueNode = graph.idMap?.get(arg);
			if(valueNode) {
				return allowedTypes.includes(valueNode.type) ? removeRQuotes(valueNode.lexeme as string) : 'unknown';
			}
		}
	}
	return undefined;
}
