import type { DataflowProcessorInformation } from '../../../../../processor';
import { alwaysExits, type DataflowInformation, filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap,
	reapplyLoopExitPoints
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard, isUndefined } from '../../../../../../util/assert';
import { unpackNonameArg } from '../argument/unpack-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { EdgeType } from '../../../../../graph/edge';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { valueSetGuard } from '../../../../../eval/values/general';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { appendEnvironment } from '../../../../../environments/append';


/**
 * Process a while loop like `while(cond) { ... }`.
 */
export function processWhileLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 2 || args[1] === EmptyArgument) {
		dataflowLogger.warn(`While-Loop ${Identifier.toString(name.content)} does not have 2 arguments, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const unpackedArgs = args.map(e => unpackNonameArg(e));

	if(unpackedArgs.some(isUndefined)) {
		dataflowLogger.warn(`While-Loop ${Identifier.toString(name.content)} has empty arguments in ${JSON.stringify(args)}, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const nameId = name.info.id;
	const origEnv = data.environment;

	// we should defer this to the abstract interpretation
	const values = resolveIdToValue(unpackedArgs[0]?.info.id, { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx });
	const conditionIsAlwaysFalse = valueSetGuard(values)?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;
	const conditionIsAlwaysTrue = valueSetGuard(values)?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;

	//We don't care about the body if it never executes
	if(conditionIsAlwaysFalse) {
		unpackedArgs.pop();
	}

	/* we inject the cf-dependency of the while-loop after the condition */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:      unpackedArgs as RNode<ParentInformation & OtherInfo>[],
		rootId,
		data,
		markAsNSE: [1],
		origin:    BuiltInProcName.WhileLoop
	});
	const [condition, body] = processedArguments;

	// If the condition is always false, we don't include the body
	if(condition !== undefined && conditionIsAlwaysFalse) {
		information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		return {
			unknownReferences: [],
			in:                [{ nodeId: nameId, name: name.lexeme, cds: data.cds, type: ReferenceType.Function }],
			out:               condition.out,
			entryPoint:        nameId,
			exitPoints:        [],
			graph:             information.graph,
			environment:       information.environment,
			hooks:             condition.hooks
		};
	}
	guard(condition !== undefined && body !== undefined, () => `While-Loop ${Identifier.toString(name.content)} has no condition or body, impossible!`);
	const originalDependency = data.cds;

	if(alwaysExits(condition)) {
		dataflowLogger.warn(`While-Loop ${rootId} forces exit in condition, skipping rest`);
		information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		return condition;
	}

	const cdTrue = [{ id: nameId, when: true }];
	const remainingInputs = linkInputs(
		makeAllMaybe(body.unknownReferences, information.graph, information.environment, false, cdTrue).concat(
			makeAllMaybe(body.in, information.graph, information.environment, false, cdTrue)),
		information.environment, condition.in.concat(condition.unknownReferences), information.graph, true);

	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(findNonLocalReads(information.graph, new Set(condition.in.map(i => i.nodeId)))), body.out);
	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), information.graph);

	// as the while-loop always evaluates its condition
	information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);

	return {
		unknownReferences: [],
		in:                [{ nodeId: nameId, name: name.lexeme, cds: originalDependency, type: ReferenceType.Function }, ...remainingInputs],
		out:               condition.out.concat(makeAllMaybe(body.out, information.graph, information.environment, true, cdTrue)),
		entryPoint:        nameId,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		graph:             information.graph,
		// as we do not know whether the loop executes at all, we have to merge the environments of the condition and the body, as both may be relevant
		environment:       conditionIsAlwaysTrue ? information.environment : appendEnvironment(origEnv, information.environment),
		hooks:             condition.hooks.concat(body.hooks)
	};
}
