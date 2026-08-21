import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation } from '../../../../../info';
import { alwaysExits, ExitPointType, filterOutLoopExitPoints } from '../../../../../info';
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
import type {
	PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { EdgeType } from '../../../../../graph/edge';
import { ControlFlow } from '../../../../control-flow';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import {
	applyCdsToAllInGraphButConstants,
	applyCdToReferences
} from '../../../../../environments/reference-to-maybe';
import { applyKills, makeKillsMaybe } from '../../../../../environments/apply-kill';
import { appendEnvironment } from '../../../../../environments/append';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';


/**
 * Process a while loop like `while(cond) { ... }`.
 */
export function processWhileLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 2 || RArgument.isEmpty(args[1])) {
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
	const values = NodeValue.setOf(unpackedArgs[0]?.info.id, data);
	const conditionIsAlwaysFalse = values?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;

	//We don't care about the body if it never executes
	if(conditionIsAlwaysFalse) {
		unpackedArgs.pop();
	}

	/* we inject the cf-dependency of the while-loop after the condition */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args:              unpackedArgs as RNode<ParentInformation & OtherInfo>[],
		rootId,
		data,
		markAsNSE:         [1],
		customControlFlow: true,
		origin:            BuiltInProcName.WhileLoop
	});
	const [condition, body] = processedArguments;

	// If the condition is always false, we don't include the body
	if(condition !== undefined && conditionIsAlwaysFalse) {
		information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		/* the body never runs, but the condition is still evaluated before the loop is left */
		ControlFlow.branchesTo(information.graph, condition, rootId, { id: nameId, when: false });
		return {
			unknownReferences: [],
			in:                [{ nodeId: nameId, name: name.lexeme, cds: data.cds, type: ReferenceType.Function }],
			out:               condition.out,
			entryPoint:        nameId,
			cfgEntry:          ControlFlow.entryOf(condition),
			cfgExit:           rootId,
			exitPoints:        [],
			graph:             information.graph,
			environment:       information.environment,
			hooks:             condition.hooks
		};
	}
	const conditionIsAlwaysTrue = values?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;

	guard(condition !== undefined && body !== undefined, () => `While-Loop ${Identifier.toString(name.content)} has no condition or body, impossible!`);
	const originalDependency = data.cds;

	if(alwaysExits(condition)) {
		dataflowLogger.warn(`While-Loop ${rootId} forces exit in condition, skipping rest`);
		information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		return condition;
	}

	const whenTrue: ControlDependency = { id: nameId, when: true };
	const cdTrue = [whenTrue];
	const bodyRead = body.in.concat(body.unknownReferences);
	applyCdsToAllInGraphButConstants(body.graph, bodyRead, cdTrue);
	const remainingInputs = linkInputs(bodyRead,
		information.environment, condition.in.concat(condition.unknownReferences), information.graph, true);
	applyCdToReferences(body.out, cdTrue);

	linkCircularRedefinitionsWithinALoop(information.graph, produceNameSharedIdMap(findNonLocalReads(information.graph, new Set(condition.in.map(i => i.nodeId)))), body.out, body.environment);
	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), information.graph);

	// as the while-loop always evaluates its condition
	information.graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);

	const graph = information.graph;
	const conditionEntry = ControlFlow.entryOf(condition);
	ControlFlow.branchesTo(graph, condition, ControlFlow.entryOf(body), whenTrue);
	ControlFlow.branchesTo(graph, condition, rootId, { id: nameId, when: false });
	ControlFlow.continuesWith(graph, body, conditionEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Next, conditionEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Break, rootId);
	// the body's environment carries its side effects (e.g. a `library()` call), which must survive the loop
	const bodyEnvironment = appendEnvironment(information.environment, body.environment);
	// as we do not know whether the loop executes at all, we merge the original environment back in (the body may never run)
	const loopEnvironment = conditionIsAlwaysTrue ? bodyEnvironment : appendEnvironment(origEnv, bodyEnvironment);
	// unless the loop always runs, a body removal only happens maybe; apply it as the merge cannot represent it
	const loopKill = body.kill?.length ? (conditionIsAlwaysTrue ? body.kill : makeKillsMaybe(body.kill, cdTrue)) : undefined;
	return {
		unknownReferences: [],
		in:                [{ nodeId: nameId, name: name.lexeme, cds: originalDependency, type: ReferenceType.Function }, ...remainingInputs],
		out:               condition.out.concat(body.out),
		entryPoint:        nameId,
		cfgEntry:          conditionEntry,
		cfgExit:           rootId,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		graph:             information.graph,
		environment:       loopKill ? applyKills(loopEnvironment, loopKill) : loopEnvironment,
		hooks:             condition.hooks.concat(body.hooks),
		kill:              loopKill,
	};
}
