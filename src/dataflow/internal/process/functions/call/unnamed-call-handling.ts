import { type DataflowProcessorInformation, processDataflowFor } from '../../../../processor';
import { Fn } from '../../../../fn/fn';
import type { DataflowInformation } from '../../../../info';
import { ControlFlow } from '../../../control-flow';
import { ExitPointType } from '../../../../info';
import { processAllArguments } from './common';
import type { RUnnamedFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { DfEdge, EdgeType } from '../../../../graph/edge';
import { DataflowGraph } from '../../../../graph/graph';
import { handleUnknownSideEffect } from '../../../../graph/unknown-side-effect';
import { VertexType } from '../../../../graph/vertex';
import { dataflowLogger } from '../../../../logger';
import { ReferenceType } from '../../../../environments/identifier';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RAccess } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RFunctionDefinition } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

export const UnnamedFunctionCallPrefix = 'unnamed-fc-';

/**
 * Whether a `$`/`[[` access callee resolved a field to a stored function: a resolved dispatch (`dispatch$foo()`)
 * carries a `Returns` edge from the access node to the field target (in addition to the base `Returns` to `accessedId`),
 * while an opaque object (`g$greet()` on an untracked `g`) only carries the base `Returns`.
 */
function accessResolvesToField(graph: DataflowGraph, accessId: NodeId, accessedId: NodeId): boolean {
	const outgoing = graph.outgoingEdges(accessId);
	if(outgoing === undefined) {
		return false;
	}
	const base = NodeId.normalize(accessedId);
	for(const [target, edge] of outgoing) {
		if(NodeId.normalize(target) !== base && DfEdge.includesType(edge, EdgeType.Returns)) {
			return true;
		}
	}
	return false;
}

/**
 * Processes an unnamed function call.
 * For example `(function(x) { x + 1 })(5)`
 */
export function processUnnamedFunctionCall<OtherInfo>(functionCall: RUnnamedFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const calledFunction = processDataflowFor(functionCall.calledFunction, data);

	const finalGraph = new DataflowGraph(data.completeAst.idMap);
	const functionRootId = functionCall.info.id;
	const calledRootId = functionCall.calledFunction.info.id;
	const functionCallName = `${UnnamedFunctionCallPrefix}${functionRootId}`;
	dataflowLogger.debug(`Using ${functionRootId} as root for the unnamed function call`);
	// we know that it reads the toplevel:
	finalGraph.addEdge(functionRootId, calledRootId, EdgeType.Reads);
	// keep the defined function
	finalGraph.mergeWith(calledFunction.graph);

	const {
		finalEnv,
		callArgs,
		remainingReadInArgs,
		processedArguments
	} = processAllArguments({
		functionName: calledFunction,
		args:         functionCall.arguments,
		data,
		finalGraph,
		functionRootId
		/* we know the call is right there and fully resolved, there is no need to artificially force arguments as we identify them within the subtree */
	});

	finalGraph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          functionRootId,
		environment: data.environment,
		name:        functionCallName,
		/* can never be a direct built-in-call */
		onlyBuiltin: false,
		cds:         data.cds,
		args:        callArgs, // same reference
		origin:      [BuiltInProcName.Unnamed]
	}, data.ctx.env.cleanEnv);

	const cfgEntry = ControlFlow.inSequence(finalGraph, [calledFunction, ...processedArguments], functionRootId);
	/* a jump within an argument is caught here, just like for a named call */
	for(const argument of processedArguments) {
		for(const exit of argument?.exitPoints ?? []) {
			if(exit.type !== ExitPointType.Default) {
				finalGraph.addEdge(exit.nodeId, functionRootId, EdgeType.FlowEdge);
			}
		}
	}

	let inIds = remainingReadInArgs;
	inIds.push({ nodeId: functionRootId, name: functionCallName, cds: data.cds, type: ReferenceType.Function });

	// if we just call a nested fdef
	if(RFunctionDefinition.is(functionCall.calledFunction)) {
		Fn.call.match.onCallAndLink(callArgs, functionCall.calledFunction.parameters, finalGraph);
	} else if(RAccess.is(functionCall.calledFunction) && !accessResolvesToField(finalGraph, calledRootId, functionCall.calledFunction.accessed.info.id)) {
		// `obj$method()` whose callee did not resolve to a stored function: reached-but-unknown rather than dropped
		handleUnknownSideEffect(finalGraph, data.environment, functionRootId);
	}

	// push the called function to the ids:
	inIds = inIds.concat(calledFunction.in, calledFunction.unknownReferences);

	return {
		unknownReferences: [],
		in:                inIds,
		// we do not keep the argument out as it has been linked by the function
		out:               calledFunction.out,
		graph:             finalGraph,
		environment:       finalEnv,
		entryPoint:        functionCall.info.id,
		cfgEntry:          cfgEntry === functionRootId ? undefined : cfgEntry,
		cfgExit:           functionRootId,
		exitPoints:        calledFunction.exitPoints,
		hooks:             calledFunction.hooks,
	};
}
