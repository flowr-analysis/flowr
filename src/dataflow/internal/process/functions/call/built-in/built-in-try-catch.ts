import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation, ExitPoint } from '../../../../../info';
import { happensInEveryBranch ,  ExitPointType } from '../../../../../info';
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
import type { DataflowGraphVertexInfo } from '../../../../../graph/vertex';
import { VertexType } from '../../../../../graph/vertex';
import { tryUnpackNoNameArg } from '../argument/unpack-argument';
import type { DataflowGraph } from '../../../../../graph/graph';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { isUndefined } from '../../../../../../util/assert';


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
	// check whether blockArg has *always* happening exceptions, if so we do not constrain the error handler
	const blockErrorExitPoints: (ControlDependency | undefined)[] = [];
	const errorExitPoints: ExitPoint[] = [];
	(info.exitPoints as ExitPoint[]) = res.processedArguments.flatMap(arg => {
		if(!arg) {
			return [];
		}
		// this calls error and finally args
		if(finallyArg.has(arg.entryPoint)) {
			return handleFdefAsCalled(arg.entryPoint, info.graph, arg.exitPoints, undefined);
		} else if(errorArg.has(arg.entryPoint)) {
			errorExitPoints.push(...getExitPoints(info.graph.getVertex(arg.entryPoint), info.graph) ?? []);
		}
		if(!blockArg.has(arg.entryPoint)) {
			// not killing other args
			return arg.exitPoints;
		}
		blockErrorExitPoints.push(...arg.exitPoints.filter(ep => ep.type === ExitPointType.Error).flatMap(a => a.controlDependencies));
		return arg.exitPoints.filter(ep => ep.type !== ExitPointType.Error);
	});
	if(errorExitPoints.length > 0) {
		if(happensInEveryBranch(blockErrorExitPoints.some(isUndefined) ? undefined : blockErrorExitPoints as ControlDependency[])) {
			(info.exitPoints as ExitPoint[]).push(...errorExitPoints);
		} else {
			(info.exitPoints as ExitPoint[]).push(...constrainExitPoints(errorExitPoints, blockArg));
		}
	}

	return info;
}

function getExitPoints(vertex: DataflowGraphVertexInfo | undefined, graph: DataflowGraph): readonly ExitPoint[] | undefined {
	if(!vertex) {
		return undefined;
	}
	if(vertex.tag === VertexType.FunctionDefinition) {
		return vertex.exitPoints;
	}
	// we assumed named argument
	const n = graph.idMap?.get(vertex.id);
	if(!n) {
		return undefined;
	}
	if(n.type === RType.Argument && n.value?.type === RType.FunctionDefinition) {
		const fdefV = graph.getVertex(n.value.info.id);
		if(fdefV?.tag === VertexType.FunctionDefinition) {
			return fdefV.exitPoints;
		}
	}
	return undefined;
}

function handleFdefAsCalled(nodeId: NodeId, graph: DataflowGraph, def: readonly ExitPoint[], constrain: Set<NodeId> | undefined): readonly ExitPoint[] {
	const v = graph.getVertex(nodeId);
	const e = getExitPoints(v, graph);
	return e ? constrainExitPoints(e, constrain) : def;
}

function constrainExitPoints(exitPoints: readonly ExitPoint[], constrain: Set<NodeId> | undefined): readonly ExitPoint[] {
	if(!constrain || constrain.size === 0) {
		return exitPoints;
	}
	// append constrains with true
	const cds = Array.from(constrain, id => ({ id, when: true }));
	return exitPoints.map(e => {
		if(e.controlDependencies) {
			e.controlDependencies.push(...cds);
			return e;
		} else {
			return { ...e, controlDependencies: cds };
		}
	});
}