import type { BasicQueryData } from '../../query';
import { executeQueries } from '../../query';
import type { DependenciesQuery, DependenciesQueryResult, FunctionInfo, LibraryInfo, ReadInfo, SourceInfo, WriteInfo } from './dependencies-query-format';
import { LibraryFunctions, ReadFunctions, SourceFunctions, WriteFunctions } from './dependencies-query-format';
import type { CallContextQuery } from '../call-context-query/call-context-query-format';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { log } from '../../../util/log';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { removeRQuotes } from '../../../r-bridge/retriever';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

export function executeDependenciesQuery(data: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	if(queries.length !== 1) {
		log.warn('Dependencies query expects only up to one query, but got ', queries.length);
	}
	const now = Date.now();

	const results = executeQueries(data, [
		...makeCallContextQuery(LibraryFunctions, 'library'),
		...makeCallContextQuery(SourceFunctions, 'source'),
		...makeCallContextQuery(ReadFunctions.map(f => f.name), 'read', true),
		...makeCallContextQuery(WriteFunctions.map(f => f.name), 'write', true)
	])['call-context'];

	const libraries: LibraryInfo[] = results.kinds['library']?.subkinds['.'].map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const libraryName = getArgumentValue(data, vertex, 0, [RType.String, RType.Symbol]);
		if(libraryName) {
			return {
				nodeId:       id,
				functionName: vertex.name,
				libraryName
			} as LibraryInfo;
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
			} as SourceInfo;
		}
		return undefined;
	}).filter(x => x !== undefined) ?? [];
	const readData: ReadInfo[] = Object.entries(results.kinds['read']?.subkinds ?? {}).flatMap(([name, results]) => results.map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = ReadFunctions.find(f => f.name === name) as FunctionInfo;
		let index = info.argIdx as number;
		if(info.argName) {
			const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === info.argName);
			if(arg >= 0) {
				index = arg;
			}
		}
		const source = getArgumentValue(data, vertex, index, [RType.String]);
		if(source) {
			return {
				nodeId:       id,
				functionName: vertex.name,
				source
			} as ReadInfo;
		}
		return undefined;
	})).filter(x => x !== undefined) ?? [];
	const writtenData: WriteInfo[] = Object.entries(results.kinds['write']?.subkinds ?? {}).flatMap(([name, results]) => results.map(({ id }) => {
		const vertex = data.graph.getVertex(id) as DataflowGraphVertexFunctionCall;
		const info = WriteFunctions.find(f => f.name === name) as FunctionInfo;
		let index = info.argIdx;
		if(info.argName) {
			const arg = vertex?.args.findIndex(arg => arg !== EmptyArgument && arg.name === info.argName);
			if(arg >= 0) {
				index = arg;
			}
		}
		if(index) {
			const destination = getArgumentValue(data, vertex, index, [RType.String]);
			if(destination) {
				return {
					nodeId:       id,
					functionName: vertex.name,
					destination
				} as WriteInfo;
			}
		} else if(vertex) {
			// write functions that don't have argIndex are assumed to write to stdout
			return {
				nodeId:       id,
				functionName: vertex.name,
				destination:  'stdout'
			} as WriteInfo;
		}
		return undefined;
	})).filter(x => x !== undefined) ?? [];

	return {
		'.meta': {
			timing: Date.now() - now
		},
		libraries, sourcedFiles, readData, writtenData
	};
}

function makeCallContextQuery(functions: readonly string[], kind: string, groupByName = false): CallContextQuery[] {
	if(groupByName){
		return functions.map(f => ({
			type:           'call-context',
			callName:       `^${f}$`,
			includeAliases: true,
			subkind:        f,
			kind
		}));
	} else {
		return [{
			type:           'call-context',
			callName:       `^(${functions.map(f => f.replace('.', '\\.')).join('|')})$`,
			includeAliases: true,
			subkind:        '.',
			kind
		}];
	}
}

function getArgumentValue({ graph }: BasicQueryData, vertex: DataflowGraphVertexFunctionCall, argumentIndex: number, allowedTypes: RType[]): string | undefined {
	if(vertex && vertex.args.length > argumentIndex) {
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
