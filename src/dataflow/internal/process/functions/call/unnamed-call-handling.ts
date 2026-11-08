import { type DataflowProcessorInformation, processDataflowFor } from '../../../../processor';
import { FunctionSemantics } from '../../../../fn/function-semantics';
import type { DataflowInformation } from '../../../../info';
import { ControlFlow } from '../../../control-flow';
import { processAllArguments } from './common';
import { EmptyArgument, RFunctionCall, type RUnnamedFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EdgeType } from '../../../../graph/edge';
import { Ternary } from '../../../../../util/logic';
import { DataflowGraph } from '../../../../graph/graph';
import { handleUnknownSideEffect } from '../../../../graph/unknown-side-effect';
import { VertexType } from '../../../../graph/vertex';
import { type BrandedIdentifier, type IdentifierReference, ReferenceType } from '../../../../environments/identifier';
import { resolveConstructorInstanceEnvState } from './built-in/built-in-class-generator';
import { Resolve } from '../../../../environments/resolve-helper';
import { RNode } from '../../../../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { BuiltInProcName } from '../../../../environments/built-in-proc-name';
import { NodeId } from '../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RAccess } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RFunctionDefinition } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { Dataflow } from '../../../../graph/df-helper';
import { UnnamedFunctionCallPrefix } from '../../../../environments/built-in-kinds';
export { UnnamedFunctionCallPrefix } from '../../../../environments/built-in-kinds';


/** Whether a `$`/`[[` access callee resolved a field to a stored function: a resolved dispatch (`dispatch$foo()`) carries a `Returns` edge from the access node to the field target (in addition to the base `Returns` to `accessedId`), while an opaque object (`g$greet()` on an untracked `g`) only carries the base `Returns`. */
function accessResolvesToField(graph: DataflowGraph, accessId: NodeId, accessedId: NodeId): boolean {
	const base = NodeId.normalize(accessedId);
	return Dataflow.targetsOf(graph, accessId, EdgeType.Returns).some(target => NodeId.normalize(target) !== base);
}

/** the method R6 and reference classes run on a new instance */
const Initializer = 'initialize' as BrandedIdentifier;

/** Processes an unnamed function call. For example `(function(x) { x + 1 })(5)` */
export function processUnnamedFunctionCall<OtherInfo>(functionCall: RUnnamedFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const calledFunction = processDataflowFor(functionCall.calledFunction, data);
	const finalGraph = new DataflowGraph(data.completeAst.idMap);
	const functionRootId = functionCall.info.id;
	const calledRootId = functionCall.calledFunction.info.id;
	const functionCallName = `${UnnamedFunctionCallPrefix}${functionRootId}`;
	finalGraph.addEdge(functionRootId, calledRootId, EdgeType.Reads);
	finalGraph.mergeWith(calledFunction.graph);

	/* the call is right there and fully resolved, so there is no need to force arguments */
	const { finalEnv, callArgs, remainingReadInArgs, processedArguments } = processAllArguments({
		functionName: calledFunction,
		args:         functionCall.arguments,
		data,
		finalGraph,
		functionRootId
	});

	finalGraph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          functionRootId,
		environment: data.environment,
		name:        functionCallName,
		onlyBuiltin: false,
		cds:         data.cds,
		args:        callArgs,
		origin:      [BuiltInProcName.Unnamed]
	}, data.ctx.env.cleanEnv);

	const cfgEntry = ControlFlow.inSequence(finalGraph, [calledFunction, ...processedArguments], functionRootId);
	/* what the called function forces is up to its body, just like for a named call */
	const argumentExits = processedArguments.flatMap(a => ControlFlow.promise(finalGraph, a, Ternary.Maybe, functionRootId));

	const called = functionCall.calledFunction;
	/* `Gen$new()` of an R6 or reference class runs the class's `initialize` method */
	const instance = resolveConstructorInstanceEnvState(functionCall, data);
	for(const init of instance === undefined ? [] : Resolve.byNameAndType(Initializer, instance, ReferenceType.Function) ?? []) {
		if(!NodeId.isBuiltIn(init.nodeId)) {
			finalGraph.addEdge(functionRootId, init.nodeId, EdgeType.Calls);
			/* a reference class method's `v <<- x` and `initFields(v = x)` set fields of the new instance, which it then holds */
			RNode.visitAst(data.completeAst.idMap.get(init.nodeId), n => {
				if(RBinaryOp.is(n) && n.operator === '<<-') {
					finalGraph.addEdge(functionRootId, n.lhs.info.id, EdgeType.Reads);
				} else if(RFunctionCall.isNamed(n, 'initFields')) {
					n.arguments.forEach(a => a !== EmptyArgument && a.value !== undefined && finalGraph.addEdge(functionRootId, a.value.info.id, EdgeType.Reads));
				}
			});
		}
	}
	if(RFunctionDefinition.is(called)) {
		FunctionSemantics.call.match.onCallAndLink(callArgs, called.parameters, finalGraph);
	} else if(RAccess.is(called) && !accessResolvesToField(finalGraph, calledRootId, called.accessed.info.id)) {
		/* `obj$method()` whose field did not resolve to a stored function is reached but unknown rather than dropped */
		handleUnknownSideEffect(finalGraph, data.environment, functionRootId);
	}

	const fnRef: IdentifierReference = { nodeId: functionRootId, name: functionCallName, cds: data.cds, type: ReferenceType.Function };
	return {
		unknownReferences: [],
		in:                [...remainingReadInArgs, fnRef, ...calledFunction.in, ...calledFunction.unknownReferences],
		/* we do not keep the argument out as it has been linked by the function */
		out:               calledFunction.out,
		graph:             finalGraph,
		environment:       finalEnv,
		entryPoint:        functionRootId,
		cfgEntry:          cfgEntry === functionRootId ? undefined : cfgEntry,
		cfgExit:           functionRootId,
		exitPoints:        calledFunction.exitPoints.concat(argumentExits),
		hooks:             calledFunction.hooks,
	};
}
