import type { DataflowProcessorInformation } from '../../../../processor';
import type { DataflowInformation } from '../../../../info';
import { initializeCleanDataflowInformation } from '../../../../info';
import { processKnownFunctionCall } from './known-call-handling';
import { appendEnvironment } from '../../../../environments/append';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { resolveByName } from '../../../../environments/resolve-by-name';
import { VertexType } from '../../../../graph/vertex';
import { ReferenceType } from '../../../../environments/identifier';
import type { DataflowGraph } from '../../../../graph/graph';


function mergeInformation(info: DataflowInformation | undefined, newInfo: DataflowInformation): DataflowInformation {
	if(info === undefined) {
		return newInfo;
	}

	return {
		unknownReferences: [...info.unknownReferences, ...newInfo.unknownReferences],
		in:                [...info.in, ...newInfo.in],
		out:               [...info.out, ...newInfo.out],
		graph:             info.graph.mergeWith(newInfo.graph),
		environment:       appendEnvironment(info.environment, newInfo.environment),
		entryPoint:        newInfo.entryPoint,
		exitPoints:        [...info.exitPoints, ...newInfo.exitPoints],
	};
}

function processDefaultFunctionProcessor<OtherInfo>(
	information: DataflowInformation | undefined,
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
) {
	const resolve = resolveByName(name.content, data.environment, ReferenceType.Function);
	/* if we do not know where we land, we force! */
	const call = processKnownFunctionCall({ name, args, rootId, data, forceArgs: (resolve?.length ?? 0) > 0 ? undefined : 'all' });
	return mergeInformation(information, call.information);
}

export function markAsOnlyBuiltIn(graph: DataflowGraph, rootId: NodeId) {
	const v = graph.getVertex(rootId);
	if(v?.tag === VertexType.FunctionCall) {
		v.onlyBuiltin = true;
		v.environment = undefined;
	}
}

export function processNamedCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const resolved = resolveByName(name.content, data.environment, ReferenceType.Function) ?? [];
	let defaultProcessor = resolved.length === 0;

	let information: DataflowInformation | undefined = undefined;
	let builtIn = false;

	for(const resolvedFunction of resolved) {
		if(resolvedFunction.type === ReferenceType.BuiltInFunction && typeof resolvedFunction.processor === 'function') {
			builtIn = true;
			information = mergeInformation(information, resolvedFunction.processor(name, args, rootId, data));
		} else {
			defaultProcessor = true;
		}
	}

	if(defaultProcessor) {
		information = processDefaultFunctionProcessor(information, name, args, rootId, data);
	} else if(information && builtIn) {
		// mark the function call as built in only
		markAsOnlyBuiltIn(information.graph, rootId);
	}

	return information ?? initializeCleanDataflowInformation(rootId, data);
}
