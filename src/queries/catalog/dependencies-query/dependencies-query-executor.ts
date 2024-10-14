import type { BasicQueryData } from '../../query';
import { executeQueries } from '../../query';
import type { DependenciesQuery, DependenciesQueryResult } from './dependencies-query-format';
import {  ReadFunctions, SourceFunctions, WriteFunctions , LibraryFunctions } from './dependencies-query-format';
import type { CallContextQuery } from '../call-context-query/call-context-query-format';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { log } from '../../../util/log';

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

	const libraries = results.kinds.libary.subkinds['.'].map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		if(vertex){
			const arg = getReferenceOfArgument(vertex.args[0]);
			if(arg) {
				const valueNode = data.graph.idMap?.get(arg) as RArgument;
				if(valueNode) {
					return { nodeId: id, functionName: vertex.name, libraryName: valueNode.lexeme };
				}
			}
		}
		return undefined;
	}).filter(x => x !== undefined);

	return {
		'.meta': {
			timing: Date.now() - now
		},
		libraries
	};
}

function makeCallContextQuery(functions: readonly string[], kind: string): CallContextQuery {
	return { type: 'call-context', callName: `^(${functions.join('|')})$`, kind, includeAliases: true };
}
