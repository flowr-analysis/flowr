import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ExitPoint, DataflowInformation } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { pMatch } from '../../../../linker';
import { VertexType } from '../../../../../graph/vertex';
import { tryUnpackNoNameArg } from '../argument/unpack-argument';
import type { DataflowGraph } from '../../../../../graph/graph';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';


function getArgsOfName(argMaps: Map<NodeId, string>, name: string): Set<NodeId> {
	return new Set(argMaps.entries().filter(([, v]) => v === name).map(([k]) => k));
}

/**
 * Process a built-in try-catch or similar handler.
 */
export function processTryCatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		block:    string,
		handlers: {
			error?:   string,
			finally?: string
		}
	}
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args: args.map(tryUnpackNoNameArg), rootId, data, origin: 'builtin:try', forceArgs: 'all' });
	if(args.length < 1 || args[0] === EmptyArgument) {
		dataflowLogger.warn(`TryCatch Handler ${name.content} does not have 1 argument, skipping`);
		return res.information;
	}
	// artificial ids :)
	const params = {
		[config.block]: 'block',
		'...':          '...'
	};
	if(config.handlers.error) {
		params[config.handlers.error] = 'error';
	}
	if(config.handlers.finally) {
		params[config.handlers.finally] = 'finally';
	}
	// only remove exit points from the block
	const argMaps = pMatch(res.callArgs, params);
	const info = res.information;

	const blockArg = getArgsOfName(argMaps, 'block');
	const errorArg = getArgsOfName(argMaps, 'error');
	const finallyArg = getArgsOfName(argMaps, 'finally');
	// only take those exit points from the block
	(info.exitPoints as ExitPoint[]) = res.processedArguments.flatMap(arg => {
		if(!arg) {
			return [];
		}
		// this calls error and finally args
		if(finallyArg.has(arg.entryPoint) || errorArg.has(arg.entryPoint)) {
			return handleFdefAsCalled(arg.entryPoint, info.graph, arg.exitPoints);
		}
		if(!blockArg.has(arg.entryPoint)) {
			// not killing other args
			return arg.exitPoints;
		}
		return arg.exitPoints.filter(ep => ep.type !== ExitPointType.Error);
	});


	return info;
}

function handleFdefAsCalled(nodeId: NodeId, graph: DataflowGraph, def: readonly ExitPoint[]): readonly ExitPoint[] {
	const v = graph.getVertex(nodeId);
	if(!v) {
		return def;
	}
	if(v.tag === VertexType.FunctionDefinition) {
		return v.exitPoints;
	}
	// we assumed named argument
	const n = graph.idMap?.get(nodeId);
	if(!n) {
		return def;
	}
	if(n.type === RType.Argument && n.value?.type === RType.FunctionDefinition) {
		const fdefV = graph.getVertex(n.value.info.id);
		if(fdefV?.tag === VertexType.FunctionDefinition) {
			return fdefV.exitPoints;
		}
	}
	return def;
}
