import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation } from '../../../../../info';
import { ExitPointType, filterOutLoopExitPoints } from '../../../../../info';
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	linkInputs,
	produceNameSharedIdMap,
	reapplyLoopExitPoints
} from '../../../../linker';
import { processKnownFunctionCall } from '../known-call-handling';
import { guard, isUndefined } from '../../../../../../util/assert';
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
import { linkAmbientStateWithinLoop } from './built-in-ambient-state';

/** Process a while loop like `while(cond) { ... }`. */
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
	const unpackedArgs = args.map(e => RArgument.unnamedValueOf(e));
	if(unpackedArgs.some(isUndefined)) {
		dataflowLogger.warn(`While-Loop ${Identifier.toString(name.content)} has empty arguments in ${JSON.stringify(args)}, skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}

	const nameId = name.info.id;
	const origEnv = data.environment;
	const values = NodeValue.setOf(unpackedArgs[0]?.info.id, data);
	const conditionIsAlways = (value: boolean) => values?.elements.every(d => d.type === 'logical' && d.value === value) ?? false;
	const conditionIsAlwaysFalse = conditionIsAlways(false);
	/* the body is left out if it never runs */
	if(conditionIsAlwaysFalse) {
		unpackedArgs.pop();
	}

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
	const graph = information.graph;

	if(condition !== undefined && conditionIsAlwaysFalse) {
		graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		/* the body never runs, but the condition is still evaluated before the loop is left */
		ControlFlow.branchesTo(graph, condition, rootId, { id: nameId, when: false });
		return {
			unknownReferences: [],
			in:                [{ nodeId: nameId, name: name.lexeme, cds: data.cds, type: ReferenceType.Function }],
			out:               condition.out,
			entryPoint:        nameId,
			cfgEntry:          ControlFlow.entryOf(condition),
			cfgExit:           rootId,
			exitPoints:        [],
			graph,
			environment:       information.environment,
			hooks:             condition.hooks
		};
	}

	guard(condition !== undefined && body !== undefined, () => `While-Loop ${Identifier.toString(name.content)} has no condition or body, impossible!`);
	if(ControlFlow.alwaysExits(condition, data.cds)) {
		dataflowLogger.warn(`While-Loop ${rootId} forces exit in condition, skipping rest`);
		graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);
		return condition;
	}

	const whenTrue: ControlDependency = { id: nameId, when: true };
	const cdTrue = [whenTrue];
	const bodyRead = body.in.concat(body.unknownReferences);
	applyCdsToAllInGraphButConstants(body.graph, bodyRead, cdTrue);
	const remainingInputs = linkInputs(bodyRead, information.environment, condition.in.concat(condition.unknownReferences), graph, true);
	applyCdToReferences(body.out, cdTrue);

	const nonLocalReads = findNonLocalReads(graph, new Set(condition.in.map(i => i.nodeId)));
	linkCircularRedefinitionsWithinALoop(graph, produceNameSharedIdMap(nonLocalReads), body.out, body.environment);
	linkAmbientStateWithinLoop(graph, bodyRead.concat(condition.in, condition.unknownReferences), body);
	reapplyLoopExitPoints(body.exitPoints, body.in.concat(body.out, body.unknownReferences), graph);
	/* as the while-loop always evaluates its condition */
	graph.addEdge(nameId, condition.entryPoint, EdgeType.Reads);

	const conditionEntry = ControlFlow.entryOf(condition);
	ControlFlow.branchesTo(graph, condition, ControlFlow.entryOf(body), whenTrue);
	ControlFlow.branchesTo(graph, condition, rootId, { id: nameId, when: false });
	ControlFlow.continuesWith(graph, body, conditionEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Next, conditionEntry);
	ControlFlow.jumpsTo(graph, body, ExitPointType.Break, rootId);
	/* the body's environment carries its side effects (e.g. a `library()` call), the original one stays unless the body surely runs */
	const conditionIsAlwaysTrue = conditionIsAlways(true);
	const bodyEnvironment = appendEnvironment(information.environment, body.environment);
	const loopEnvironment = conditionIsAlwaysTrue ? bodyEnvironment : appendEnvironment(origEnv, bodyEnvironment);
	/* unless the loop always runs, a body removal only happens maybe; apply it as the merge cannot represent it */
	const loopKill = body.kill?.length ? (conditionIsAlwaysTrue ? body.kill : makeKillsMaybe(body.kill, cdTrue)) : undefined;
	return {
		unknownReferences: [],
		in:                [{ nodeId: nameId, name: name.lexeme, cds: data.cds, type: ReferenceType.Function }, ...remainingInputs],
		out:               condition.out.concat(body.out),
		entryPoint:        nameId,
		cfgEntry:          conditionEntry,
		cfgExit:           rootId,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		graph,
		environment:       loopKill ? applyKills(loopEnvironment, loopKill) : loopEnvironment,
		hooks:             condition.hooks.concat(body.hooks),
		kill:              loopKill,
	};
}
