import { DataflowGraph } from '../../dataflow/graph/graph';
import { type DataflowGraphVertexArgument, VertexType } from '../../dataflow/graph/vertex';
import { deepMergeObject, type MergeableRecord } from '../objects';
import type { DeepPartial } from 'ts-essentials';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { isNotUndefined } from '../assert';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';

export interface ReduceVertexOptions extends MergeableRecord {
	tags:              VertexType[]
	nameRegex:         string
	blacklistWithName: boolean,
	keepEnv:           boolean
	keepCd:            boolean
	compactFunctions:  boolean
}

export interface ReduceOptions extends MergeableRecord {
    vertices: ReduceVertexOptions
}

const defaultReduceOptions: Required<ReduceOptions> = {
	vertices: {
		tags:              Object.values(VertexType),
		nameRegex:         '.*',
		blacklistWithName: false,
		keepEnv:           false,
		keepCd:            true,
		compactFunctions:  true
	}
};

function makeFilter(options: ReduceVertexOptions, idMap?: AstIdMap): <T extends DataflowGraphVertexArgument>(arg: T) => T | undefined {
	const nameRegex = new RegExp(options.nameRegex);
	return <T extends DataflowGraphVertexArgument>(arg: T) => {
		if(!options.tags.includes(arg.tag)) {
			return undefined;
		}
		const lexeme = idMap?.get(arg.id)?.lexeme;
		if(lexeme && (nameRegex.test(lexeme) === options.blacklistWithName)) {
			return undefined;
		}

		return {
			...arg,
			environment:         options.keepEnv ? arg.environment : undefined,
			controlDependencies: options.keepCd ? arg.controlDependencies : undefined,
			functionInformation: options.compactFunctions ? arg.functionInformation : undefined
		};
	};
}

/**
 * Produces a reduced version of the given dataflow graph according to the given options.
 */
export function reduceDfg(dfg: DataflowGraph, options: DeepPartial<ReduceOptions>, cleanEnv: REnvironmentInformation): DataflowGraph {
	const newDfg = new DataflowGraph(dfg.idMap);
	const applyOptions = deepMergeObject(defaultReduceOptions, options) as Required<ReduceOptions>;
	// overwrite the tag set if possible
	if(options.vertices?.tags) {
		applyOptions.vertices.tags = options.vertices.tags.filter(isNotUndefined);
	}

	const applyFilter = makeFilter(applyOptions.vertices, dfg.idMap);

	// go over the vertices
	for(const [id, info] of dfg.vertices(!applyOptions)) {
		const result = applyFilter(info);
		if(result) {
			newDfg.addVertex(result, cleanEnv, dfg.isRoot(id));
		}
	}

	for(const [from, out] of dfg.edges()) {
		if(!newDfg.hasVertex(from)) {
			continue;
		}
		for(const [to, { types }] of out) {
			if(!newDfg.hasVertex(to)) {
				continue;
			}
			newDfg.addEdge(from, to, types);
		}
	}

	return newDfg;
}